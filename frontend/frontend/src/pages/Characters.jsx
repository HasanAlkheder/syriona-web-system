import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  User,
  UserPlus,
  X,
  ArrowLeft,
  Save,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";

import { apiFetch } from "../api/client";

function rowKey(c) {
  if (c.isDraft) return `draft-${c._draftKey}`;
  return `id-${c.id}`;
}

function getGenderStyle(gender) {
  const g = String(gender ?? "").toLowerCase();
  if (g === "male") {
    return { bg: "#DBEAFE", color: "#1D4ED8" };
  }
  if (g === "female") {
    return { bg: "#FCE7F3", color: "#BE185D" };
  }
  /* other, others, non-binary, unknown, empty → amber */
  return { bg: "#FEF9C3", color: "#92400E" };
}

/** Canonical values for API: male | female | other */
function normalizeGenderApi(raw) {
  const g = String(raw ?? "").trim().toLowerCase();
  if (["male", "m", "man", "erkek", "bay"].includes(g)) return "male";
  if (
    ["female", "f", "woman", "kadın", "kadin", "bayan", "girl", "kız", "kiz"].includes(
      g
    )
  ) {
    return "female";
  }
  if (
    [
      "other",
      "others",
      "non-binary",
      "nonbinary",
      "nb",
      "unspecified",
      "unknown",
      "n/a",
      "na",
      "—",
      "-",
    ].includes(g) ||
    !g
  ) {
    return "other";
  }
  return "other";
}

function genderDisplayLabel(stored) {
  const v = normalizeGenderApi(stored);
  if (v === "male") return "Male";
  if (v === "female") return "Female";
  return "Others";
}

