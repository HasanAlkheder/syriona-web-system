import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Table2 } from "lucide-react";

import { apiFetch } from "../api/client";

function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Aligns with Characters page: male | female | other */
function normalizeGenderApi(raw) {
  const g = String(raw ?? "").trim().toLowerCase();
  if (["male", "m", "man", "erkek", "bay"].includes(g)) return "male";
  if (
    [
      "female",
      "f",
      "woman",
      "kadın",
      "kadin",
      "bayan",
      "girl",
      "kız",
      "kiz",
    ].includes(g)
  ) {
    return "female";
  }
  return "other";
}

function genderExportLabel(stored) {
  const v = normalizeGenderApi(stored);
  if (v === "male") return "Male";
  if (v === "female") return "Female";
  return "Others";
}

function getGenderPillStyle(genderNorm) {
  const g = String(genderNorm ?? "").toLowerCase();
  if (g === "male") {
    return { color: "#1D4ED8", background: "#EFF6FF", border: "1px solid #BFDBFE" };
  }
  if (g === "female") {
    return { color: "#BE185D", background: "#FCE7F3", border: "1px solid #FBCFE8" };
  }
  return { color: "#92400E", background: "#FEF9C3", border: "1px solid #FDE047" };
}

const EXPORT_COLUMNS = [
  { key: "start_time", label: "Start time", fileHeader: "start_time" },
  { key: "end_time", label: "End time", fileHeader: "end_time" },
  { key: "character", label: "Character", fileHeader: "character" },
  { key: "gender", label: "Gender", fileHeader: "gender" },
  { key: "source_tr", label: "Turkish", fileHeader: "turkish" },
  { key: "dub_sy", label: "Syrian Arabic", fileHeader: "syrian_arabic" },
];

const DEFAULT_EXPORT_COLS = Object.fromEntries(
  EXPORT_COLUMNS.map((c) => [c.key, true])
);

function previewGridTemplateColumns(columns) {
  return columns
    .map((c) => {
      if (c.key === "start_time" || c.key === "end_time") {
        return "minmax(88px, 0.55fr)";
      }
      if (c.key === "character" || c.key === "gender") {
        return "minmax(0, 0.8fr)";
      }
      if (c.key === "source_tr") return "minmax(0, 1.15fr)";
      if (c.key === "dub_sy") return "minmax(0, 1fr)";
      return "minmax(0, 1fr)";
    })
    .join(" ");
}

function exportFieldValue(row, colKey) {
  switch (colKey) {
    case "start_time":
      return row.start_time || "";
    case "end_time":
      return row.end_time || "";
    case "character":
      return row.character || "";
    case "gender":
      return genderExportLabel(row.genderRaw);
    case "source_tr":
      return row.source_tr || "";
    case "dub_sy":
      return row.dub_sy || "";
    default:
      return "";
  }
}

function toCsv(rows, defs) {
  const header = defs.map((d) => d.fileHeader);
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      defs.map((d) => escapeCsvCell(exportFieldValue(r, d.key))).join(",")
    ),
  ];
  return "\uFEFF" + lines.join("\r\n");
}

