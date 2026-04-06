import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { Sparkles } from "lucide-react";

import { apiFetch } from "../../api/client";

function getGenderStyle(gender) {
  const g = String(gender ?? "").toLowerCase();
  if (g === "male") {
    return { bg: "#DBEAFE", color: "#1D4ED8", border: "#93C5FD" };
  }
  if (g === "female") {
    return { bg: "#FCE7F3", color: "#BE185D", border: "#F9A8D4" };
  }
  return { bg: "#FEF9C3", color: "#92400E", border: "#FDE047" };
}

function normalizeHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeName(n) {
  return String(n ?? "").trim().toLowerCase();
}

const SENTENCE_ALIASES = new Set([
  "source_text",
  "source",
  "sentence",
  "text",
  "dialogue",
  "line",
  "script",
  "metin",
  "replik",
  "turkish",
  "english",
  "subtitle",
  "original",
  "orjinal",
  "dialouge",
]);

const CHARACTER_ALIASES = new Set([
  "character",
  "character_name",
  "karakter",
  "speaker",
  "role",
  "char",
  "oyuncu",
]);

const GENDER_ALIASES = new Set([
  "gender",
  "sex",
  "cinsiyet",
  "cins",
]);

function detectColumns(columnKeys) {
  const normalized = columnKeys.map((k) => ({
    raw: k,
    norm: normalizeHeader(k),
  }));

  let sentence = "";
  let character = "";
  let gender = "";
  let start_time = "";
  let end_time = "";

  for (const { raw, norm } of normalized) {
    if (!sentence && SENTENCE_ALIASES.has(norm)) sentence = raw;
    if (!character && CHARACTER_ALIASES.has(norm)) character = raw;
    if (!gender && GENDER_ALIASES.has(norm)) gender = raw;
    if (
      !start_time &&
      (norm === "start_time" ||
        norm === "timecode_in" ||
        norm === "tc_in" ||
        norm === "in_time" ||
        (norm.includes("start") &&
          (norm.includes("time") || norm.includes("tc"))))
    ) {
      start_time = raw;
    }
    if (
      !end_time &&
      (norm === "end_time" ||
        norm === "timecode_out" ||
        norm === "tc_out" ||
        norm === "out_time" ||
        (norm.includes("end") &&
          (norm.includes("time") || norm.includes("tc"))))
    ) {
      end_time = raw;
    }
  }

  if (!sentence) {
    const hit = normalized.find(({ norm }) =>
      ["source", "text", "sentence", "metin", "dialog", "replik", "line"].some(
        (w) => norm.includes(w)
      )
    );
    if (hit) sentence = hit.raw;
  }

  if (!character) {
    const hit = normalized.find(({ norm }) =>
      ["character", "karakter", "speaker", "role", "oyuncu"].some((w) =>
        norm.includes(w)
      )
    );
    if (hit) character = hit.raw;
  }

  if (!gender) {
    const hit = normalized.find(({ norm }) =>
      ["gender", "cinsiyet", "sex"].some((w) => norm.includes(w))
    );
    if (hit) gender = hit.raw;
  }

  return {
    sentence,
    character,
    gender,
    autoOk: Boolean(sentence && character),
  };
}

