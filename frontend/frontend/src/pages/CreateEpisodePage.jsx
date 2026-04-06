import { useState } from "react";

/**
 * CreateEpisodePage
 * - Creates a new episode inside a project
 * - UI only (no backend yet)
 */
export default function CreateEpisodePage({ onCreate, onCancel }) {
  const [episodeName, setEpisodeName] = useState("");
  const [notes, setNotes] = useState("");

  function handleCreate() {
    if (!episodeName.trim()) return;

    // Later: send to backend
    onCreate({
      id: `ep-${Date.now()}`,
      name: episodeName.trim(),
      notes,
    });
  }

  return (
    <div>
      {/* ===== Title ===== */}
      <h2 style={title}>Create New Episode</h2>

      {/* ===== Form Card ===== */}
      <div style={card}>
        {/* Episode Name */}
        <label style={label}>Episode Name</label>
        <input
          placeholder="Episode 12"
          value={episodeName}
          onChange={(e) => setEpisodeName(e.target.value)}
          style={input}
        />

        {/* Notes */}
        <label style={label}>Notes (optional)</label>
        <textarea
          placeholder="Any notes for this episode…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          style={{ ...input, resize: "vertical" }}
        />

        {/* Actions */}
        <div style={actions}>
          <button onClick={onCancel} style={secondaryBtn}>
            Cancel
          </button>

          <button
            onClick={handleCreate}
            disabled={!episodeName.trim()}
            style={{
              ...primaryBtn,
              background: episodeName.trim()
                ? "#2563EB"
                : "#9CA3AF",
              cursor: episodeName.trim()
                ? "pointer"
                : "not-allowed",
            }}
          >
            Create Episode
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Styles ================= */

const title = {
  fontSize: "1.5rem",
  fontWeight: 600,
  color: "#111827",
  marginBottom: "20px",
};

const card = {
  maxWidth: "520px",
  background: "#ffffff",
  padding: "24px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
};

const label = {
  display: "block",
  marginBottom: "6px",
  marginTop: "14px",
  fontSize: "0.9rem",
  fontWeight: 500,
  color: "#374151",
};

const input = {
  width: "100%",
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: "0.9rem",
  outline: "none",
  boxSizing: "border-box",
};

const actions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "24px",
};

const primaryBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  color: "#ffffff",
  fontWeight: 600,
};

const secondaryBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#374151",
  fontWeight: 500,
  cursor: "pointer",
};
