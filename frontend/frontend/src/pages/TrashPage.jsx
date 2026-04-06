import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  FolderOpen,
  RotateCcw,
  RefreshCw,
  X,
} from "lucide-react";

import { apiFetch } from "../api/client";
import { formatProjectDate, projectStatusLabel, projectStatusBadgeStyle } from "./projects";

export default function TrashPage({ onOpenProjects }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/projects/trash");
      const data = res.ok ? await res.json() : [];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  useEffect(() => {
    function onEsc(e) {
      if (e.key !== "Escape") return;
      if (!purgeLoading) {
        setPurgeTarget(null);
        setPurgeConfirm("");
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [purgeLoading]);

  async function handleRestore(projectId) {
    if (actionBusyId != null) return;
    setActionBusyId(projectId);
    try {
      const res = await apiFetch(`/projects/${projectId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not restore project");
        return;
      }
      await loadTrash();
    } catch (e) {
      alert(e?.message || "Restore failed");
    } finally {
      setActionBusyId(null);
    }
  }

  const purgeNameMatches =
    purgeTarget &&
    purgeConfirm.trim() === String(purgeTarget.name || "").trim();

  async function handlePurgeConfirm() {
    if (!purgeTarget || !purgeNameMatches || purgeLoading) return;
    setPurgeLoading(true);
    try {
      const res = await apiFetch(`/projects/${purgeTarget.id}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const d = err.detail;
        alert(
          typeof d === "string"
            ? d
            : `Could not delete permanently (HTTP ${res.status})`
        );
        return;
      }
      setPurgeTarget(null);
      setPurgeConfirm("");
      await loadTrash();
    } catch (e) {
      alert(e?.message || "Delete failed");
    } finally {
      setPurgeLoading(false);
    }
  }

  return (
    <div style={page}>
      <header style={hero}>
        <div style={heroIcon}>
          <Trash2 size={26} color="#BE123C" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={heroTitleRow}>
            <h1 style={title}>Trash</h1>
            <button
              type="button"
              style={refreshBtn}
              onClick={loadTrash}
              disabled={loading}
              aria-label="Refresh trash"
            >
              <RefreshCw
                size={18}
                style={{
                  animation: loading ? "spin 0.8s linear infinite" : "none",
                }}
              />
              Refresh
            </button>
          </div>
          <p style={subtitle}>
            Projects you remove from the project list are kept here until you
            restore them or delete them forever. Episodes and scripts stay with
            the project until permanent delete.
          </p>
          <p style={subtitleNote}>
            Projects deleted before soft-delete was enabled were removed from the
            database and cannot be shown here.
          </p>
        </div>
      </header>

      {loading && items.length === 0 ? (
        <p style={loadingText}>Loading trash…</p>
      ) : items.length === 0 ? (
        <div style={emptyCard}>
          <div style={emptyIconWrap}>
            <Trash2 size={36} color="#94A3B8" strokeWidth={1.75} />
          </div>
          <h2 style={emptyTitle}>Trash is empty</h2>
          <p style={emptyBody}>
            No deleted projects. When you delete a project from the Projects
            page, it will appear here instead of being removed immediately.
          </p>
        </div>
      ) : (
        <ul style={list}>
          {items.map((p) => (
            <li key={p.id} style={row}>
              <div style={rowMain}>
                <div style={rowTitle}>{p.name || "Untitled"}</div>
                <div style={rowMeta}>
                  <span
                    style={{
                      ...statusPill,
                      ...projectStatusBadgeStyle(p.status),
                    }}
                  >
                    {projectStatusLabel(p.status)}
                  </span>
                  <span style={metaSep}>·</span>
                  <span style={rowMetaMuted}>
                    Deleted {formatProjectDate(p.deleted_at)}
                  </span>
                </div>
              </div>
              <div style={rowActions}>
                <button
                  type="button"
                  style={restoreBtn}
                  disabled={actionBusyId != null}
                  onClick={() => handleRestore(p.id)}
                >
                  <RotateCcw size={16} />
                  Restore
                </button>
                <button
                  type="button"
                  style={dangerOutlineBtn}
                  disabled={actionBusyId != null}
                  onClick={() => {
                    setPurgeTarget({ id: p.id, name: p.name || "" });
                    setPurgeConfirm("");
                  }}
                >
                  Delete forever
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {typeof onOpenProjects === "function" && (
        <button type="button" style={secondaryBtn} onClick={onOpenProjects}>
          <FolderOpen size={18} />
          Back to projects
        </button>
      )}

      {purgeTarget && (
        <>
          <div style={modalOverlay} onClick={() => !purgeLoading && setPurgeTarget(null)} />
          <div style={modalWrap}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <h3 style={modalTitle}>Delete forever?</h3>
              <p style={modalText}>
                This permanently removes{" "}
                <strong>{purgeTarget.name || "Untitled"}</strong> and all
                episodes, characters, scripts, and translations. This cannot be
                undone.
              </p>
              <p style={modalHint}>
                Type the project name exactly to confirm.
              </p>
              <input
                value={purgeConfirm}
                onChange={(e) => setPurgeConfirm(e.target.value)}
                style={modalInput}
                placeholder="Project name"
                autoComplete="off"
              />
              <div style={modalActions}>
                <button
                  type="button"
                  style={ghostBtn}
                  disabled={purgeLoading}
                  onClick={() => {
                    setPurgeTarget(null);
                    setPurgeConfirm("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={dangerBtn}
                  disabled={!purgeNameMatches || purgeLoading}
                  onClick={handlePurgeConfirm}
                >
                  {purgeLoading ? "Deleting…" : "Delete forever"}
                </button>
              </div>
              <button
                type="button"
                style={modalClose}
                aria-label="Close"
                disabled={purgeLoading}
                onClick={() => {
                  setPurgeTarget(null);
                  setPurgeConfirm("");
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const page = {
  maxWidth: "720px",
};

const hero = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "24px",
};

const heroTitleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const heroIcon = {
  width: "52px",
  height: "52px",
  borderRadius: "14px",
  background: "linear-gradient(145deg, #FFE4E6 0%, #FECDD3 100%)",
  border: "1px solid #FDA4AF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const title = {
  margin: 0,
  fontSize: "1.65rem",
  fontWeight: 800,
  color: "#0F172A",
  letterSpacing: "-0.02em",
};

const refreshBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#475569",
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const subtitle = {
  margin: "8px 0 0",
  fontSize: "0.95rem",
  color: "#64748B",
  lineHeight: 1.55,
  maxWidth: "560px",
};

const subtitleNote = {
  margin: "10px 0 0",
  fontSize: "0.82rem",
  color: "#94A3B8",
  lineHeight: 1.45,
  maxWidth: "560px",
};

const loadingText = {
  color: "#64748B",
  fontSize: "0.95rem",
};

const emptyCard = {
  background: "#FFFFFF",
  borderRadius: "20px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 24px rgba(15, 23, 42, 0.06)",
  padding: "40px 32px",
  textAlign: "center",
  marginBottom: "20px",
};

const emptyIconWrap = {
  width: "72px",
  height: "72px",
  margin: "0 auto 20px",
  borderRadius: "18px",
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emptyTitle = {
  margin: "0 0 10px",
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "#334155",
};

const emptyBody = {
  margin: "0 auto",
  fontSize: "0.92rem",
  color: "#64748B",
  lineHeight: 1.6,
  maxWidth: "420px",
};

const list = {
  listStyle: "none",
  margin: "0 0 24px",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  flexWrap: "wrap",
  padding: "16px 18px",
  background: "#FFFFFF",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 2px 12px rgba(15, 23, 42, 0.04)",
};

const rowMain = {
  flex: 1,
  minWidth: "200px",
};

const rowTitle = {
  fontWeight: 700,
  fontSize: "1.02rem",
  color: "#0F172A",
  marginBottom: "6px",
};

const rowMeta = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
  fontSize: "0.8rem",
};

const statusPill = {
  fontSize: "0.68rem",
  padding: "4px 10px",
  borderRadius: "999px",
  fontWeight: 700,
};

const metaSep = { color: "#CBD5E1", fontWeight: 400 };

const rowMetaMuted = { color: "#64748B", fontWeight: 500 };

const rowActions = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
};

const restoreBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
  color: "#FFFFFF",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const dangerOutlineBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #FECACA",
  background: "#FEF2F2",
  color: "#B91C1C",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 22px",
  borderRadius: "12px",
  border: "1px solid #CBD5E1",
  background: "#FFFFFF",
  color: "#475569",
  fontWeight: 600,
  fontSize: "0.92rem",
  cursor: "pointer",
  fontFamily: "inherit",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.5)",
  zIndex: 1000,
};

const modalWrap = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1001,
  padding: "20px",
};

const modalCard = {
  position: "relative",
  background: "#FFFFFF",
  borderRadius: "16px",
  padding: "28px",
  maxWidth: "440px",
  width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
  border: "1px solid #FECACA",
};

const modalTitle = {
  margin: "0 0 12px",
  fontSize: "1.2rem",
  fontWeight: 800,
  color: "#991B1B",
};

const modalText = {
  margin: "0 0 12px",
  fontSize: "0.92rem",
  color: "#475569",
  lineHeight: 1.55,
};

const modalHint = {
  margin: "0 0 8px",
  fontSize: "0.85rem",
  color: "#64748B",
};

const modalInput = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "2px solid #E2E8F0",
  fontSize: "0.95rem",
  marginBottom: "20px",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  flexWrap: "wrap",
};

const ghostBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  color: "#475569",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const dangerBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#DC2626",
  color: "#FFFFFF",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const modalClose = {
  position: "absolute",
  top: "14px",
  right: "14px",
  border: "none",
  background: "transparent",
  color: "#94A3B8",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
};