function parseSheetFromArrayBuffer(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    codepage: 65001,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

function parseSheetFromUtf8Text(text) {
  const workbook = XLSX.read(text, {
    type: "string",
    codepage: 65001,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
}

function SectionTitle({ children }) {
  return <h2 style={sectionTitle}>{children}</h2>;
}

function rowMatchesHeaderSearch(row, qLower) {
  if (!qLower) return true;
  const blob = [
    row.character,
    row.text,
    row.translation,
    row.gender,
    row.start_time,
    row.end_time,
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
  return blob.includes(qLower);
}

export default function ScriptTab({
  projectId,
  episodeId,
  headerSearchQuery = "",
  onImportSuccess,
}) {
  const [file, setFile] = useState(null);
  const [fullData, setFullData] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [mapping, setMapping] = useState({
    sentence: "",
    character: "",
    gender: "",
    start_time: "",
    end_time: "",
  });
  const [showMapping, setShowMapping] = useState(false);
  const [characters, setCharacters] = useState([]);
  const [charactersReady, setCharactersReady] = useState(true);
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  /** Default Yes so new sheets aren’t skipped when project has no matching characters yet. */
  const [addUnknownCharacters, setAddUnknownCharacters] = useState(true);
  const [storedLineCount, setStoredLineCount] = useState(0);
  const [storedScriptRows, setStoredScriptRows] = useState([]);
  const [storedLinesLoading, setStoredLinesLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [translatingLineId, setTranslatingLineId] = useState(null);

  const episodeParam = episodeId != null ? episodeId : 1;

  const refreshSavedScript = useCallback(async () => {
    if (episodeId == null) {
      setStoredLineCount(0);
      setStoredScriptRows([]);
      return;
    }
    const res = await apiFetch(`/sentences/episode/${episodeId}`);
    const data = res.ok ? await res.json() : [];
    const list = Array.isArray(data) ? data : [];
    setStoredLineCount(list.length);
    setStoredScriptRows(
      list.map((s) => ({
        id: s.id,
        character: s.character_name || "—",
        text: s.source_text || "",
        translation: s.translation ? String(s.translation) : "",
        gender: s.gender || "other",
      }))
    );
  }, [episodeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStoredLinesLoading(true);
      try {
        await refreshSavedScript();
      } catch {
        if (!cancelled) {
          setStoredLineCount(0);
          setStoredScriptRows([]);
        }
      } finally {
        if (!cancelled) setStoredLinesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSavedScript]);

  useEffect(() => {
    if (projectId == null) {
      setCharacters([]);
      setCharactersReady(true);
      return;
    }
    let cancelled = false;
    setCharactersReady(false);
    (async () => {
      try {
        const res = await apiFetch(`/characters/project/${projectId}`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setCharacters(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCharacters([]);
      } finally {
        if (!cancelled) setCharactersReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const characterNameSet = useMemo(
    () => new Set(characters.map((c) => normalizeName(c.name))),
    [characters]
  );

  const columns =
    previewData.length > 0 ? Object.keys(previewData[0]) : [];

  const uniqueScriptCharacters = useMemo(() => {
    if (!fullData.length || !mapping.character) return new Set();
    const s = new Set();
    for (const row of fullData) {
      const n = normalizeName(row[mapping.character]);
      if (n) s.add(n);
    }
    return s;
  }, [fullData, mapping.character]);

  const matchedCharacterCount = useMemo(() => {
    let n = 0;
    uniqueScriptCharacters.forEach((name) => {
      if (characterNameSet.has(name)) n += 1;
    });
    return n;
  }, [uniqueScriptCharacters, characterNameSet]);

  const validationHints = useMemo(() => {
    if (!fullData.length || !mapping.sentence || !mapping.character) {
      return { emptyText: 0, unknownChar: 0, unknownSamples: [] };
    }
    let emptyText = 0;
    let unknownChar = 0;
    const samples = [];
    for (const row of fullData) {
      const text = String(row[mapping.sentence] ?? "").trim();
      const ch = String(row[mapping.character] ?? "").trim();
      if (!text) emptyText += 1;
      if (
        projectId != null &&
        charactersReady &&
        ch &&
        !characterNameSet.has(normalizeName(ch))
      ) {
        unknownChar += 1;
        if (samples.length < 5 && !samples.includes(ch)) samples.push(ch);
      }
    }
    return { emptyText, unknownChar, unknownSamples: samples };
  }, [
    fullData,
    mapping,
    characterNameSet,
    projectId,
    charactersReady,
  ]);

  const importRowCountPreview = useMemo(() => {
    if (!fullData.length || !mapping.sentence || !mapping.character) {
      return null;
    }
    const nameSet =
      projectId != null && charactersReady ? characterNameSet : null;
    let count = 0;
    for (const row of fullData) {
      const source_text = String(row[mapping.sentence] ?? "").trim();
      const character_name = String(row[mapping.character] ?? "").trim();
      if (!source_text) continue;
      if (
        !character_name ||
        (nameSet &&
          !nameSet.has(normalizeName(character_name)) &&
          !addUnknownCharacters)
      ) {
        continue;
      }
      count += 1;
    }
    return { count, total: fullData.length };
  }, [
    fullData,
    mapping.sentence,
    mapping.character,
    projectId,
    charactersReady,
    characterNameSet,
    addUnknownCharacters,
  ]);

  function handleFileUpload(e) {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setImportResult(null);
    setAddUnknownCharacters(true);
    setFullData([]);
    setPreviewData([]);

    const isCsv = /\.csv$/i.test(uploadedFile.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        let json;
        if (isCsv) {
          const text =
            typeof evt.target.result === "string"
              ? evt.target.result
              : new TextDecoder("utf-8", { fatal: false }).decode(
                  new Uint8Array(evt.target.result)
                );
          json = parseSheetFromUtf8Text(text);
        } else {
          const buf = evt.target.result;
          json = parseSheetFromArrayBuffer(buf);
        }

        if (!Array.isArray(json)) json = [];

        setFullData(json);
        setPreviewData(json.slice(0, 5));

        const cols = json.length ? Object.keys(json[0]) : [];
        const det = detectColumns(cols);
        setMapping({
          sentence: det.sentence || "",
          character: det.character || "",
          gender: det.gender || "",
          start_time: det.start_time || "",
          end_time: det.end_time || "",
        });
        setShowMapping(!det.autoOk);
      } catch (err) {
        console.error(err);
        alert("Could not read this file. Try saving as .xlsx or UTF-8 CSV.");
      }
    };

    reader.onerror = () => {
      alert("Failed to read file.");
    };

    if (isCsv) reader.readAsText(uploadedFile, "UTF-8");
    else reader.readAsArrayBuffer(uploadedFile);
  }

  const canConfirm = Boolean(mapping.sentence && mapping.character);
  const importBlocked =
    projectId != null && !charactersReady;

  async function handleConfirm() {
    if (!file || !canConfirm) return;

    setImportLoading(true);
    setImportResult(null);

    const reader = new FileReader();
    const isCsv = /\.csv$/i.test(file.name);

    reader.onload = async (evt) => {
      try {
        let json;
        if (isCsv) {
          const text =
            typeof evt.target.result === "string"
              ? evt.target.result
              : new TextDecoder("utf-8", { fatal: false }).decode(
                  new Uint8Array(evt.target.result)
                );
          json = parseSheetFromUtf8Text(text);
        } else {
          json = parseSheetFromArrayBuffer(evt.target.result);
        }

        const totalRows = json.length;
        const formatted = [];

        const nameSet =
          projectId != null && charactersReady
            ? characterNameSet
            : null;

        for (const row of json) {
          const source_text = String(row[mapping.sentence] ?? "").trim();
          const character_name = String(row[mapping.character] ?? "").trim();
          const gender_raw = mapping.gender
            ? String(row[mapping.gender] ?? "").trim() || null
            : null;
          const start_time = mapping.start_time
            ? String(row[mapping.start_time] ?? "").trim() || null
            : null;
          const end_time = mapping.end_time
            ? String(row[mapping.end_time] ?? "").trim() || null
            : null;

          if (!source_text) continue;
          if (
            !character_name ||
            (nameSet &&
              !nameSet.has(normalizeName(character_name)) &&
              !addUnknownCharacters)
          ) {
            continue;
          }

          const payload = {
            source_text,
            character_name,
          };
          if (gender_raw) payload.gender = gender_raw;
          if (start_time) payload.start_time = start_time;
          if (end_time) payload.end_time = end_time;
          formatted.push(payload);
        }

        const successful = formatted.length;
        const skipped = totalRows - successful;

        const res = await apiFetch(`/upload/sentences/${episodeParam}`, {
          method: "POST",
          body: JSON.stringify({
            sentences: formatted,
            add_unknown_characters: addUnknownCharacters,
          }),
        });

        let serverPayload = null;
        try {
          serverPayload = await res.json();
        } catch {
          serverPayload = null;
        }

        if (!res.ok) {
          setImportResult({
            totalRows,
            successful: 0,
            skipped: totalRows,
            error: true,
            detail:
              serverPayload && typeof serverPayload === "object"
                ? JSON.stringify(serverPayload)
                : `HTTP ${res.status}`,
          });
          return;
        }

        setImportResult({
          totalRows,
          successful,
          skipped,
          error: false,
          serverMessage:
            serverPayload && typeof serverPayload === "object"
              ? serverPayload.message ?? null
              : null,
        });

        try {
          await refreshSavedScript();
        } catch {
          /* ignore */
        }

        if (successful > 0 && typeof onImportSuccess === "function") {
          window.setTimeout(() => onImportSuccess(), 600);
        }
      } catch (err) {
        console.error(err);
        setImportResult({
          totalRows: fullData.length,
          successful: 0,
          skipped: fullData.length,
          error: true,
          detail: String(err.message || err),
        });
      } finally {
        setImportLoading(false);
      }
    };

    reader.onerror = () => {
      setImportLoading(false);
      alert("Failed to read file for import.");
    };

    if (isCsv) reader.readAsText(file, "UTF-8");
    else reader.readAsArrayBuffer(file);
  }

  const dubbedSavedCount = useMemo(
    () =>
      storedScriptRows.filter((r) => String(r.translation || "").trim().length > 0)
        .length,
    [storedScriptRows]
  );

  const headerSearchLower = useMemo(
    () => String(headerSearchQuery ?? "").trim().toLowerCase(),
    [headerSearchQuery]
  );

  const visibleStoredRows = useMemo(
    () =>
      storedScriptRows.filter((r) =>
        rowMatchesHeaderSearch(r, headerSearchLower)
      ),
    [storedScriptRows, headerSearchLower]
  );

  async function handleTranslateLine(sentenceId) {
    if (sentenceId == null || translatingLineId != null) return;
    setTranslatingLineId(sentenceId);
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
        alert(typeof data.error === "string" ? data.error : "Translation failed");
        return;
      }
      await refreshSavedScript();
    } catch (e) {
      alert(e?.message || "Translation failed");
    } finally {
      setTranslatingLineId(null);
    }
  }

  async function handleClearStoredLines() {
    if (episodeId == null) return;
    if (
      !window.confirm(
        `Remove all ${storedLineCount} line(s) and their translations for this episode? The Dubbing tab will be empty until you import again.`
      )
    ) {
      return;
    }
    setClearLoading(true);
    try {
      const res = await apiFetch(
        `/sentences/episode/${episodeId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        alert("Could not clear stored lines.");
        return;
      }
      await refreshSavedScript();
      setImportResult(null);
    } catch {
      alert("Could not clear stored lines.");
    } finally {
      setClearLoading(false);
    }
  }

  return (
    <div style={wrapper}>
      <SectionTitle>Upload Script</SectionTitle>

      {episodeId != null && (
        <>
          <h2 style={{ ...sectionTitle, marginTop: "12px" }}>
            Saved script (this episode)
          </h2>
          <p style={savedScriptHint}>
            <strong>Same data as Dubbing.</strong> Only these lines exist for
            this episode. Importing a file <strong>replaces</strong> all of them
            with the new file (e.g. 5 rows in Excel → exactly 5 lines here and
            in Dubbing).
          </p>

          {storedLinesLoading ? (
            <p style={mutedP}>Loading saved lines…</p>
          ) : storedScriptRows.length === 0 ? (
            <p style={mutedP}>
              No lines saved yet. Import a CSV/Excel below to add your script.
            </p>
          ) : (
            <>
              <div style={savedTableToolbar}>
                <div style={savedMetaRow}>
                  <span style={savedTableMeta}>
                    {headerSearchLower
                      ? `${visibleStoredRows.length} shown · ${storedScriptRows.length} saved`
                      : `${storedScriptRows.length} line${
                          storedScriptRows.length === 1 ? "" : "s"
                        } saved`}
                  </span>
                  <span style={savedDubPill}>
                    {dubbedSavedCount} / {storedScriptRows.length} dubbed
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearStoredLines}
                  disabled={clearLoading}
                  style={{
                    ...clearLinesBtn,
                    marginTop: 0,
                    opacity: clearLoading ? 0.7 : 1,
                  }}
                >
                  {clearLoading ? "Clearing…" : "Clear all lines"}
                </button>
              </div>
              <div
                className="script-saved-scroll"
                style={savedTableScroll}
              >
                <table style={savedTable}>
                  <thead>
                    <tr>
                      <th style={{ ...savedTh, width: "44px" }}>#</th>
                      <th style={{ ...savedTh, width: "22%", minWidth: "120px" }}>
                        Character
                      </th>
                      <th style={savedTh}>Source (TR)</th>
                      <th style={{ ...savedTh, width: "28%", minWidth: "160px" }}>
                        Dubbing (SY)
                      </th>
                      <th
                        style={{
                          ...savedTh,
                          width: "100px",
                          textAlign: "center",
                        }}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStoredRows.map((row, idx) => {
                      const gs = getGenderStyle(row.gender);
                      const hasTr = String(row.translation || "").trim().length > 0;
                      const busy = translatingLineId === row.id;
                      return (
                        <tr
                          key={row.id}
                          style={{
                            background: idx % 2 === 1 ? "#F8FAFC" : "#FFFFFF",
                          }}
                        >
                          <td style={{ ...savedTd, ...savedTdNum }}>{idx + 1}</td>
                          <td style={savedTd}>
                            <span
                              style={{
                                ...savedCharPill,
                                background: gs.bg,
                                color: gs.color,
                                border: `1px solid ${gs.border}`,
                              }}
                            >
                              {row.character}
                            </span>
                          </td>
                          <td style={{ ...savedTd, ...savedTdTr }}>{row.text}</td>
                          <td
                            style={{
                              ...savedTd,
                              ...savedTdSy,
                              ...(hasTr ? {} : savedTdSyEmpty),
                            }}
                            dir={hasTr ? "rtl" : "ltr"}
                          >
                            {hasTr ? (
                              row.translation
                            ) : (
                              <span style={savedSyPlaceholder}>
                                Use Dubbing tab or translate here
                              </span>
                            )}
                          </td>
                          <td style={{ ...savedTd, textAlign: "center" }}>
                            <button
                              type="button"
                              title="Translate this line with GPT (uses character from script)"
                              disabled={busy || translatingLineId != null}
                              onClick={() => handleTranslateLine(row.id)}
                              style={{
                                ...savedLineTranslateBtn,
                                opacity:
                                  busy || translatingLineId != null ? 0.55 : 1,
                              }}
                            >
                              <Sparkles size={15} />
                              {busy ? "…" : "GPT"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visibleStoredRows.length === 0 &&
                storedScriptRows.length > 0 &&
                headerSearchLower && (
                  <p style={{ ...mutedP, marginTop: "10px" }}>
                    No lines match your header search. Clear the search in the
                    header to see all lines.
                  </p>
                )}
            </>
          )}
        </>
      )}

      <Card
        step="1"
        title="Choose file"
        description="Excel (.xlsx, .xls) or UTF-8 CSV with dialogue and character columns."
      >
        <div style={uploadBox}>
          <label style={uploadLabel}>
            Choose Excel or CSV
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>

          {file && (
            <div style={fileInfo}>
              <strong>{file.name}</strong>
              <span style={fileHint}>File loaded — UTF-8 used for CSV</span>
            </div>
          )}
        </div>
      </Card>

      {previewData.length > 0 && (
        <>
          <SectionTitle>Preview</SectionTitle>

          <Card
            step="2"
            title="First rows"
            description="Check that text and Turkish characters look correct."
          >
            {projectId != null &&
              charactersReady &&
              mapping.character &&
              uniqueScriptCharacters.size > 0 && (
              <div style={badgeRow}>
                <span style={matchBadge}>
                  Matched characters: {matchedCharacterCount} /{" "}
                  {uniqueScriptCharacters.size}
                </span>
              </div>
            )}

            {projectId != null && !charactersReady && (
              <p style={loadingHint}>Loading project characters…</p>
            )}

            {(validationHints.emptyText > 0 ||
              validationHints.unknownChar > 0) && (
              <div style={warnBox}>
                {validationHints.emptyText > 0 && (
                  <div style={warnLine}>
                    Warning: {validationHints.emptyText} row(s) have empty
                    dialogue (source text) and will be skipped on import.
                  </div>
                )}
                {validationHints.unknownChar > 0 && (
                  <div style={warnLine}>
                    Warning: {validationHints.unknownChar} row(s) use a
                    character name not in this project — those rows will be
                    {addUnknownCharacters ? "imported (and characters will be created) on import." : "skipped."}
                    {validationHints.unknownSamples.length > 0 && (
                      <span>
                        {" "}
                        Examples:{" "}
                        {validationHints.unknownSamples.join(", ")}
                      </span>
                    )}
                  </div>
                )}
                {validationHints.unknownChar > 0 && projectId != null && (
                  <div style={addUnknownCharPrompt}>
                    <div style={addUnknownCharTitle}>
                      Add these characters to the project instead of skipping?
                    </div>
                    <div style={addUnknownCharSub}>
                      Clicking <strong>Yes</strong> won’t change anything until you press{" "}
                      <strong>Import script</strong>.
                    </div>
                    <div style={addUnknownCharButtons}>
                      <button
                        type="button"
                        style={{
                          ...choiceBtn,
                          ...(addUnknownCharacters
                            ? choiceBtnActiveYes
                            : choiceBtnIdle),
                        }}
                        onClick={() => setAddUnknownCharacters(true)}
                      >
                        Yes — add to project
                      </button>
                      <button
                        type="button"
                        style={{
                          ...choiceBtn,
                          ...(!addUnknownCharacters
                            ? choiceBtnActiveNo
                            : choiceBtnIdle),
                        }}
                        onClick={() => setAddUnknownCharacters(false)}
                      >
                        No — skip those rows
                      </button>
                    </div>
                    {importRowCountPreview && (
                      <div style={importCountHint}>
                        Rows that will be sent on import:{" "}
                        <strong>{importRowCountPreview.count}</strong>
                        <span style={{ color: "#78350F", fontWeight: 600 }}>
                          {" "}
                          / {importRowCountPreview.total} in file
                        </span>
                        {importRowCountPreview.count === 0 &&
                          validationHints.unknownChar > 0 && (
                          <span>
                            {" "}
                            — choose <strong>Yes — add to project</strong>, then
                            click Import.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col} style={th}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        ...tr,
                        background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF",
                      }}
                    >
                      {columns.map((col) => (
                        <td key={col} style={td}>
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!showMapping && (
              <button
                type="button"
                onClick={() => setShowMapping(true)}
                style={linkButton}
              >
                Wrong columns? Map manually
              </button>
            )}
          </Card>
        </>
      )}

      {previewData.length > 0 && showMapping && (
        <>
          <SectionTitle>Column mapping</SectionTitle>
          <Card
            step="3"
            title="Map columns"
            description="Dialogue, character, optional gender, and optional start/end time columns (e.g. subtitles)."
          >
            <div style={mappingGrid}>
              <MappingSelect
                label="Sentence / dialogue column"
                value={mapping.sentence}
                options={columns}
                onChange={(v) =>
                  setMapping((m) => ({ ...m, sentence: v }))
                }
              />
              <MappingSelect
                label="Character name column"
                value={mapping.character}
                options={columns}
                onChange={(v) =>
                  setMapping((m) => ({ ...m, character: v }))
                }
              />
              <MappingSelectOptional
                label="Gender column (optional)"
                value={mapping.gender}
                options={columns}
                emptyLabel="None — use character default / other"
                onChange={(v) =>
                  setMapping((m) => ({ ...m, gender: v }))
                }
              />
              <MappingSelectOptional
                label="Start time column (optional)"
                value={mapping.start_time}
                options={columns}
                emptyLabel="None"
                onChange={(v) =>
                  setMapping((m) => ({ ...m, start_time: v }))
                }
              />
              <MappingSelectOptional
                label="End time column (optional)"
                value={mapping.end_time}
                options={columns}
                emptyLabel="None"
                onChange={(v) =>
                  setMapping((m) => ({ ...m, end_time: v }))
                }
              />
            </div>
          </Card>
        </>
      )}

      {previewData.length > 0 && (
        <div style={confirmWrap}>
          <div style={confirmRightCol}>
            {importRowCountPreview && (
              <p style={confirmImportHint}>
                About <strong>{importRowCountPreview.count}</strong> line
                {importRowCountPreview.count === 1 ? "" : "s"} will be imported
                (rows with dialogue + valid character rule).
              </p>
            )}
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || importLoading || importBlocked}
              style={{
                ...primaryBtn,
                ...(
                  canConfirm && !importLoading && !importBlocked
                    ? activeBtn
                    : disabledBtn
                ),
              }}
            >
              {importLoading
                ? "Importing…"
                : importBlocked
                  ? "Loading characters…"
                  : "Import script"}
            </button>
          </div>
        </div>
      )}

      {(importResult || importLoading) && (
        <>
          <SectionTitle>Import result</SectionTitle>
          <div style={resultCard}>
            {importLoading ? (
              <p style={resultText}>Sending rows to server…</p>
            ) : importResult?.error ? (
              <>
                <p style={resultError}>Import failed.</p>
                <pre style={resultPre}>{importResult.detail}</pre>
                <p style={resultMeta}>
                  Total rows: {importResult.totalRows} · Successful:{" "}
                  {importResult.successful} · Skipped: {importResult.skipped}
                </p>
              </>
            ) : (
              <>
                <p style={resultOk}>Import finished.</p>
                <ul style={resultList}>
                  <li>Total rows in file: {importResult.totalRows}</li>
                  <li>Imported (sent): {importResult.successful}</li>
                  <li>Skipped: {importResult.skipped}</li>
                </ul>
                {importResult.serverMessage && (
                  <p style={resultMeta}>{importResult.serverMessage}</p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ step, title, description, children }) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <div style={stepBadge}>{step}</div>
        <div>
          <h3 style={cardTitle}>{title}</h3>
          <p style={desc}>{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function MappingSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={select}
      >
        <option value="" disabled>
          Select column…
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function MappingSelectOptional({
  label,
  value,
  options,
  onChange,
  emptyLabel,
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={select}
      >
        <option value="">{emptyLabel}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

const sectionTitle = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 12px 0",
  paddingBottom: "6px",
  borderBottom: "2px solid #E5E7EB",
};

const savedScriptHint = {
  fontSize: "0.9rem",
  color: "#4B5563",
  lineHeight: 1.55,
  marginTop: 0,
  marginBottom: "16px",
};

const mutedP = {
  fontSize: "0.9rem",
  color: "#6B7280",
  marginBottom: "20px",
};

const savedTableToolbar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "10px",
};

const savedTableMeta = {
  fontSize: "0.88rem",
  fontWeight: 700,
  color: "#1E293B",
};

const savedMetaRow = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
};

const savedDubPill = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "5px 10px",
  borderRadius: "999px",
  background: "#EEF2FF",
  color: "#4338CA",
  border: "1px solid #C7D2FE",
};

const savedTableScroll = {
  maxHeight: "min(400px, 48vh)",
  overflow: "auto",
  border: "1px solid #E2E8F0",
  borderRadius: "16px",
  background: "#fff",
  marginBottom: "24px",
  boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  scrollbarWidth: "thin",
  scrollbarColor: "#CBD5E1 #F1F5F9",
};

const savedTable = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.88rem",
  tableLayout: "fixed",
};

const savedTh = {
  textAlign: "left",
  padding: "12px 14px",
  background: "linear-gradient(180deg, #F1F5F9 0%, #E8EEF5 100%)",
  color: "#475569",
  fontWeight: 700,
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "2px solid #C7D2FE",
  position: "sticky",
  top: 0,
  zIndex: 2,
  boxShadow: "0 1px 0 rgba(199,210,254,0.5)",
};

const savedTd = {
  padding: "12px 14px",
  borderBottom: "1px solid #EEF2F6",
  color: "#0F172A",
  verticalAlign: "top",
  wordBreak: "break-word",
};

const savedTdNum = {
  fontWeight: 700,
  color: "#64748B",
  fontVariantNumeric: "tabular-nums",
};

const savedCharPill = {
  display: "inline-block",
  maxWidth: "100%",
  padding: "5px 11px",
  borderRadius: "999px",
  fontSize: "0.78rem",
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const savedTdTr = {
  lineHeight: 1.55,
  color: "#334155",
};

const savedTdSy = {
  lineHeight: 1.65,
  fontWeight: 500,
  background: "rgba(248,250,252,0.6)",
};

const savedTdSyEmpty = {
  color: "#94A3B8",
  fontStyle: "italic",
  fontWeight: 400,
};

const savedSyPlaceholder = {
  fontSize: "0.82rem",
};

const savedLineTranslateBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "7px 11px",
  borderRadius: "10px",
  border: "1px solid #C7D2FE",
  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#4338CA",
  fontSize: "0.72rem",
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit",
};

const clearLinesBtn = {
  marginTop: "12px",
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid #B45309",
  background: "#fff",
  color: "#92400E",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
};

const wrapper = {
  width: "100%",
  maxWidth: "100%",
  margin: "0 auto",
  padding: "0 0 32px",
  boxSizing: "border-box",
};

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "20px",
  marginBottom: "22px",
  boxShadow: "0 3px 10px rgba(0,0,0,0.03)",
};

const cardHeader = {
  display: "flex",
  gap: "14px",
  marginBottom: "14px",
  alignItems: "center",
};

const cardTitle = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 600,
};

const stepBadge = {
  width: "30px",
  height: "30px",
  borderRadius: "999px",
  background: "#2563EB",
  color: "#ffffff",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.85rem",
};

const desc = {
  fontSize: "0.85rem",
  color: "#6B7280",
  marginTop: "4px",
};

const uploadBox = {
  padding: "18px",
  border: "2px dashed #cbd5e1",
  borderRadius: "12px",
  background: "#f8fafc",
  textAlign: "center",
};

const uploadLabel = {
  display: "inline-block",
  padding: "8px 16px",
  background: "#2563EB",
  color: "#ffffff",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.85rem",
};

const fileInfo = {
  marginTop: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const fileHint = {
  fontSize: "0.8rem",
  color: "#10B981",
};

const linkButton = {
  marginTop: "14px",
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "0.85rem",
  color: "#2563EB",
  cursor: "pointer",
  textDecoration: "underline",
};

const loadingHint = {
  fontSize: "0.85rem",
  color: "#6B7280",
  marginBottom: "10px",
};

const badgeRow = {
  marginBottom: "12px",
};

const matchBadge = {
  display: "inline-block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#1D4ED8",
  background: "#EFF6FF",
  padding: "6px 12px",
  borderRadius: "999px",
};

const warnBox = {
  background: "#FFFBEB",
  border: "1px solid #FCD34D",
  borderRadius: "10px",
  padding: "12px 14px",
  marginBottom: "14px",
};

const warnLine = {
  fontSize: "0.85rem",
  color: "#92400E",
  marginBottom: "6px",
};

const addUnknownCharPrompt = {
  marginTop: "8px",
  paddingTop: "10px",
  borderTop: "1px dashed rgba(245,158,11,0.35)",
};

const addUnknownCharTitle = {
  fontSize: "0.85rem",
  fontWeight: 700,
  color: "#7C2D12",
  marginBottom: "10px",
};

const addUnknownCharSub = {
  fontSize: "0.8rem",
  color: "#9A3412",
  lineHeight: 1.45,
  marginBottom: "12px",
};

const addUnknownCharButtons = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const choiceBtn = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(124,45,18,0.18)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontWeight: 700,
  fontSize: "0.85rem",
  transition: "all 0.15s ease",
};

const choiceBtnIdle = {
  background: "#fff",
  color: "#7C2D12",
};

const choiceBtnActiveYes = {
  background: "rgba(124,45,18,0.08)",
  color: "#7C2D12",
  borderColor: "rgba(245,158,11,0.6)",
  boxShadow: "0 6px 18px rgba(245,158,11,0.10)",
};

const choiceBtnActiveNo = {
  background: "rgba(245,158,11,0.18)",
  color: "#7C2D12",
  borderColor: "rgba(245,158,11,0.55)",
};

const importCountHint = {
  marginTop: "12px",
  fontSize: "0.82rem",
  color: "#78350F",
  lineHeight: 1.45,
};

const tableWrap = {
  overflowX: "auto",
  borderRadius: "14px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  padding: "12px 14px",
  textAlign: "left",
  background: "linear-gradient(180deg, #F1F5F9 0%, #E8EEF5 100%)",
  color: "#475569",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "2px solid #C7D2FE",
};

const tr = {
  transition: "background 0.15s ease",
};

const td = {
  padding: "12px 14px",
  borderBottom: "1px solid #EEF2F6",
  fontSize: "0.9rem",
  color: "#111827",
  verticalAlign: "top",
};

const mappingGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "18px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "0.8rem",
  fontWeight: 500,
  color: "#374151",
};

const select = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "0.85rem",
  background: "#ffffff",
  color: "#111827",
};

const confirmWrap = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: "20px",
};

const confirmRightCol = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "8px",
  maxWidth: "420px",
  textAlign: "right",
};

const confirmImportHint = {
  margin: 0,
  fontSize: "0.8rem",
  color: "#64748B",
  lineHeight: 1.45,
};

const primaryBtn = {
  padding: "10px 20px",
  borderRadius: "10px",
  border: "none",
  fontWeight: 600,
  fontSize: "0.9rem",
  transition: "all 0.2s ease",
};

const activeBtn = {
  background: "#2563EB",
  color: "#ffffff",
  cursor: "pointer",
};

const disabledBtn = {
  background: "#9CA3AF",
  color: "#ffffff",
  cursor: "not-allowed",
};

const resultCard = {
  background: "#F9FAFB",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  padding: "18px 20px",
  marginBottom: "24px",
};

const resultText = { margin: 0, color: "#374151", fontSize: "0.95rem" };
const resultOk = {
  margin: "0 0 8px 0",
  fontWeight: 600,
  color: "#047857",
  fontSize: "1rem",
};
const resultError = {
  margin: "0 0 8px 0",
  fontWeight: 600,
  color: "#B91C1C",
  fontSize: "1rem",
};
const resultMeta = {
  margin: "8px 0 0 0",
  fontSize: "0.85rem",
  color: "#6B7280",
};
const resultList = {
  margin: 0,
  paddingLeft: "20px",
  color: "#374151",
  fontSize: "0.9rem",
  lineHeight: 1.6,
};
const resultPre = {
  fontSize: "0.75rem",
  background: "#fff",
  padding: "10px",
  borderRadius: "8px",
  overflow: "auto",
  maxHeight: "120px",
};
