import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Sparkles, BookOpen, X, Loader2 } from "lucide-react";

import { apiFetch } from "../../api/client";

/** Per-line retranslate clicks (successful API calls) before the button locks */
const MAX_RETRANSLATES_PER_LINE = 3;

function displayGender(g) {
  const x = String(g ?? "").toLowerCase();
  if (x === "male") return "Male";
  if (x === "female") return "Female";
  return "Other";
}

function mapRowsFromApi(list) {
  return list.map((s) => ({
    id: s.id,
    character: s.character_name || "—",
    gender: displayGender(s.gender),
    tr: s.source_text || "",
    sy: s.translation || "",
    status: s.translation ? "ok" : "translating",
  }));
}

/** Progress fill color: red → orange → yellow → green as % increases */
function heatProgressColor(percent) {
  const stops = [
    { t: 0, rgb: [220, 38, 38] },
    { t: 0.33, rgb: [249, 115, 22] },
    { t: 0.66, rgb: [234, 179, 8] },
    { t: 1, rgb: [34, 197, 94] },
  ];
  const p = Math.max(0, Math.min(1, (Number(percent) || 0) / 100));
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (p <= s1.t) {
      const span = s1.t - s0.t || 1;
      const u = (p - s0.t) / span;
      const r = Math.round(s0.rgb[0] + (s1.rgb[0] - s0.rgb[0]) * u);
      const g = Math.round(s0.rgb[1] + (s1.rgb[1] - s0.rgb[1]) * u);
      const b = Math.round(s0.rgb[2] + (s1.rgb[2] - s0.rgb[2]) * u);
      return `rgb(${r},${g},${b})`;
    }
  }
  return `rgb(${stops[stops.length - 1].rgb.join(",")})`;
}

