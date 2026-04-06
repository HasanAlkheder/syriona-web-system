import { useRef } from "react";
import * as XLSX from "xlsx";

export default function ScriptTab({
  characters,
  scriptLines,
  setScriptLines,
  onContinue,
}) {
  const fileInputRef = useRef(null);

  const characterNames = characters.map((c) =>
    c.name.toLowerCase()
  );

  const invalidLines = scriptLines.filter(
    (l) =>
      l.character &&
      !characterNames.includes(l.character.toLowerCase())
  );

  /* ===== CSV ===== */
  function parseCSV(text) {
    const rows = text.split("\n").filter(Boolean);
    const headers = rows[0]
      .split(",")
      .map((h) => h.trim().toLowerCase());

    const charIdx = headers.indexOf("character");
    const textIdx = headers.indexOf("turkish");

    if (charIdx === -1 || textIdx === -1) {
      alert("Required columns: character, turkish");
      return [];
    }

    return rows.slice(1).map((r, i) => {
      const cols = r.split(",");
      return {
        id: i + 1,
        character: cols[charIdx]?.trim(),
        turkish: cols[textIdx]?.trim(),
      };
    });
  }

  /* ===== Excel ===== */
  function parseExcel(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, {
        type: "binary",
      });
      const sheet =
        wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      setScriptLines(
        rows.map((r, i) => ({
          id: i + 1,
          character:
            r.character || r.Character || "",
          turkish: r.turkish || r.Turkish || "",
        }))
      );
    };
    reader.readAsBinaryString(file);
  }

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setScriptLines(parseCSV(ev.target.result));
      reader.readAsText(file);
    } else if (
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
    ) {
      parseExcel(file);
    } else {
      alert("Unsupported file format");
    }
  }

  const canContinue =
    scriptLines.length > 0 &&
    invalidLines.length === 0;

  return (
    <div>
      <h2 style={title}>Script Upload</h2>

      {/* Upload */}
      <div style={uploadBox}>
        <button
          onClick={() =>
            fileInputRef.current.click()
          }
          style={primaryBtn}
        >
          Choose File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleUpload}
          hidden
        />
        <div style={hint}>
          CSV / Excel — columns: character, turkish
        </div>
      </div>

      {/* TABLE */}
      {scriptLines.length > 0 && (
        <div style={tableWrapper}>
          <div style={scrollBox}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Character</th>
                  <th style={th}>Turkish</th>
                </tr>
              </thead>
              <tbody>
                {scriptLines.map((l) => {
                  const invalid =
                    l.character &&
                    !characterNames.includes(
                      l.character.toLowerCase()
                    );

                  return (
                    <tr key={l.id}>
                      <td style={tdMuted}>
                        {l.id}
                      </td>
                      <td
                        style={{
                          ...td,
                          color: invalid
                            ? "#DC2626"
                            : "#2563EB",
                          fontWeight: 600,
                        }}
                      >
                        {l.character}
                      </td>
                      <td style={td}>
                        {l.turkish}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WARNING */}
      {invalidLines.length > 0 && (
        <div style={warning}>
          ⚠ {invalidLines.length} lines
          reference characters not defined in
          Characters tab.  
          Please define them before continuing.
        </div>
      )}

      {/* CONTINUE */}
      <button
        onClick={canContinue ? onContinue : undefined}
        disabled={!canContinue}
        title={
          !canContinue
            ? "Fix undefined characters first"
            : ""
        }
        style={{
          ...continueBtn,
          background: canContinue
            ? "#16A34A"
            : "#9CA3AF",
          cursor: canContinue
            ? "pointer"
            : "not-allowed",
        }}
      >
        Continue to Dubbing
      </button>
    </div>
  );
}

/* ===== Styles ===== */
const title = {
  fontSize: "1.4rem",
  fontWeight: 600,
  marginBottom: "16px",
  color: "#111827",
};

const uploadBox = {
  border: "2px dashed #c7d2fe",
  background: "#EEF2FF",
  borderRadius: "14px",
  padding: "24px",
  textAlign: "center",
  marginBottom: "24px",
};

const hint = {
  fontSize: "0.8rem",
  color: "#4b5563",
  marginTop: "10px",
};

const tableWrapper = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  marginBottom: "16px",
};

const scrollBox = {
  maxHeight: "340px",
  overflowY: "auto",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.85rem",
};

const th = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e7eb",
  color: "#374151",
};

const td = {
  padding: "8px 12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
};

const tdMuted = {
  ...td,
  color: "#9CA3AF",
};

const warning = {
  background: "#FEF3C7",
  border: "1px solid #FDE68A",
  borderRadius: "10px",
  padding: "12px",
  color: "#92400E",
  fontSize: "0.85rem",
  marginBottom: "16px",
};

const primaryBtn = {
  padding: "10px 18px",
  borderRadius: "8px",
  border: "none",
  background: "#2563EB",
  color: "#fff",
  fontWeight: 600,
};

const continueBtn = {
  padding: "12px 22px",
  borderRadius: "10px",
  border: "none",
  color: "#fff",
  fontWeight: 600,
};
