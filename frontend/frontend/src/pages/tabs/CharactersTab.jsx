import { useState } from "react";

export default function CharactersTab({
  characters,
  setCharacters,
  onContinue,
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("male");
  const [style, setStyle] = useState("");
  const [notes, setNotes] = useState("");

  function addCharacter() {
    if (!name.trim()) return;

    if (
      characters.some(
        (c) =>
          c.name.toLowerCase() === name.trim().toLowerCase()
      )
    ) {
      alert("Character already exists.");
      return;
    }

    setCharacters([
      ...characters,
      {
        id: Date.now(),
        name: name.trim(),
        gender,
        style: style.trim(),
        notes: notes.trim(),
      },
    ]);

    setName("");
    setGender("male");
    setStyle("");
    setNotes("");
  }

  function removeCharacter(id) {
    setCharacters(characters.filter((c) => c.id !== id));
  }

  return (
    <div>
      {/* ===== Title ===== */}
      <h2
        style={{
          fontSize: "1.4rem",
          fontWeight: 600,
          color: "#111827",
          marginBottom: "20px",
        }}
      >
        Characters
      </h2>

      {/* ===== Add Character Box ===== */}
      <div
        style={{
          background: "#ffffff",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "180px 120px 200px 1fr auto",
            gap: "12px",
          }}
        >
          <input
            placeholder="Character name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />

          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={inputStyle}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <input
            placeholder="Voice style (calm, angry...)"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            style={inputStyle}
          />

          <input
            placeholder="Notes for voice actor (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={inputStyle}
          />

          <button
            onClick={addCharacter}
            style={addButtonStyle}
          >
            Add
          </button>
        </div>
      </div>

      {/* ===== Characters Grid ===== */}
      {characters.length === 0 ? (
        <div
          style={{
            color: "#6b7280",
            fontSize: "0.95rem",
            marginBottom: "24px",
          }}
        >
          No characters added yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {characters.map((c) => (
            <div
              key={`${c.id}-${index}`}
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  color: "#111827",
                  marginBottom: "6px",
                }}
              >
                {c.name}
              </div>

              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  marginBottom: "8px",
                }}
              >
                {c.gender} ·{" "}
                {c.style || "Default voice"}
              </div>

              {c.notes && (
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "#374151",
                    marginBottom: "12px",
                  }}
                >
                  📝 {c.notes}
                </div>
              )}

              <button
                onClick={() => removeCharacter(c.id)}
                style={removeButtonStyle}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===== Continue ===== */}
      <button
        onClick={onContinue}
        disabled={characters.length === 0}
        style={{
          padding: "12px 22px",
          borderRadius: "10px",
          border: "none",
          background:
            characters.length === 0
              ? "#9CA3AF"
              : "#2563EB",
          color: "#ffffff",
          fontWeight: 600,
          cursor:
            characters.length === 0
              ? "not-allowed"
              : "pointer",
        }}
      >
        Continue to Script
      </button>
    </div>
  );
}

/* ===== Styles ===== */
const inputStyle = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",          // ✅ FIX: input text is black
  fontSize: "0.9rem",
};

const addButtonStyle = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "none",
  background: "#2563EB",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};

const removeButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#DC2626",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontWeight: 600,
};