function exportRowMatchesSearch(row, qLower) {
  if (!qLower) return true;
  const blob = [
    row.character,
    row.source_tr,
    row.dub_sy,
    row.start_time,
    row.end_time,
    genderExportLabel(row.genderRaw),
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ");
  return blob.includes(qLower);
}

export default function ExportTab({ episodeId, headerSearchQuery = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState("csv");
  const [exportCols, setExportCols] = useState(() => ({ ...DEFAULT_EXPORT_COLS }));

  const loadLines = useCallback(async () => {
    if (episodeId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/sentences/episode/${episodeId}`);
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : [];
      setRows(
        list.map((s) => ({
          id: s.id,
          character: s.character_name || "—",
          genderRaw: s.gender,
          genderNorm: normalizeGenderApi(s.gender),
          source_tr: s.source_text || "",
          dub_sy: s.translation || "",
          start_time: s.start_time || "",
          end_time: s.end_time || "",
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  const readyCount = useMemo(
    () => rows.filter((r) => String(r.dub_sy || "").trim().length > 0).length,
    [rows]
  );

  const characterSummary = useMemo(() => {
    const names = [...new Set(rows.map((r) => r.character).filter(Boolean))];
    return names.length ? names.join(", ") : "—";
  }, [rows]);

  const visibleExportColumns = useMemo(
    () => EXPORT_COLUMNS.filter((c) => exportCols[c.key]),
    [exportCols]
  );

  const exportColumnCount = visibleExportColumns.length;

  const headerSearchLower = useMemo(
    () => String(headerSearchQuery ?? "").trim().toLowerCase(),
    [headerSearchQuery]
  );

  const previewRows = useMemo(
    () => rows.filter((r) => exportRowMatchesSearch(r, headerSearchLower)),
    [rows, headerSearchLower]
  );

  function toggleExportCol(key) {
    setExportCols((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!EXPORT_COLUMNS.some((c) => next[c.key])) {
        return prev;
      }
      return next;
    });
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExport() {
    if (rows.length === 0 || exportColumnCount === 0) return;

    const defs = visibleExportColumns;
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `episode-${episodeId ?? "export"}-${stamp}`;

    if (format === "csv") {
      const csv = toCsv(rows, defs);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });
      downloadBlob(`${base}.csv`, blob);
      return;
    }

    const sheet = XLSX.utils.json_to_sheet(
      rows.map((r) => {
        const o = {};
        for (const d of defs) {
          o[d.fileHeader] = exportFieldValue(r, d.key);
        }
        return o;
      })
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Dubbing");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    downloadBlob(
      `${base}.xlsx`,
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );
  }

  const exportLabel =
    format === "csv" ? "Download CSV" : "Download Excel (.xlsx)";

  const allReady = rows.length > 0 && readyCount === rows.length;

  return (
    <div style={wrap}>
      <div style={hero}>
        <div style={heroText}>
          <div style={heroIcon}>
            <Download size={24} color="#4338CA" />
          </div>
          <div>
            <h2 style={title}>Export</h2>
            <p style={subtitle}>
              Download the approved dubbing script for production. Pick CSV or
              Excel, choose which columns to include, then export.
            </p>
          </div>
        </div>
        <div
          style={{
            ...statusPill,
            ...(allReady ? statusPillOk : statusPillWarn),
          }}
        >
          {loading
            ? "Loading…"
            : `${readyCount} / ${rows.length} lines with Arabic`}
        </div>
      </div>

      <div style={card}>
        <div style={section}>
          <h3 style={sectionTitle}>Summary</h3>
          <div style={summaryGrid}>
            <SummaryItem
              label="Input / output lines"
              value={
                loading ? "—" : `${rows.length}/${readyCount}`
              }
              valueStyle={summaryRatioFigures}
              detail="Input lines · output lines"
              tint="indigo"
            />
            <SummaryItem
              label="Language"
              value="Syrian Arabic"
              tint="teal"
            />
            <SummaryItem
              label="Characters"
              value={characterSummary}
              tint="violet"
            />
          </div>
        </div>

        <div style={section}>
          <h3 style={sectionTitle}>Export format</h3>
          <p style={formatHint}>
            Choose a format — no dark system menu; your pick is highlighted
            below.
          </p>
          <div style={formatToggle} role="group" aria-label="Export format">
            <button
              type="button"
              onClick={() => setFormat("csv")}
              style={{
                ...formatBtn,
                ...(format === "csv" ? formatBtnActive : formatBtnIdle),
              }}
            >
              <Table2 size={18} />
              CSV (UTF-8)
            </button>
            <button
              type="button"
              onClick={() => setFormat("xlsx")}
              style={{
                ...formatBtn,
                ...(format === "xlsx" ? formatBtnActive : formatBtnIdle),
              }}
            >
              <FileSpreadsheet size={18} />
              Excel (.xlsx)
            </button>
          </div>
        </div>

        <div style={section}>
          <h3 style={sectionTitle}>Columns to export</h3>
          <p style={formatHint}>
            Turn fields on or off — the preview and downloaded file use the same
            selection. At least one column must stay on.
          </p>
          <div
            style={columnPickWrap}
            role="group"
            aria-label="Columns to include in export"
          >
            {EXPORT_COLUMNS.map((c) => (
              <label key={c.key} style={columnPickLabel}>
                <input
                  type="checkbox"
                  checked={Boolean(exportCols[c.key])}
                  onChange={() => toggleExportCol(c.key)}
                  style={columnPickInput}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={section}>
          <div style={previewSectionHead}>
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Preview</h3>
            {!loading && rows.length > 0 && (
              <span style={previewMeta}>
                {headerSearchLower
                  ? `${previewRows.length} shown · ${rows.length} total`
                  : `${rows.length} line${rows.length === 1 ? "" : "s"}`}{" "}
                — scroll inside the box (export still includes all lines)
              </span>
            )}
          </div>
          {loading ? (
            <p style={previewMuted}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={previewMuted}>
              No lines for this episode. Finish Dubbing and confirm, or import a
              script first.
            </p>
          ) : previewRows.length === 0 && headerSearchLower ? (
            <p style={previewMuted}>
              No lines match your header search. Clear the search to preview all
              lines.
            </p>
          ) : (
            <div className="export-preview-scroll" style={previewScrollOuter}>
              <div style={previewInner}>
                <PreviewHeader
                  columns={visibleExportColumns}
                  gridTpl={previewGridTemplateColumns(visibleExportColumns)}
                />
                {previewRows.map((r, idx) => (
                  <PreviewRow
                    key={r.id}
                    row={r}
                    columns={visibleExportColumns}
                    gridTpl={previewGridTemplateColumns(visibleExportColumns)}
                    zebra={idx % 2 === 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={footer}>
          <button
            type="button"
            style={{
              ...exportBtn,
              opacity: rows.length === 0 || exportColumnCount === 0 ? 0.5 : 1,
              boxShadow:
                rows.length === 0 || exportColumnCount === 0
                  ? "none"
                  : "0 8px 24px rgba(37, 99, 235, 0.35)",
            }}
            disabled={rows.length === 0 || exportColumnCount === 0}
            onClick={handleExport}
          >
            <Download size={20} />
            {exportLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, tint, detail, valueStyle }) {
  const box =
    tint === "teal"
      ? summaryBoxTeal
      : tint === "violet"
        ? summaryBoxViolet
        : summaryBoxIndigo;
  return (
    <div style={{ ...summaryBox, ...box }}>
      <div style={summaryLabel}>{label}</div>
      <div style={{ ...summaryValue, ...valueStyle }}>{value}</div>
      {detail ? <div style={summaryDetail}>{detail}</div> : null}
    </div>
  );
}

function headStyleForColumn(key) {
  if (key === "character") return headCellChar;
  if (key === "gender") return headCellGender;
  if (key === "source_tr") return headCellTr;
  if (key === "dub_sy") return headCellSy;
  if (key === "start_time" || key === "end_time") return headCellTime;
  return headCellNeutral;
}

function PreviewHeader({ columns, gridTpl }) {
  if (columns.length === 0) {
    return (
      <div style={{ ...previewHeadRow, gridTemplateColumns: "1fr" }}>
        <span style={headCellNeutral}>Select at least one column above.</span>
      </div>
    );
  }
  return (
    <div style={{ ...previewHeadRow, gridTemplateColumns: gridTpl }}>
      {columns.map((c) => (
        <span key={c.key} style={headStyleForColumn(c.key)}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function PreviewRow({ row, columns, gridTpl, zebra }) {
  if (columns.length === 0) {
    return null;
  }
  const charPillDyn = {
    ...charPill,
    ...getGenderPillStyle(row.genderNorm),
  };
  return (
    <div
      style={{
        ...rowGrid,
        gridTemplateColumns: gridTpl,
        background: zebra ? "#F8FAFC" : "#FFFFFF",
      }}
    >
      {columns.map((c) => {
        if (c.key === "character") {
          return (
            <span key={c.key} style={charPillDyn}>
              {row.character}
            </span>
          );
        }
        if (c.key === "gender") {
          return (
            <span key={c.key} style={genderPillPreview}>
              {genderExportLabel(row.genderRaw)}
            </span>
          );
        }
        if (c.key === "source_tr") {
          return (
            <span key={c.key} style={trText}>
              {row.source_tr}
            </span>
          );
        }
        if (c.key === "dub_sy") {
          return (
            <span key={c.key} style={syText}>
              {row.dub_sy || "—"}
            </span>
          );
        }
        const t = row[c.key] || "—";
        return (
          <span key={c.key} style={timeText}>
            {t}
          </span>
        );
      })}
    </div>
  );
}

const wrap = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  margin: "0 auto",
  paddingBottom: "32px",
  boxSizing: "border-box",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "24px",
  padding: "22px 24px",
  borderRadius: "20px",
  background: "linear-gradient(120deg, #EEF2FF 0%, #FAF5FF 45%, #F0FDFA 100%)",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const heroText = {
  display: "flex",
  gap: "14px",
  alignItems: "flex-start",
  flex: "1 1 280px",
};

const heroIcon = {
  width: "48px",
  height: "48px",
  borderRadius: "14px",
  background: "#E0E7FF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const title = {
  fontSize: "1.6rem",
  fontWeight: 800,
  color: "#0F172A",
  margin: 0,
  letterSpacing: "-0.02em",
};

const subtitle = {
  fontSize: "0.92rem",
  color: "#64748B",
  marginTop: "8px",
  lineHeight: 1.55,
  maxWidth: "520px",
};

const statusPill = {
  fontSize: "0.82rem",
  fontWeight: 700,
  padding: "10px 16px",
  borderRadius: "999px",
  flexShrink: 0,
  alignSelf: "center",
};

const statusPillOk = {
  background: "#DCFCE7",
  color: "#166534",
  border: "1px solid #86EFAC",
};

const statusPillWarn = {
  background: "#FEF3C7",
  color: "#92400E",
  border: "1px solid #FCD34D",
};

const card = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "28px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflowX: "hidden",
};

const section = {
  marginBottom: "28px",
};

const sectionTitle = {
  fontSize: "1.05rem",
  fontWeight: 700,
  color: "#1E293B",
  marginBottom: "12px",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "14px",
};

const summaryBox = {
  borderRadius: "14px",
  padding: "16px 18px",
  border: "1px solid transparent",
};

const summaryBoxIndigo = {
  background: "linear-gradient(145deg, #EEF2FF 0%, #E0E7FF 100%)",
  borderColor: "#C7D2FE",
};

const summaryBoxTeal = {
  background: "linear-gradient(145deg, #ECFEFF 0%, #CCFBF1 100%)",
  borderColor: "#99F6E4",
};

const summaryBoxViolet = {
  background: "linear-gradient(145deg, #FAF5FF 0%, #F3E8FF 100%)",
  borderColor: "#E9D5FF",
};

const summaryLabel = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748B",
  marginBottom: "6px",
};

const summaryValue = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#0F172A",
  lineHeight: 1.45,
  wordBreak: "break-word",
  overflowWrap: "anywhere",
};

/** Prominent ratio for input/output line counts (e.g. 10/10). */
const summaryRatioFigures = {
  fontSize: "1.35rem",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.02em",
};

const summaryDetail = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#64748B",
  marginTop: "6px",
  lineHeight: 1.4,
};

const formatHint = {
  fontSize: "0.85rem",
  color: "#64748B",
  margin: "0 0 14px 0",
  lineHeight: 1.5,
};

const formatToggle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
};

const formatBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  padding: "14px 22px",
  borderRadius: "14px",
  fontSize: "0.95rem",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  transition: "transform 0.15s ease, box-shadow 0.2s ease",
  border: "2px solid #E2E8F0",
};

const formatBtnIdle = {
  background: "#FFFFFF",
  color: "#475569",
  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
};

const formatBtnActive = {
  background: "linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)",
  color: "#FFFFFF",
  borderColor: "#4338CA",
  boxShadow: "0 8px 24px rgba(67, 56, 202, 0.35)",
};

const previewSectionHead = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "12px",
};

const previewMeta = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#6366F1",
  background: "#EEF2FF",
  padding: "6px 12px",
  borderRadius: "999px",
};

const previewMuted = {
  color: "#64748B",
  fontSize: "0.95rem",
};

const previewScrollOuter = {
  maxHeight: "min(420px, 52vh)",
  overflow: "auto",
  overflowX: "auto",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  background: "#F1F5F9",
  boxShadow: "inset 0 1px 3px rgba(15,23,42,0.06)",
  scrollbarWidth: "thin",
  scrollbarColor: "#CBD5E1 #F1F5F9",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const previewInner = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
};

const previewHeadRow = {
  display: "grid",
  gap: "12px",
  padding: "12px 16px",
  position: "sticky",
  top: 0,
  zIndex: 2,
  background: "linear-gradient(180deg, #F1F5F9 0%, #E8EEF5 100%)",
  borderBottom: "2px solid #C7D2FE",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#475569",
};

const headCellChar = { color: "#4338CA" };
const headCellGender = { color: "#A21CAF" };
const headCellTr = { color: "#0D9488" };
const headCellSy = { color: "#7C3AED", textAlign: "right" };
const headCellTime = { color: "#0F766E", fontVariantNumeric: "tabular-nums" };
const headCellNeutral = { color: "#475569" };

const columnPickWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px 22px",
  alignItems: "center",
};

const columnPickLabel = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#334155",
  cursor: "pointer",
  userSelect: "none",
};

const columnPickInput = {
  width: "18px",
  height: "18px",
  accentColor: "#4F46E5",
  cursor: "pointer",
};

const genderPillPreview = {
  fontWeight: 600,
  fontSize: "0.8rem",
  color: "#57534E",
  background: "#F5F5F4",
  border: "1px solid #E7E5E4",
  padding: "6px 12px",
  borderRadius: "999px",
  justifySelf: "start",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const timeText = {
  fontSize: "0.82rem",
  color: "#0F172A",
  fontVariantNumeric: "tabular-nums",
  fontFamily: "ui-monospace, monospace",
  minWidth: 0,
  overflowWrap: "anywhere",
};

const rowGrid = {
  display: "grid",
  gap: "12px",
  padding: "12px 16px",
  borderBottom: "1px solid #E2E8F0",
  alignItems: "center",
};

const charPill = {
  fontWeight: 700,
  fontSize: "0.82rem",
  color: "#1D4ED8",
  background: "#EFF6FF",
  border: "1px solid #BFDBFE",
  padding: "6px 12px",
  borderRadius: "999px",
  justifySelf: "start",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trText = {
  fontSize: "0.88rem",
  color: "#334155",
  lineHeight: 1.5,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  minWidth: 0,
};

const syText = {
  fontSize: "0.88rem",
  color: "#0F172A",
  direction: "rtl",
  textAlign: "right",
  lineHeight: 1.55,
  fontWeight: 500,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  minWidth: 0,
};

const footer = {
  display: "flex",
  justifyContent: "flex-end",
  paddingTop: "8px",
};

const exportBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
  color: "#ffffff",
  border: "none",
  padding: "14px 26px",
  borderRadius: "14px",
  fontSize: "1rem",
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
};