export default function DubbingTab({
  episodeId,
  headerSearchQuery = "",
  onContinueToExport,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [retranslatingId, setRetranslatingId] = useState(null);
  const [retranslateCounts, setRetranslateCounts] = useState({});
  /** Background translation job (server queue); polled until completed or failed */
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobPollData, setJobPollData] = useState(null);

  const glossSeqRef = useRef(0);
  const [glossModal, setGlossModal] = useState(null);

  const loadLines = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    if (episodeId == null) {
      setRows([]);
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const res = await apiFetch(`/sentences/episode/${episodeId}`);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setRows(mapRowsFromApi(list));
    } catch {
      setRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  useEffect(() => {
    setRetranslateCounts({});
    setActiveJobId(null);
    setJobPollData(null);
  }, [episodeId]);

  /** Resume polling if a job was left running (e.g. tab refresh). */
  useEffect(() => {
    if (episodeId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `/translate/episode/${episodeId}/jobs/latest`
        );
        if (!res.ok || cancelled) return;
        const j = await res.json();
        if (cancelled) return;
        if (j.status === "pending" || j.status === "running") {
          setTranslating(true);
          setActiveJobId(j.id);
          setJobPollData(j);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episodeId]);

  useEffect(() => {
    function onEsc(e) {
      if (e.key !== "Escape") return;
      if (glossModal) setGlossModal(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [glossModal]);

  useEffect(() => {
    if (activeJobId == null) return;
    let intervalId;
    const tick = async () => {
      try {
        const res = await apiFetch(`/translate/jobs/${activeJobId}`);
        if (!res.ok) return;
        const j = await res.json();
        setJobPollData(j);
        const terminal = [
          "completed",
          "completed_with_errors",
          "failed",
        ].includes(j.status);
        if (!terminal) {
          // Keep table in sync with server as each line is committed
          await loadLines({ silent: true });
        }
        if (terminal) {
          clearInterval(intervalId);
          setActiveJobId(null);
          setJobPollData(null);
          setTranslating(false);
          await loadLines({ silent: true });
          if (j.status === "failed" && j.error_message) {
            alert(j.error_message);
          } else if (
            j.status === "completed_with_errors" &&
            j.failed_lines > 0
          ) {
            alert(
              `Translation finished with ${j.failed_lines} failed line(s). You can edit those rows or try again later.`
            );
          }
        }
      } catch {
        /* ignore transient poll errors */
      }
    };
    tick();
    intervalId = setInterval(tick, 1500);
    return () => clearInterval(intervalId);
  }, [activeJobId, loadLines]);

  async function handleTranslateAll() {
    if (episodeId == null || rows.length === 0 || translating) return;

    setTranslating(true);
    try {
      const res = await apiFetch(`/translate/episode/${episodeId}/jobs`, {
        method: "POST",
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.status === 409) {
        alert(
          typeof data?.detail === "string"
            ? data.detail
            : "A translation job is already running for this episode."
        );
        try {
          const r2 = await apiFetch(
            `/translate/episode/${episodeId}/jobs/latest`
          );
          if (r2.ok) {
            const j = await r2.json();
            if (j.status === "pending" || j.status === "running") {
              setActiveJobId(j.id);
              setJobPollData(j);
              return;
            }
          }
        } catch {
          /* ignore */
        }
        setTranslating(false);
        return;
      }

      if (!res.ok) {
        const msg =
          (data && (data.detail || data.error)) ||
          `Translation failed (${res.status}). Ask your admin to check the server AI settings.`;
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
        setTranslating(false);
        return;
      }

      const jobId = data?.job_id;
      if (jobId == null) {
        alert("Server did not return a job id.");
        setTranslating(false);
        return;
      }
      setActiveJobId(jobId);
      setJobPollData({
        id: jobId,
        status: data.status ?? "pending",
        total_lines: data.total_lines ?? rows.length,
        completed_lines: 0,
        failed_lines: 0,
        progress_percent: 0,
      });
    } catch (e) {
      alert(e?.message || String(e));
      setTranslating(false);
    }
  }

  function updateSY(id, value) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              sy: value,
              status: value ? "ok" : "review",
            }
          : r
      )
    );
  }

  async function handleRetranslateLine(sentenceId) {
    if (sentenceId == null || translating || retranslatingId != null) return;
    const already = retranslateCounts[sentenceId] ?? 0;
    if (already >= MAX_RETRANSLATES_PER_LINE) return;

    setRetranslatingId(sentenceId);
    try {
      const res = await apiFetch(`/translate/`, {
        method: "POST",
        body: JSON.stringify({
          sentence_id: sentenceId,
          target_language: "Syrian Arabic",
          model_name: "gpt-5.4",
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        const msg =
          data?.detail != null
            ? typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail)
            : `Translation failed (${res.status})`;
        alert(msg);
        return;
      }
      if (data?.error) {
        alert(typeof data.error === "string" ? data.error : "Retranslate failed");
        return;
      }

      setRetranslateCounts((prev) => ({
        ...prev,
        [sentenceId]: (prev[sentenceId] ?? 0) + 1,
      }));

      const text = data?.translation ?? "";
      setRows((prev) =>
        prev.map((r) =>
          r.id === sentenceId
            ? {
                ...r,
                sy: text,
                status: text ? "ok" : "review",
              }
            : r
        )
      );
      await loadLines({ silent: true });
    } catch (e) {
      alert(e?.message || "Retranslate failed");
    } finally {
      setRetranslatingId(null);
    }
  }

  const runGlossRequest = useCallback(async (character, sourceText) => {
    const t = String(sourceText ?? "").trim();
    if (!t) return;
    const seq = ++glossSeqRef.current;
    setGlossModal({
      character,
      sourceText: t,
      gloss: null,
      loading: true,
      error: null,
    });
    try {
      const res = await apiFetch("/translate/gloss", {
        method: "POST",
        body: JSON.stringify({
          text: t,
          source_language: "Turkish",
          gloss_language: "Modern Standard Arabic",
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (seq !== glossSeqRef.current) return;
      if (!res.ok) {
        const detail = data?.detail;
        const msg =
          typeof detail === "string"
            ? detail
            : detail
              ? JSON.stringify(detail)
              : `Could not get explanation (${res.status})`;
        setGlossModal((m) =>
          m ? { ...m, loading: false, error: msg } : m
        );
        return;
      }
      setGlossModal((m) =>
        m
          ? { ...m, loading: false, gloss: String(data?.gloss ?? "").trim() }
          : m
      );
    } catch (e) {
      if (seq !== glossSeqRef.current) return;
      setGlossModal((m) =>
        m
          ? {
              ...m,
              loading: false,
              error: e?.message || "Failed to load explanation",
            }
          : m
      );
    }
  }, []);

  function openGloss(row) {
    runGlossRequest(row.character, row.tr);
  }

  const progress = useMemo(() => {
    if (rows.length === 0) return 0;
    const done = rows.filter(
      (r) => r.status === "ok" || r.status === "review"
    ).length;
    return Math.round((done / rows.length) * 100);
  }, [rows]);

  const displayProgress =
    translating && activeJobId != null
      ? jobPollData?.progress_percent ?? 0
      : progress;

  const needsTranslation = rows.some((r) => !r.sy?.trim());

  const headerSearchLower = useMemo(
    () => String(headerSearchQuery ?? "").trim().toLowerCase(),
    [headerSearchQuery]
  );

  const displayRows = useMemo(() => {
    if (!headerSearchLower) return rows;
    return rows.filter((r) => {
      const blob = [r.character, r.gender, r.tr, r.sy, r.status]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return blob.includes(headerSearchLower);
    });
  }, [rows, headerSearchLower]);

  async function handleConfirmExport() {
    if (
      episodeId == null ||
      rows.length === 0 ||
      typeof onContinueToExport !== "function"
    ) {
      return;
    }

    setConfirmLoading(true);
    try {
      const res = await apiFetch(`/translate/save-episode/${episodeId}`, {
        method: "POST",
        body: JSON.stringify({
          lines: rows.map((r) => ({
            sentence_id: r.id,
            text: r.sy ?? "",
          })),
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg =
          data?.detail != null
            ? typeof data.detail === "string"
              ? data.detail
              : JSON.stringify(data.detail)
            : "Could not save translations.";
        alert(msg);
        return;
      }

      onContinueToExport();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div style={container}>
      <div style={header}>
        <div>
          <h3 style={title}>Dubbing Review</h3>
          <p style={subtitle}>
            Generate Arabic (Syriac) lines for the whole episode with one click,
            then fine-tune each line below. Your edits are kept when you
            continue to Export. Use{" "}
            <strong style={{ color: "#4338CA" }}>Understand source</strong>{" "}
            for a direct <strong>Modern Standard Arabic (فصحى)</strong> rendering
            of the Turkish line so you can read the meaning—this is not your
            Syrian dub track.
          </p>
        </div>

        <div style={headerActions}>
          <button
            type="button"
            onClick={handleTranslateAll}
            disabled={
              loading ||
              translating ||
              rows.length === 0 ||
              episodeId == null
            }
            style={{
              ...translateBtn,
              ...(loading ||
              translating ||
              rows.length === 0 ||
              episodeId == null
                ? translateBtnDisabled
                : {}),
            }}
          >
            {translating
              ? "Translating…"
              : needsTranslation
                ? "Translate all (GPT)"
                : "Re-translate all (GPT)"}
          </button>
          <span style={summary}>
            {loading ? "…" : `${displayProgress}% completed`}
          </span>
        </div>
      </div>

      {translating && activeJobId != null && (
        <p style={banner}>
          Translating{" "}
          {jobPollData?.total_lines ?? rows.length} line(s) in the background
          {jobPollData != null && (
            <>
              {" "}
              — {jobPollData.completed_lines} done
              {jobPollData.failed_lines > 0
                ? `, ${jobPollData.failed_lines} failed`
                : ""}
            </>
          )}
          . Lines update here as each translation is saved. Safe to leave this
          page; open Dubbing again to see progress.
        </p>
      )}

      <div style={progressWrap}>
        <div
          style={{
            ...progressBar,
            width: `${displayProgress}%`,
            background: `linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%), linear-gradient(90deg, ${heatProgressColor(displayProgress)} 0%, ${heatProgressColor(Math.min(100, displayProgress + 8))} 100%)`,
            boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
          }}
        />
      </div>

      {loading && (
        <p style={loadingText}>Loading lines…</p>
      )}

      {!loading && rows.length === 0 && (
        <p style={emptyText}>
          No lines yet. Import a script on the Script tab, then return here.
        </p>
      )}

      {!loading &&
        rows.length > 0 &&
        displayRows.length === 0 &&
        headerSearchLower && (
          <p style={emptyText}>
            No dubbing lines match your header search. Clear the search to see
            all lines.
          </p>
        )}

      {!loading &&
        rows.length > 0 &&
        (displayRows.length > 0 || !headerSearchLower) && (
        <div className="dubbing-table-scroll" style={tableScrollOuter}>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ ...th, width: "10%", minWidth: "88px" }}>
                    Character
                  </th>
                  <th style={{ ...th, width: "22%", minWidth: 0 }}>
                    Source (TR)
                  </th>
                  <th style={{ ...th, width: "auto", minWidth: 0 }}>
                    Dubbed (SY)
                  </th>
                  <th
                    style={{
                      ...th,
                      width: "112px",
                      minWidth: "112px",
                      maxWidth: "112px",
                      textAlign: "center",
                    }}
                  >
                    Retranslate
                  </th>
                  <th
                    style={{
                      ...th,
                      width: "118px",
                      minWidth: "118px",
                      maxWidth: "118px",
                      textAlign: "center",
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {displayRows.map((row, idx) => {
                  const busy = retranslatingId === row.id;
                  const rowBusy = translating || retranslatingId != null;
                  const used = retranslateCounts[row.id] ?? 0;
                  const atLimit = used >= MAX_RETRANSLATES_PER_LINE;
                  const left = Math.max(0, MAX_RETRANSLATES_PER_LINE - used);
                  return (
                  <tr
                    key={row.id}
                    style={{
                      ...rowStyle,
                      background:
                        idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF",
                    }}
                  >
                    <td style={{ ...td, ...tdTight }}>
                      <span
                        style={{
                          ...badge,
                          ...(row.gender === "Male"
                            ? male
                            : row.gender === "Female"
                              ? female
                              : neutralGender),
                        }}
                      >
                        {row.character}
                      </span>
                    </td>

                    <td style={{ ...tdSource, minWidth: 0 }}>
                      <div style={sourceCellCol}>
                        <div style={sourceLineText}>{row.tr}</div>
                        {String(row.tr ?? "").trim() ? (
                          <button
                            type="button"
                            style={understandSourceBtn}
                            disabled={translating}
                            title="Show this line translated into Modern Standard Arabic (meaning check)"
                            onClick={() => openGloss(row)}
                          >
                            <BookOpen size={14} strokeWidth={2} />
                            Understand source
                          </button>
                        ) : null}
                      </div>
                    </td>

                    <td style={{ ...td, minWidth: 0 }}>
                      <textarea
                        className="dubbing-sy-field"
                        dir="rtl"
                        value={row.sy}
                        placeholder={
                          row.status === "translating" && !row.sy
                            ? "Use “Translate all (GPT)” above to fill this"
                            : "Type or paste the dubbed line…"
                        }
                        onChange={(e) =>
                          updateSY(row.id, e.target.value)
                        }
                        style={textarea}
                        disabled={busy || translating}
                      />
                    </td>

                    <td
                      style={{
                        ...td,
                        ...tdTight,
                        textAlign: "center",
                        verticalAlign: "middle",
                      }}
                    >
                      <button
                        type="button"
                        title={
                          atLimit
                            ? `Limit reached: ${MAX_RETRANSLATES_PER_LINE} retranslations per line`
                            : `Run GPT again (character traits). ${left} use${left === 1 ? "" : "s"} left.`
                        }
                        disabled={rowBusy || atLimit}
                        onClick={() => handleRetranslateLine(row.id)}
                        style={{
                          ...retranslateBtn,
                          ...(atLimit ? retranslateBtnLimit : {}),
                          opacity: rowBusy || atLimit ? 0.55 : 1,
                        }}
                      >
                        <Sparkles size={15} />
                        {busy
                          ? "…"
                          : atLimit
                            ? "Limit"
                            : "Retranslate"}
                      </button>
                    </td>

                    <td style={{ ...td, ...tdTight, textAlign: "center" }}>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {glossModal && (
        <>
          <div
            style={glossOverlay}
            onClick={() => setGlossModal(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dubbing-gloss-title"
          >
            <div style={glossModalCard} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                style={glossCloseBtn}
                aria-label="Close"
                onClick={() => setGlossModal(null)}
              >
                <X size={20} />
              </button>
              <h4 id="dubbing-gloss-title" style={glossModalTitle}>
                Understand source (MSA)
              </h4>
              <p style={glossModalMeta}>
                Character: <strong>{glossModal.character}</strong>
                {" · "}
                Turkish → <strong>Modern Standard Arabic</strong> (read the
                meaning; Syrian colloquial dub stays in the table)
              </p>
              <div style={glossSourceBox}>{glossModal.sourceText}</div>
              {glossModal.loading ? (
                <div style={glossLoadingRow}>
                  <Loader2 size={22} className="dubbing-gloss-spin" />
                  <span>Getting explanation…</span>
                </div>
              ) : glossModal.error ? (
                <p style={glossError}>{glossModal.error}</p>
              ) : (
                <div style={{ ...glossOutBox, direction: "rtl" }} lang="ar">
                  {glossModal.gloss || "No text returned."}
                </div>
              )}
              <p style={glossDisclaimer}>
                Direct فصحى rendering for meaning only (no explanations). Use{" "}
                <strong>Retranslate</strong> for Syrian colloquial dubbing in the
                table.
              </p>
              <div style={glossModalActions}>
                <button
                  type="button"
                  style={glossSecondaryBtn}
                  onClick={() =>
                    runGlossRequest(
                      glossModal.character,
                      glossModal.sourceText
                    )
                  }
                  disabled={glossModal.loading}
                >
                  Try again
                </button>
                <button
                  type="button"
                  style={glossPrimaryBtn}
                  onClick={() => setGlossModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          <style>{`
            .dubbing-gloss-spin { animation: dubbingGlossSpin 0.75s linear infinite; }
            @keyframes dubbingGlossSpin { to { transform: rotate(360deg); } }
          `}</style>
        </>
      )}

      {!loading && rows.length > 0 && typeof onContinueToExport === "function" && (
        <div style={dubbingFooter}>
          <button
            type="button"
            onClick={handleConfirmExport}
            disabled={confirmLoading}
            style={{
              ...confirmExportBtn,
              opacity: confirmLoading ? 0.7 : 1,
            }}
          >
            {confirmLoading ? "Saving…" : "Confirm & go to Export"}
          </button>
          <p style={dubbingFooterHint}>
            Saves every Arabic line to the server (including your edits), then
            opens Export to download CSV or Excel.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "ok")
    return (
      <span style={{ ...statusBadge, ...ok }}>
        ✓ Translated
      </span>
    );

  if (status === "review")
    return (
      <span style={{ ...statusBadge, ...review }}>
        Needs Review
      </span>
    );

  return (
    <span style={{ ...statusBadge, ...pending }}>
      Pending
    </span>
  );
}

const container = {
  width: "100%",
  maxWidth: "100%",
  marginTop: "24px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "18px",
};

const headerActions = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "10px",
  flexShrink: 0,
};

const title = {
  fontSize: "1.6rem",
  fontWeight: 700,
  color: "#111827",
};

const subtitle = {
  fontSize: "0.95rem",
  color: "#6B7280",
  marginTop: "6px",
  maxWidth: "640px",
  lineHeight: 1.5,
};

const translateBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#7C3AED",
  color: "#fff",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(124,58,237,0.25)",
};

const translateBtnDisabled = {
  background: "#9CA3AF",
  cursor: "not-allowed",
  boxShadow: "none",
};

const summary = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "#2563EB",
};

const banner = {
  fontSize: "0.9rem",
  color: "#1E40AF",
  background: "#EFF6FF",
  border: "1px solid #BFDBFE",
  borderRadius: "10px",
  padding: "10px 14px",
  marginBottom: "16px",
};

const progressWrap = {
  height: "8px",
  background: "#F3F4F6",
  borderRadius: "999px",
  overflow: "hidden",
  marginBottom: "20px",
};

const progressBar = {
  height: "100%",
  borderRadius: "999px",
  transition: "width 0.45s ease, filter 0.35s ease",
};

const loadingText = {
  color: "#6B7280",
  fontSize: "0.95rem",
};

const emptyText = {
  color: "#6B7280",
  fontSize: "0.95rem",
  padding: "24px",
  background: "#F9FAFB",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
};

const tableScrollOuter = {
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
  maxHeight: "min(520px, calc(100vh - 320px))",
  overflowY: "auto",
  overflowX: "hidden",
  background: "#ffffff",
  scrollbarWidth: "thin",
  scrollbarColor: "#CBD5E1 #F1F5F9",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const tableWrap = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const table = {
  width: "100%",
  maxWidth: "100%",
  tableLayout: "fixed",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const th = {
  padding: "12px 16px",
  fontSize: "0.78rem",
  fontWeight: 700,
  color: "#475569",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "linear-gradient(180deg, #F1F5F9 0%, #E8EEF5 100%)",
  borderBottom: "2px solid #C7D2FE",
  position: "sticky",
  top: 0,
  zIndex: 2,
  boxShadow: "none",
};

const rowStyle = {
  transition: "background 0.2s ease",
};

const td = {
  padding: "14px 16px",
  verticalAlign: "top",
  fontSize: "0.95rem",
  color: "#111827",
  borderBottom: "1px solid #EEF2F6",
};

const tdTight = {
  paddingTop: "16px",
  paddingBottom: "16px",
};

const tdSource = {
  ...td,
  color: "#374151",
  fontSize: "0.92rem",
  lineHeight: 1.55,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const badge = {
  padding: "6px 14px",
  borderRadius: "999px",
  fontSize: "0.8rem",
  fontWeight: 600,
  display: "inline-block",
};

const male = {
  background: "#EFF6FF",
  color: "#1D4ED8",
};

const female = {
  background: "#FDF2F8",
  color: "#BE185D",
};

const neutralGender = {
  background: "#FEF9C3",
  color: "#92400E",
};

const textarea = {
  width: "100%",
  minHeight: "64px",
  maxHeight: "160px",
  padding: "11px 14px",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#0F172A",
  fontSize: "0.95rem",
  lineHeight: 1.65,
  fontFamily: "inherit",
  resize: "vertical",
  transition: "border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
  boxSizing: "border-box",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const statusBadge = {
  padding: "6px 12px",
  borderRadius: "999px",
  fontSize: "0.8rem",
  fontWeight: 600,
};

const ok = {
  background: "#ECFDF5",
  color: "#047857",
};

const review = {
  background: "#FEF3C7",
  color: "#92400E",
};

const pending = {
  background: "#DBEAFE",
  color: "#1D4ED8",
};

const dubbingFooter = {
  marginTop: "28px",
  paddingTop: "20px",
  borderTop: "1px solid #E5E7EB",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "8px",
};

const confirmExportBtn = {
  padding: "12px 22px",
  borderRadius: "12px",
  border: "none",
  background: "#059669",
  color: "#fff",
  fontWeight: 600,
  fontSize: "1rem",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(5,150,105,0.25)",
};

const dubbingFooterHint = {
  margin: 0,
  fontSize: "0.85rem",
  color: "#6B7280",
  textAlign: "right",
  maxWidth: "420px",
  lineHeight: 1.45,
};

const retranslateBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #C7D2FE",
  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#4338CA",
  fontSize: "0.72rem",
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};

const retranslateBtnLimit = {
  background: "#F1F5F9",
  color: "#94A3B8",
  borderColor: "#E2E8F0",
  cursor: "not-allowed",
};

const sourceCellCol = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
  minWidth: 0,
};

const sourceLineText = {
  width: "100%",
  minWidth: 0,
};

const understandSourceBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #C7D2FE",
  background: "#FFFFFF",
  color: "#4338CA",
  fontSize: "0.72rem",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  flexShrink: 0,
};

const glossOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  background: "rgba(15, 23, 42, 0.45)",
  backdropFilter: "blur(3px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  boxSizing: "border-box",
};

const glossModalCard = {
  position: "relative",
  width: "100%",
  maxWidth: "520px",
  maxHeight: "min(90vh, 640px)",
  overflowY: "auto",
  background: "#FFFFFF",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
  padding: "24px 22px 20px",
  boxSizing: "border-box",
};

const glossCloseBtn = {
  position: "absolute",
  top: "12px",
  right: "12px",
  border: "none",
  background: "transparent",
  color: "#94A3B8",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  borderRadius: "8px",
};

const glossModalTitle = {
  margin: "0 36px 8px 0",
  fontSize: "1.1rem",
  fontWeight: 800,
  color: "#0F172A",
};

const glossModalMeta = {
  margin: "0 0 14px",
  fontSize: "0.82rem",
  color: "#64748B",
  lineHeight: 1.45,
};

const glossSourceBox = {
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
  fontSize: "0.92rem",
  color: "#334155",
  lineHeight: 1.55,
  marginBottom: "14px",
};

const glossLoadingRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  color: "#475569",
  fontSize: "0.9rem",
  marginBottom: "12px",
};

const glossError = {
  margin: "0 0 12px",
  fontSize: "0.88rem",
  color: "#B91C1C",
  lineHeight: 1.45,
};

const glossOutBox = {
  padding: "14px 16px",
  borderRadius: "12px",
  background: "linear-gradient(145deg, #EEF2FF 0%, #E0E7FF 100%)",
  border: "1px solid #C7D2FE",
  fontSize: "0.92rem",
  color: "#1E1B4B",
  lineHeight: 1.6,
  marginBottom: "12px",
};

const glossDisclaimer = {
  margin: "0 0 16px",
  fontSize: "0.78rem",
  color: "#64748B",
  lineHeight: 1.45,
};

const glossModalActions = {
  display: "flex",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: "10px",
};

const glossSecondaryBtn = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#F8FAFC",
  color: "#475569",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const glossPrimaryBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #4F46E5, #4338CA)",
  color: "#FFFFFF",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
  fontFamily: "inherit",
};