export default function CharactersPage({ onNext, onBack, projectId }) {
  const [characters, setCharacters] = useState([]);
  const [tagInputs, setTagInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("other");
  const [editTagsText, setEditTagsText] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const editTargetRef = useRef(null);
  const editNameRef = useRef("");
  editTargetRef.current = editTarget;
  editNameRef.current = editName;

  const fetchCharacters = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await apiFetch(`/characters/project/${projectId}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const normalized = data.map((c) => ({
        ...c,
        isDraft: false,
        gender: normalizeGenderApi(c.gender),
        description: Array.isArray(c.description) ? c.description : [],
      }));
      setCharacters(normalized);
    } catch (err) {
      console.error("Fetch error:", err);
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const closeEditModal = useCallback(() => {
    if (editLoading) return;
    const t = editTargetRef.current;
    if (t?.isDraft && !(t.name || "").trim()) {
      const k = rowKey(t);
      setCharacters((prev) => prev.filter((ch) => rowKey(ch) !== k));
    }
    setEditTarget(null);
  }, [editLoading]);

  useEffect(() => {
    function onEsc(e) {
      if (e.key !== "Escape") return;
      if (editTargetRef.current) closeEditModal();
      setDeleteTarget(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [closeEditModal]);

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split("\n");
      const parsed = rows
        .slice(1)
        .map((row) => {
          if (!row.trim()) return null;
          const cols = row.split(",");
          const name = cols[0]?.trim();
          const gender = cols[1]?.trim();
          const descriptionRaw = cols[2]?.trim();
          if (!name) return null;
          return {
            isDraft: true,
            _draftKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name,
            gender: normalizeGenderApi(gender),
            description: descriptionRaw
              ? descriptionRaw.split("|").map((t) => t.trim()).filter(Boolean)
              : [],
          };
        })
        .filter(Boolean);
      setCharacters(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function addTag(c, value) {
    if (!value?.trim()) return;
    const k = rowKey(c);
    setCharacters((prev) =>
      prev.map((ch) =>
        rowKey(ch) === k
          ? { ...ch, description: [...(ch.description || []), value.trim()] }
          : ch
      )
    );
    setTagInputs((prev) => ({ ...prev, [k]: "" }));
  }

  function removeTag(c, tagIndex) {
    const k = rowKey(c);
    setCharacters((prev) =>
      prev.map((ch) => {
        if (rowKey(ch) !== k) return ch;
        const next = [...(ch.description || [])];
        next.splice(tagIndex, 1);
        return { ...ch, description: next };
      })
    );
  }

  async function handleSave() {
    if (!projectId || characters.length === 0) return;
    const toSave = characters.filter((c) => (c.name || "").trim());
    if (toSave.length === 0) {
      alert("Add a name for each character (or remove empty rows) before saving.");
      return;
    }
    if (toSave.length < characters.length) {
      if (
        !window.confirm(
          "Some rows have no name and will not be saved. Continue with the rest?"
        )
      ) {
        return;
      }
    }
    try {
      setSaving(true);
      const res = await apiFetch(`/characters/`, {
        method: "POST",
        body: JSON.stringify(
          toSave.map((c) => ({
            name: c.name.trim(),
            gender: normalizeGenderApi(c.gender),
            description: c.description || [],
            project_id: projectId,
          }))
        ),
      });
      if (!res.ok) throw new Error(String(res.status));
      await fetchCharacters();
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save characters");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(c) {
    setEditTarget(c);
    setEditName(c.name || "");
    setEditGender(normalizeGenderApi(c.gender));
    setEditTagsText((c.description || []).join(" | "));
  }

  function addManualCharacter() {
    if (!projectId) return;
    const draft = {
      isDraft: true,
      _draftKey: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: "",
      gender: "other",
      description: [],
    };
    setCharacters((prev) => [...prev, draft]);
    setEditTarget(draft);
    setEditName("");
    setEditGender("other");
    setEditTagsText("");
  }

  async function saveEdit() {
    if (!editTarget || !editName.trim()) return;
    const tags = editTagsText
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean);

    if (editTarget.isDraft) {
      const k = rowKey(editTarget);
      setCharacters((prev) =>
        prev.map((ch) =>
          rowKey(ch) === k
            ? {
                ...ch,
                name: editName.trim(),
                gender: normalizeGenderApi(editGender),
                description: tags,
              }
            : ch
        )
      );
      setEditTarget(null);
      return;
    }

    setEditLoading(true);
    try {
      const res = await apiFetch(`/characters/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          gender: normalizeGenderApi(editGender),
          description: tags,
        }),
      });
      if (!res.ok) {
        alert("Could not update character");
        return;
      }
      setEditTarget(null);
      await fetchCharacters();
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setEditLoading(false);
    }
  }

  const deleteMatches =
    deleteTarget &&
    deleteConfirm.trim() === String(deleteTarget.name || "").trim();

  async function confirmDelete() {
    if (!deleteTarget || !deleteMatches) return;

    if (deleteTarget.isDraft) {
      const k = rowKey(deleteTarget);
      setCharacters((prev) => prev.filter((ch) => rowKey(ch) !== k));
      setDeleteTarget(null);
      setDeleteConfirm("");
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/characters/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("Could not delete character");
        return;
      }
      setDeleteTarget(null);
      setDeleteConfirm("");
      await fetchCharacters();
    } catch (e) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  const draftCount = characters.filter((c) => c.isDraft).length;

  return (
    <div style={page}>
      {typeof onBack === "function" && (
        <button type="button" onClick={onBack} style={backBtn}>
          <ArrowLeft size={18} />
          Back to project
        </button>
      )}

      <header style={hero}>
        <div style={heroText}>
          <div style={heroIcon}>
            <Users size={26} color="#4338CA" />
          </div>
          <div>
            <h1 style={title}>Characters</h1>
            <p style={subtitle}>
              Import a CSV (name, gender: male / female / others, tags), add
              single characters with <strong>Add character</strong>, refine tags,
              then save. Used when matching script lines to voices.
            </p>
            {draftCount > 0 && (
              <span style={draftPill}>
                {draftCount} unsaved (CSV or new)
              </span>
            )}
          </div>
        </div>
        <div style={heroActions}>
          <label style={uploadBtn}>
            <Upload size={18} />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
          <button
            type="button"
            style={{
              ...addCharacterBtn,
              opacity: !projectId || loading ? 0.55 : 1,
              cursor: !projectId || loading ? "not-allowed" : "pointer",
            }}
            disabled={!projectId || loading}
            onClick={addManualCharacter}
          >
            <UserPlus size={18} />
            Add character
          </button>
          <button
            type="button"
            disabled={characters.length === 0 || saving}
            style={{
              ...saveBtn,
              opacity: characters.length === 0 || saving ? 0.5 : 1,
            }}
            onClick={handleSave}
          >
            <Save size={18} />
            {saving ? "Saving…" : "Save to project"}
          </button>
          {typeof onNext === "function" && (
            <button
              type="button"
              style={continueBtn}
              onClick={onNext}
            >
              Continue
            </button>
          )}
        </div>
      </header>

      <div style={tableWrap}>
        <div style={tableHead}>
          <div style={{ ...th, flex: 1.1 }}>Name</div>
          <div style={{ ...th, width: 130 }}>Gender</div>
          <div style={{ ...th, flex: 2 }}>Description tags</div>
          <div style={{ ...th, width: 108, textAlign: "right" }}>Actions</div>
        </div>

        <div style={tableBody}>
          {loading && (
            <div style={emptyState}>Loading characters…</div>
          )}

          {!loading && characters.length === 0 && (
            <div style={emptyBox}>
              <User size={40} color="#94A3B8" />
              <p style={emptyTitle}>No characters yet</p>
              <p style={emptySub}>
                Use <strong>Import CSV</strong> with columns: name, gender
                (male, female, others), tags (use | between tags).
              </p>
            </div>
          )}

          {!loading &&
            characters.map((c) => {
              const k = rowKey(c);
              const gs = getGenderStyle(c.gender);
              return (
                <div key={k} style={row}>
                  <div style={{ ...nameCell, flex: 1.1 }}>
                    <div
                      style={{
                        ...avatar,
                        background: gs.bg,
                        color: gs.color,
                      }}
                    >
                      <User size={18} />
                    </div>
                    <div>
                      <span style={{ ...nameText, ...(!c.name?.trim() ? namePlaceholder : {}) }}>
                        {c.name?.trim()
                          ? c.name
                          : c.isDraft
                            ? "New character…"
                            : "—"}
                      </span>
                      {c.isDraft && (
                        <span style={draftBadge}>Draft</span>
                      )}
                    </div>
                  </div>
                  <div style={{ width: 130 }}>
                    <span
                      style={{
                        ...genderPill,
                        background: gs.bg,
                        color: gs.color,
                      }}
                    >
                      {genderDisplayLabel(c.gender)}
                    </span>
                  </div>
                  <div style={{ flex: 2 }}>
                    <div style={tagsContainer}>
                      {(c.description || []).map((tag, tagIndex) => (
                        <span key={tagIndex} style={tagStyle}>
                          {tag}
                          <button
                            type="button"
                            style={tagRemove}
                            onClick={() => removeTag(c, tagIndex)}
                            aria-label="Remove tag"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      <input
                        value={tagInputs[k] || ""}
                        placeholder="Add tag, Enter"
                        style={tagInput}
                        onChange={(e) =>
                          setTagInputs((prev) => ({
                            ...prev,
                            [k]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag(c, tagInputs[k]);
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ ...actionsCell, width: 108 }}>
                    <button
                      type="button"
                      style={iconBtn}
                      title="Edit"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      style={iconBtnDanger}
                      title="Delete"
                      onClick={() => {
                        setDeleteTarget(c);
                        setDeleteConfirm("");
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div
          style={modalOverlay}
          onClick={() => !editLoading && closeEditModal()}
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>
              <h3 style={modalTitle}>
                {editTarget.isDraft && !(editTarget.name || "").trim()
                  ? "Add character"
                  : "Edit character"}
              </h3>
              <button
                type="button"
                style={modalClose}
                disabled={editLoading}
                onClick={closeEditModal}
              >
                <X size={20} />
              </button>
            </div>
            <label style={label}>Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={input}
            />
            <label style={label}>Gender</label>
            <select
              value={editGender}
              onChange={(e) => setEditGender(e.target.value)}
              style={input}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Others</option>
            </select>
            <label style={label}>Tags (use | between)</label>
            <textarea
              value={editTagsText}
              onChange={(e) => setEditTagsText(e.target.value)}
              style={textarea}
              rows={3}
            />
            <div style={modalActions}>
              <button
                type="button"
                style={btnNeutral}
                disabled={editLoading}
                onClick={closeEditModal}
              >
                Cancel
              </button>
              <button
                type="button"
                style={btnPrimary}
                disabled={!editName.trim() || editLoading}
                onClick={saveEdit}
              >
                {editLoading
                  ? "Saving…"
                  : editTarget.isDraft && !(editTarget.name || "").trim()
                    ? "Add"
                    : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div
          style={modalOverlayDark}
          onClick={() => !deleteLoading && setDeleteTarget(null)}
        >
          <div style={deleteCard} onClick={(e) => e.stopPropagation()}>
            <div style={deleteIconWrap}>
              <Trash2 size={26} color="#DC2626" />
            </div>
            <h3 style={deleteTitle}>Delete character?</h3>
            <p style={deleteText}>
              {deleteTarget.isDraft
                ? "This row is only in memory (not saved yet)."
                : "This removes the character from the project database."}
            </p>
            <p style={deleteHint}>
              Type the character name to confirm:{" "}
              <strong>{deleteTarget.name}</strong>
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              style={deleteInput}
              placeholder="Character name"
            />
            <div style={modalActions}>
              <button
                type="button"
                style={btnNeutral}
                disabled={deleteLoading}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                style={btnDanger}
                disabled={!deleteMatches || deleteLoading}
                onClick={confirmDelete}
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const page = {
  maxWidth: "1000px",
  margin: "0 auto",
  padding: "8px 4px 40px",
};

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "none",
  border: "none",
  color: "#2563EB",
  cursor: "pointer",
  fontSize: "0.92rem",
  fontWeight: 600,
  marginBottom: "20px",
  padding: "4px 0",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  padding: "26px 28px",
  borderRadius: "20px",
  background: "linear-gradient(120deg, #EEF2FF 0%, #FAF5FF 50%, #F0FDFA 100%)",
  border: "1px solid #E2E8F0",
  marginBottom: "24px",
  boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
};

const heroText = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
  flex: "1 1 280px",
};

const heroIcon = {
  width: "52px",
  height: "52px",
  borderRadius: "14px",
  background: "#E0E7FF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const title = {
  fontSize: "1.75rem",
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

const draftPill = {
  display: "inline-block",
  marginTop: "10px",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  padding: "5px 10px",
  borderRadius: "999px",
  background: "#FEF3C7",
  color: "#B45309",
};

const heroActions = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  alignItems: "center",
};

const uploadBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 18px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.9rem",
  boxShadow: "0 6px 18px rgba(37,99,235,0.3)",
};

const addCharacterBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 18px",
  borderRadius: "12px",
  border: "2px solid #6366F1",
  background: "#fff",
  color: "#4338CA",
  fontWeight: 600,
  fontSize: "0.9rem",
  fontFamily: "inherit",
  boxShadow: "0 2px 10px rgba(67,56,202,0.12)",
};

const saveBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  background: "#059669",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.9rem",
};

const continueBtn = {
  padding: "12px 18px",
  borderRadius: "12px",
  border: "2px solid #CBD5E1",
  background: "#fff",
  color: "#475569",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.9rem",
};

const tableWrap = {
  background: "#fff",
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  overflow: "hidden",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
};

const tableHead = {
  display: "flex",
  alignItems: "center",
  padding: "0 16px",
  background: "linear-gradient(180deg, #F1F5F9 0%, #E8EEF5 100%)",
  color: "#334155",
  borderBottom: "2px solid #C7D2FE",
};

const th = {
  padding: "14px 12px",
  fontSize: "0.78rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#475569",
};

const tableBody = {
  maxHeight: "min(480px, 55vh)",
  overflowY: "auto",
};

const row = {
  display: "flex",
  alignItems: "center",
  padding: "14px 16px",
  borderBottom: "1px solid #F1F5F9",
  gap: "8px",
};

const nameCell = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: 0,
};

const avatar = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const nameText = {
  fontWeight: 700,
  color: "#0F172A",
  fontSize: "0.95rem",
};

const namePlaceholder = {
  color: "#94A3B8",
  fontWeight: 600,
  fontStyle: "italic",
};

const draftBadge = {
  display: "block",
  marginTop: "4px",
  fontSize: "0.65rem",
  fontWeight: 700,
  color: "#B45309",
  textTransform: "uppercase",
};

const genderPill = {
  display: "inline-block",
  padding: "5px 12px",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "capitalize",
};

const tagsContainer = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "6px",
  border: "1px solid #E2E8F0",
  padding: "8px 10px",
  borderRadius: "10px",
  background: "#F8FAFC",
  minHeight: "42px",
};

const tagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  padding: "4px 8px",
  background: "#E0E7FF",
  color: "#3730A3",
  borderRadius: "999px",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const tagRemove = {
  border: "none",
  background: "none",
  padding: 0,
  cursor: "pointer",
  color: "#6366F1",
  display: "flex",
  alignItems: "center",
};

const tagInput = {
  border: "none",
  outline: "none",
  fontSize: "0.85rem",
  background: "transparent",
  color: "#0F172A",
  minWidth: "100px",
  flex: 1,
};

const actionsCell = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "6px",
};

const iconBtn = {
  padding: "8px 10px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
  display: "flex",
};

const iconBtnDanger = {
  ...iconBtn,
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#B91C1C",
};

const emptyState = {
  padding: "48px 24px",
  textAlign: "center",
  color: "#64748B",
};

const emptyBox = {
  padding: "48px 24px",
  textAlign: "center",
};

const emptyTitle = {
  fontSize: "1.05rem",
  fontWeight: 700,
  color: "#475569",
  margin: "12px 0 6px",
};

const emptySub = {
  fontSize: "0.9rem",
  color: "#94A3B8",
  margin: 0,
  lineHeight: 1.5,
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  backdropFilter: "blur(4px)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const modalOverlayDark = {
  ...modalOverlay,
  background: "rgba(15,23,42,0.55)",
};

const modalCard = {
  background: "#fff",
  borderRadius: "18px",
  padding: "28px",
  width: "100%",
  maxWidth: "420px",
  boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
  border: "1px solid #E2E8F0",
};

const deleteCard = {
  ...modalCard,
  border: "1px solid #FECACA",
};

const modalHead = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "18px",
};

const modalTitle = {
  margin: 0,
  fontSize: "1.2rem",
  fontWeight: 800,
  color: "#0F172A",
};

const modalClose = {
  border: "none",
  background: "none",
  cursor: "pointer",
  color: "#94A3B8",
};

const label = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "6px",
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  fontSize: "0.95rem",
  marginBottom: "16px",
  boxSizing: "border-box",
  background: "#F8FAFC",
  color: "#0F172A",
};

const textarea = {
  ...input,
  minHeight: "80px",
  resize: "vertical",
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "8px",
};

const btnNeutral = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid #E2E8F0",
  background: "#F1F5F9",
  fontWeight: 600,
  color: "#475569",
  cursor: "pointer",
};

const btnPrimary = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const btnDanger = {
  ...btnPrimary,
  background: "#DC2626",
};

const deleteIconWrap = {
  width: "48px",
  height: "48px",
  borderRadius: "12px",
  background: "#FEF2F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px",
};

const deleteTitle = {
  margin: "0 0 8px",
  fontSize: "1.15rem",
  fontWeight: 800,
  color: "#991B1B",
};

const deleteText = {
  margin: "0 0 10px",
  fontSize: "0.88rem",
  color: "#475569",
  lineHeight: 1.5,
};

const deleteHint = {
  margin: "0 0 8px",
  fontSize: "0.82rem",
  color: "#64748B",
};

const deleteInput = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "2px solid #E2E8F0",
  fontSize: "0.95rem",
  marginBottom: "16px",
  boxSizing: "border-box",
};
