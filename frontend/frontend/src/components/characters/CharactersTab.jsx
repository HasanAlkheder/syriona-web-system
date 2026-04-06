import { useState, useMemo } from "react";

export default function CharactersTab({ onContinue }) {
  const [characters, setCharacters] = useState([
    { id: 1, name: "Ali", gender: "Male", lines: 24 },
    { id: 2, name: "Ayşe", gender: "Female", lines: 18 },
    { id: 3, name: "Mehmet", gender: "", lines: 7 },
  ]);

  function updateGender(id, value) {
    setCharacters(prev =>
      prev.map(c =>
        c.id === id ? { ...c, gender: value } : c
      )
    );
  }

  const missingCount = useMemo(
    () => characters.filter(c => !c.gender).length,
    [characters]
  );

  const allAssigned = missingCount === 0;

  return (
    <div style={container}>
      {/* Header */}
      <div style={header}>
        <div>
          <h3 style={title}>Character Configuration</h3>
          <p style={subtitle}>
            Assign gender to ensure accurate dubbing adaptation.
          </p>
        </div>

        {missingCount > 0 && (
          <span style={warningBadge}>
            {missingCount} Missing
          </span>
        )}
      </div>

      {/* Table */}
      <div style={card}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Character</th>
              <th style={th}>Gender</th>
              <th style={thRight}>Lines</th>
            </tr>
          </thead>

          <tbody>
            {characters.map(char => (
              <tr key={char.id} style={tr}>
                <td style={tdName}>{char.name}</td>

                <td style={td}>
                  <select
                    value={char.gender}
                    onChange={(e) =>
                      updateGender(char.id, e.target.value)
                    }
                    style={{
                      ...select,
                      ...(char.gender === ""
                        ? selectWarning
                        : {}),
                    }}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="other">Others</option>
                  </select>
                </td>

                <td style={tdRight}>
                  <span style={linesBadge}>
                    {char.lines}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={footer}>
        {!allAssigned && (
          <span style={helperText}>
            Please assign gender for all characters.
          </span>
        )}

        <button
          disabled={!allAssigned}
          onClick={onContinue}
          style={{
            ...primaryBtn,
            ...(allAssigned ? {} : disabledBtn),
          }}
        >
          Continue to Dubbing →
        </button>
      </div>
    </div>
  );
}

/* ================= Styles ================= */

const container = {
  maxWidth: "920px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "18px",
};

const title = {
  fontSize: "1.35rem",
  fontWeight: 700,
  color: "#111827",
};

const subtitle = {
  fontSize: "1rem",
  color: "#6B7280",
  marginTop: "6px",
};

const warningBadge = {
  background: "#FEF3C7",
  color: "#92400E",
  padding: "6px 14px",
  borderRadius: "999px",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const card = {
  background: "#ffffff",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  overflow: "hidden",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  padding: "18px 20px",
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "#374151",
  textAlign: "left",
  borderBottom: "1px solid #E5E7EB",
};


const thRight = {
  ...th,
  textAlign: "right",
};

const tr = {
  borderBottom: "1px solid #F1F5F9",
};

const td = {
  padding: "20px 20px",
  fontSize: "1.05rem",
  color: "#111827",
};


const tdName = {
  padding: "20px 20px",
  fontSize: "1.2rem",
  fontWeight: 700,
  color: "#111827",
};


const tdRight = {
  padding: "18px 20px",
  textAlign: "right",
};

const select = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#111827",
};


const selectWarning = {
  borderColor: "#F59E0B",
  background: "#FFFBEB",
};

const linesBadge = {
  background: "#E5E7EB",
  padding: "6px 14px",
  borderRadius: "999px",
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "#111827",
};


const footer = {
  marginTop: "20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const helperText = {
  fontSize: "0.95rem",
  color: "#DC2626",
};

const primaryBtn = {
  background: "#2563EB",
  color: "#ffffff",
  border: "none",
  padding: "12px 22px",
  borderRadius: "12px",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const disabledBtn = {
  background: "#9CA3AF",
  cursor: "not-allowed",
};
