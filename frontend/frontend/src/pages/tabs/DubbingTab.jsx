import { useState } from "react";

export default function DubbingTab({ onContinue }) {
  const [lines, setLines] = useState([
    {
      id: 1,
      character: "Ali",
      turkish: "Ne yapıyorsun burada?",
      syrian: "شو عم تعمل هون؟",
    },
    {
      id: 2,
      character: "Zeynep",
      turkish: "Bunu sana söylemek zorundayım.",
      syrian: "لازم قلك هالشي.",
    },
  ]);

  function updateLine(id, value) {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, syrian: value } : l
      )
    );
  }

  return (
    <div>
      <h3 style={{ marginBottom: "16px", color: "#111827" }}>
        Dubbing Translation
      </h3>

      {/* Table Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "140px 1fr 1fr",
          gap: "12px",
          padding: "10px 14px",
          fontWeight: 600,
          fontSize: "0.9rem",
          color: "#111827", // BLACK titles
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div>Character</div>
        <div>Turkish</div>
        <div>Syrian (Editable)</div>
      </div>

      {/* Rows */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "10px",
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 1fr",
              gap: "12px",
              padding: "12px 14px",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            {/* Character */}
            <div
              style={{
                fontWeight: 600,
                color: "#111827", // BLACK character
              }}
            >
              {line.character}
            </div>

            {/* Turkish */}
            <div
              style={{
                fontSize: "0.9rem",
                color: "#111827",
              }}
            >
              {line.turkish}
            </div>

            {/* Syrian (Editable) */}
            <input
              value={line.syrian}
              onChange={(e) =>
                updateLine(line.id, e.target.value)
              }
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                color: "#111827",
                background: "#fff",
              }}
            />
          </div>
        ))}
      </div>

      {/* Continue */}
      <button
        onClick={onContinue}
        style={{
          marginTop: "24px",
          padding: "12px 22px",
          borderRadius: "10px",
          border: "none",
          background: "#16A34A",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.95rem",
        }}
      >
        Continue to Export →
      </button>
    </div>
  );
}
