// src/pages/UploadPage.jsx
import React, { useMemo, useState } from "react";
import FileUploader from "../components/FileUploader";

/* ---------- shared cell style ---------- */
const cellStyle = {
  padding: "0.75rem 0.9rem",
  borderBottom: "1px solid #eef2f7",
  verticalAlign: "top",
  whiteSpace: "normal",
  color: "#0A2540",
};

export default function UploadPage({ setColumns, selectedColumns }) {
  const [tableData, setTableData] = useState([]);
  const [preparedRows, setPreparedRows] = useState([]);
  const [translatedRows, setTranslatedRows] = useState([]);
  const [isTranslated, setIsTranslated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* -----------------------------
     Handle file upload
  ----------------------------- */
  function handleDataLoaded(data) {
    const safeData = Array.isArray(data) ? data : [];
    setTableData(safeData);
    setPreparedRows([]);
    setTranslatedRows([]);
    setIsTranslated(false);
    setError("");

    if (safeData.length > 0) {
      setColumns(Object.keys(safeData[0]));
    } else {
      setColumns([]);
    }
  }

  /* -----------------------------
     Mapping validation
  ----------------------------- */
  const isMappingReady = useMemo(() => {
    return Boolean(selectedColumns.gender && selectedColumns.turkish);
  }, [selectedColumns.gender, selectedColumns.turkish]);

  /* -----------------------------
     MOCK translation (DEMO)
  ----------------------------- */
  function mockTranslate(rows) {
    return rows.map((row, index) => ({
      ...row,
      syrian: `✨ Syrian demo translation #${index + 1}: ${row.turkish}`,
    }));
  }

  /* -----------------------------
     Prepare + DEMO translate
  ----------------------------- */
  function prepareForTranslation() {
    if (!tableData.length) {
      setError("Please upload a file first.");
      return;
    }

    if (!isMappingReady) {
      setError("Please select required columns.");
      return;
    }

    setLoading(true);
    setError("");
    setIsTranslated(false);

    const rows = tableData
      .map((row) => ({
        gender: row?.[selectedColumns.gender] ?? "",
        name: selectedColumns.name ? row?.[selectedColumns.name] ?? "" : "",
        turkish: row?.[selectedColumns.turkish] ?? "",
      }))
      .filter((r) => String(r.turkish).trim().length > 0);

    setPreparedRows(rows);

    const demoResults = mockTranslate(rows);
    setTranslatedRows(demoResults);
    setIsTranslated(true);

    setLoading(false);
  }

  /* -----------------------------
     Download CSV
  ----------------------------- */
  function downloadCSV(rows) {
    const header = ["Gender", "Name", "Turkish", "Syrian"];
    const csvContent = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.gender,
          r.name || "",
          `"${r.turkish.replace(/"/g, '""')}"`,
          `"${r.syrian.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "syriona_demo_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div>
      {/* ---------- Header ---------- */}
      <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#0A2540" }}>
        Upload File — Turkish → Syrian (Demo)
      </h2>

      <p style={{ fontSize: "0.9rem", color: "#4b5563", marginBottom: "1.2rem" }}>
        Upload CSV/XLSX, select required columns, and preview demo results.
      </p>

      {/* ---------- Actions ---------- */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <FileUploader onDataLoaded={handleDataLoaded} />

        <button
          onClick={prepareForTranslation}
          disabled={loading || !isMappingReady}
          style={{
            padding: "0.6rem 1rem",
            background: loading ? "#94a3b8" : "#0A2540",
            color: "#fff",
            borderRadius: "0.5rem",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Processing…" : "Prepare for Translation"}
        </button>

        {tableData.length > 0 && (
          <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
            {isMappingReady ? "✅ Mapping Ready" : "⚠ Select required columns"}
          </span>
        )}
      </div>

      {error && (
        <p style={{ color: "#b91c1c", marginTop: "0.8rem" }}>{error}</p>
      )}

      {/* ---------- Prepared JSON ---------- */}
      {preparedRows.length > 0 && (
        <pre
          style={{
            marginTop: "1.2rem",
            background: "#0A2540",
            color: "#F0F4F8",
            padding: "1rem",
            borderRadius: "0.75rem",
            maxHeight: "260px",
            overflow: "auto",
            fontSize: "0.85rem",
          }}
        >
{JSON.stringify(preparedRows, null, 2)}
        </pre>
      )}

      {/* ---------- Fancy Results Table ---------- */}
      {isTranslated && translatedRows.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <button
            onClick={() => downloadCSV(translatedRows)}
            style={{
              marginBottom: "1rem",
              padding: "0.6rem 1.2rem",
              background: "#0A2540",
              color: "#ffffff",
              borderRadius: "0.6rem",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            ⬇ Download Results (CSV)
          </button>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "1rem",
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                maxHeight: "420px",
                overflowY: "auto",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  minWidth: "900px",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f1f5f9",
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                    }}
                  >
                    {["Gender", "Name", "Turkish", "Syrian"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "0.9rem",
                          textAlign: "left",
                          fontWeight: 700,
                          color: "#0A2540",
                          borderBottom: "1px solid #e5e7eb",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {translatedRows.map((r, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
                      }}
                    >
                      <td style={cellStyle}>{r.gender}</td>
                      <td style={cellStyle}>{r.name || "—"}</td>
                      <td style={cellStyle}>{r.turkish}</td>
                      <td
                        style={{
                          ...cellStyle,
                          background: "#f0f9ff",
                          fontStyle: "italic",
                        }}
                      >
                        {r.syrian}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
