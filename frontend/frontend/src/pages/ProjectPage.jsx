import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Film,
  X,
  Users,
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  ArrowUpRight,
  List,
  Kanban,
  GripVertical,
  ClipboardList,
  Calendar,
  UserRound,
} from "lucide-react";

import { apiFetch } from "../api/client";
import AssigneeSelect, { memberLabel } from "../components/AssigneeSelect";
import WorkflowStatusSelect from "../components/WorkflowStatusSelect";
import {
  PROJECT_STATUS_OPTIONS,
  EPISODE_STATUS_OPTIONS,
  projectStatusBadgeStyle,
  episodeStatusBadgeStyle,
  formatProjectListDate,
  formatProjectDate,
} from "./projects";

const ACCENTS = [
  { bar: "#6366F1", soft: "#EEF2FF", icon: "#4338CA" },
  { bar: "#0D9488", soft: "#CCFBF1", icon: "#0F766E" },
  { bar: "#DB2777", soft: "#FCE7F3", icon: "#BE185D" },
  { bar: "#EA580C", soft: "#FFEDD5", icon: "#C2410C" },
];

const EPISODES_VIEW_STORAGE_PREFIX = "syriona-project-episodes-view-";

function readStoredEpisodesView(projectId) {
  try {
    const v = localStorage.getItem(`${EPISODES_VIEW_STORAGE_PREFIX}${projectId}`);
    return v === "kanban" ? "kanban" : "list";
  } catch {
    return "list";
  }
}

/** Board columns: New doubles as “not started” (no separate column). */
const EPISODE_KANBAN_COLUMNS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "on_hold", label: "On hold" },
];

const EPISODE_KANBAN_DOT = {
  new: "#6366F1",
  in_progress: "#CA8A04",
  done: "#16A34A",
  on_hold: "#EA580C",
};

function episodeKanbanBucketKey(status) {
  const s = String(status ?? "not_started").trim();
  if (s === "not_started") return "new";
  if (s === "new" || s === "in_progress" || s === "done" || s === "on_hold") {
    return s;
  }
  return "new";
}

export default function ProjectPage({
  projectId,
  headerSearchQuery = "",
  onOpenEpisode,
  onOpenCharacters,
  onBackToProjects,
}) {
  const [project, setProject] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [episodeName, setEpisodeName] = useState("");
  const [createEpisodeLoading, setCreateEpisodeLoading] = useState(false);

  const [editEp, setEditEp] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNum, setEditNum] = useState("");
  const [editStatus, setEditStatus] = useState("not_started");
  const [editAssignee, setEditAssignee] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteEp, setDeleteEp] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [statusSaving, setStatusSaving] = useState(false);
  const [episodeStatusSavingId, setEpisodeStatusSavingId] = useState(null);

  const [orgMembers, setOrgMembers] = useState([]);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  const [episodeAssigneeSavingId, setEpisodeAssigneeSavingId] = useState(null);

  const [episodesView, setEpisodesView] = useState(() =>
    readStoredEpisodesView(projectId)
  );
  const [episodeKanbanDragOver, setEpisodeKanbanDragOver] = useState(null);

  const nextEpisodePreviewStart = useMemo(() => {
    const nums = episodes.map((e) => Number(e.episode_number) || 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }, [episodes]);

  function countEpisodeLines(text) {
    return text
      .split(/\r\n|\r|\n/)
      .map((s) => s.trim())
      .filter(Boolean).length;
  }

  /** Collapse whitespace so confirm works when DB title has newlines / odd spaces */
  function normalizeEpisodeTitleForCompare(s) {
    return String(s ?? "")
      .normalize("NFC")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function episodeDeleteTitleMatches(input, storedTitle) {
    return (
      normalizeEpisodeTitleForCompare(input) ===
      normalizeEpisodeTitleForCompare(storedTitle)
    );
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, episodesRes] = await Promise.all([
        apiFetch(`/projects/${projectId}`),
        apiFetch(`/episodes/project/${projectId}`),
      ]);
      const projectData = projectRes.ok ? await projectRes.json() : null;
      const episodesData = episodesRes.ok ? await episodesRes.json() : [];
      setProject(projectData);
      setEpisodes(Array.isArray(episodesData) ? episodesData : []);
    } catch (err) {
      console.error("Failed to load data", err);
      setProject(null);
      setEpisodes([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setEpisodesView(readStoredEpisodesView(projectId));
  }, [projectId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `${EPISODES_VIEW_STORAGE_PREFIX}${projectId}`,
        episodesView
      );
    } catch {
      /* ignore */
    }
  }, [projectId, episodesView]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/users/");
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setOrgMembers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setOrgMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedEpisodes = useMemo(() => {
    const q = String(headerSearchQuery ?? "").trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter((ep) => {
      const title = String(ep.title ?? "").toLowerCase();
      const num = String(ep.episode_number ?? "");
      const st = String(ep.status ?? "").toLowerCase();
      const assignee = orgMembers.find(
        (m) => Number(m.id) === Number(ep.assigned_to_user_id)
      );
      const assigneeBlob = assignee
        ? memberLabel(assignee).toLowerCase()
        : "";
      return (
        title.includes(q) ||
        num.includes(q) ||
        st.includes(q) ||
        assigneeBlob.includes(q)
      );
    });
  }, [episodes, headerSearchQuery, orgMembers]);

  const displayedEpisodesByStatus = useMemo(() => {
    const map = {
      new: [],
      in_progress: [],
      done: [],
      on_hold: [],
    };
    for (const ep of displayedEpisodes) {
      map[episodeKanbanBucketKey(ep.status)].push(ep);
    }
    return map;
  }, [displayedEpisodes]);

  function beginEpisodeKanbanDrag(e, ep) {
    if (episodeStatusSavingId === ep.id) {
      e.preventDefault();
      return;
    }
    if (
      e.target.closest(
        "button, select, input, textarea, a[href], option, label, [role='listbox'], [role='option']"
      )
    ) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/x-syriona-episode", String(ep.id));
    e.dataTransfer.setData("text/plain", String(ep.id));
    e.dataTransfer.effectAllowed = "move";
  }

  useEffect(() => {
    function onEsc(e) {
      if (e.key !== "Escape") return;
      setShowCreateModal(false);
      setEditEp(null);
      setDeleteEp(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  async function handleCreateEpisode() {
    const lines = episodeName
      .split(/\r\n|\r|\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length === 0 || createEpisodeLoading) return;

    setCreateEpisodeLoading(true);
    try {
      const res = await apiFetch(`/episodes/bulk`, {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, titles: lines }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const msg = Array.isArray(detail)
          ? detail.map((x) => x?.msg || JSON.stringify(x)).join("\n")
          : typeof detail === "string"
            ? detail
            : `Could not create episodes (HTTP ${res.status})`;
        alert(msg);
        return;
      }
      setEpisodeName("");
      setShowCreateModal(false);
      await loadData();
    } catch (error) {
      console.error("Error creating episodes:", error);
      alert(error?.message || "Failed to create episodes");
    } finally {
      setCreateEpisodeLoading(false);
    }
  }

  function openEdit(ep) {
    setEditEp(ep);
    setEditTitle(ep.title || "");
    setEditNum(String(ep.episode_number ?? ""));
    setEditStatus(ep.status ?? "not_started");
    setEditAssignee(
      ep.assigned_to_user_id != null ? Number(ep.assigned_to_user_id) : null
    );
  }

  async function saveEdit() {
    if (!editEp || !editTitle.trim()) return;
    setEditLoading(true);
    try {
      const body = {
        title: editTitle.trim(),
        episode_number: editNum.trim()
          ? parseInt(editNum, 10)
          : editEp.episode_number,
        status: editStatus,
        assigned_to_user_id: editAssignee,
      };
      if (Number.isNaN(body.episode_number)) {
        body.episode_number = editEp.episode_number;
      }
      const res = await apiFetch(`/episodes/${editEp.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        alert("Could not update episode");
        return;
      }
      await res.json();
      setEditEp(null);
      await loadData();
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setEditLoading(false);
    }
  }

  const deleteMatches =
    deleteEp &&
    episodeDeleteTitleMatches(deleteConfirm, deleteEp.title);

  async function confirmDelete() {
    if (!deleteEp || !episodeDeleteTitleMatches(deleteConfirm, deleteEp.title)) {
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`/episodes/${deleteEp.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        alert(
          typeof detail === "string"
            ? detail
            : `Could not delete episode (HTTP ${res.status})`
        );
        return;
      }
      setEpisodes((prev) => prev.filter((e) => e.id !== deleteEp.id));
      setDeleteEp(null);
      setDeleteConfirm("");
    } catch (e) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleEpisodeStatusQuickChange(ep, nextStatus) {
    if (!ep || episodeStatusSavingId != null) return;
    const cur = ep.status ?? "not_started";
    if (nextStatus === cur) return;
    setEpisodeStatusSavingId(ep.id);
    try {
      const res = await apiFetch(`/episodes/${ep.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update episode status");
        return;
      }
      const updated = await res.json();
      setEpisodes((prev) =>
        prev.map((e) =>
          e.id === ep.id
            ? {
                ...e,
                status: updated.status ?? nextStatus,
                updated_at: updated.updated_at ?? e.updated_at,
              }
            : e
        )
      );
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setEpisodeStatusSavingId(null);
    }
  }

  async function handleProjectAssigneeChange(nextUserId) {
    if (!project || assigneeSaving) return;
    const cur =
      project.assigned_to_user_id != null
        ? Number(project.assigned_to_user_id)
        : null;
    const next = nextUserId != null ? Number(nextUserId) : null;
    if (cur === next) return;
    setAssigneeSaving(true);
    try {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to_user_id: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update assignee");
        return;
      }
      const updated = await res.json();
      setProject((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setAssigneeSaving(false);
    }
  }

  async function handleEpisodeAssigneeQuickChange(ep, nextUserId) {
    if (!ep || episodeAssigneeSavingId != null) return;
    const cur =
      ep.assigned_to_user_id != null ? Number(ep.assigned_to_user_id) : null;
    const next = nextUserId != null ? Number(nextUserId) : null;
    if (cur === next) return;
    setEpisodeAssigneeSavingId(ep.id);
    try {
      const res = await apiFetch(`/episodes/${ep.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to_user_id: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update assignee");
        return;
      }
      const updated = await res.json();
      setEpisodes((prev) =>
        prev.map((e) =>
          e.id === ep.id
            ? {
                ...e,
                assigned_to_user_id: updated.assigned_to_user_id ?? next,
                updated_at: updated.updated_at ?? e.updated_at,
              }
            : e
        )
      );
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setEpisodeAssigneeSavingId(null);
    }
  }

  async function handleProjectStatusChange(nextStatus) {
    if (!project || statusSaving) return;
    setStatusSaving(true);
    try {
      const res = await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update status");
        return;
      }
      const updated = await res.json();
      setProject((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleEpisodeKanbanDrop(episodeIdRaw, nextStatus) {
    const id = Number(episodeIdRaw);
    if (!Number.isFinite(id)) return;
    const ep = episodes.find((e) => e.id === id);
    if (!ep) return;
    await handleEpisodeStatusQuickChange(ep, nextStatus);
  }

  if (loading && !project) {
    return (
      <div style={loadingWrap}>
        <p style={loadingText}>Loading project…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={loadingWrap}>
        <p style={loadingText}>Project not found.</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      {typeof onBackToProjects === "function" && (
        <button
          type="button"
          onClick={onBackToProjects}
          style={backBtn}
        >
          <ArrowLeft size={18} />
          All projects
        </button>
      )}

      <header style={hero}>
        <div style={heroMain}>
          <h1 style={title}>{project.name}</h1>
          {project.description ? (
            <div style={{ marginTop: "6px" }}>
              <span style={abstractLabel}>Abstract</span>
              <p style={subtitle}>{project.description}</p>
            </div>
          ) : null}
          <div style={heroMetaPanel}>
            <div style={metaToolbar}>
              <div
                style={{ display: "inline-flex", maxWidth: "100%" }}
                title="Project workflow status"
              >
                <WorkflowStatusSelect
                  segmentedPrefix="Status"
                  value={project.status || "not_started"}
                  options={PROJECT_STATUS_OPTIONS}
                  onChange={handleProjectStatusChange}
                  disabled={statusSaving}
                  badgeStyleForValue={(v) => projectStatusBadgeStyle(v)}
                  ariaLabel="Change project status"
                />
              </div>
              <div
                style={{ display: "inline-flex", maxWidth: "100%", minWidth: "200px" }}
                title="Who owns this project"
              >
                <AssigneeSelect
                  id={`project-assign-${projectId}`}
                  label={null}
                  hideLabel
                  segmentedPrefix="Assign"
                  value={project.assigned_to_user_id}
                  members={orgMembers}
                  onChange={handleProjectAssigneeChange}
                  disabled={assigneeSaving}
                  style={{ gap: 0, flex: "1 1 auto", minWidth: 0 }}
                  selectStyle={{
                    minWidth: "168px",
                    opacity: assigneeSaving ? 0.65 : 1,
                  }}
                />
              </div>
              {project.source_language && project.target_language ? (
                <span style={metaPillLang}>
                  {project.source_language} → {project.target_language}
                </span>
              ) : null}
              {project.category ? (
                <span style={metaPillCategory}>{project.category}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div style={heroActions}>
          <button
            type="button"
            style={secondaryButton}
            onClick={onOpenCharacters}
          >
            <Users size={18} />
            Characters
          </button>
          <button
            type="button"
            style={primaryButton}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
            Add episodes
          </button>
        </div>
      </header>

      <section style={sectionLabel}>
        <div style={sectionLabelLeft}>
          <h2 style={sectionTitle}>Episodes</h2>
          <span style={sectionCount}>
            {headerSearchQuery.trim()
              ? `${displayedEpisodes.length} shown · ${episodes.length} total`
              : `${episodes.length} total`}
          </span>
        </div>
        {episodes.length > 0 ? (
          <div style={epViewToggleWrap} role="group" aria-label="Episodes layout">
            <button
              type="button"
              style={{
                ...epViewToggleBtn,
                ...(episodesView === "list" ? epViewToggleBtnActive : {}),
              }}
              onClick={() => setEpisodesView("list")}
              title="List view"
              aria-pressed={episodesView === "list"}
            >
              <List size={18} strokeWidth={2} aria-hidden />
              <span style={epViewToggleLabel}>List</span>
            </button>
            <button
              type="button"
              style={{
                ...epViewToggleBtn,
                ...(episodesView === "kanban" ? epViewToggleBtnActive : {}),
              }}
              onClick={() => setEpisodesView("kanban")}
              title="Board view"
              aria-pressed={episodesView === "kanban"}
            >
              <Kanban size={18} strokeWidth={2} aria-hidden />
              <span style={epViewToggleLabel}>Board</span>
            </button>
          </div>
        ) : null}
      </section>

      {displayedEpisodes.length > 0 && episodesView === "list" && (
        <div className="episodes-list-shell" style={epListShell}>
          <table
            className="episodes-table"
            style={epListTable}
            aria-label="Episodes list"
          >
            <colgroup>
              <col style={{ width: "36%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" style={epThFirst}>
                  Episode
                </th>
                <th scope="col" style={epTh}>
                  Status
                </th>
                <th scope="col" style={epTh}>
                  Assign to
                </th>
                <th scope="col" style={epTh}>
                  Dates
                </th>
                <th scope="col" style={epThActions}>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedEpisodes.map((ep, i) => {
                const a = ACCENTS[i % ACCENTS.length];
                return (
                  <tr key={ep.id} className="episodes-list-row">
                    <td
                      style={{ ...epTdEpisode, borderLeftColor: a.bar }}
                      title={ep.title || "Episode"}
                    >
                      <div style={epLineLead}>
                        <div
                          style={{
                            ...epLineIcon,
                            background: a.soft,
                            color: a.icon,
                          }}
                          aria-hidden
                        >
                          <Film size={15} strokeWidth={2} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={epLineTitle}>{ep.title}</div>
                          <div style={epLineNum}>
                            Episode {ep.episode_number ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={epTdMid}>
                      <div style={epListStatusCellInner}>
                        <WorkflowStatusSelect
                          value={ep.status ?? "not_started"}
                          options={EPISODE_STATUS_OPTIONS}
                          onChange={(v) =>
                            handleEpisodeStatusQuickChange(ep, v)
                          }
                          disabled={episodeStatusSavingId === ep.id}
                          badgeStyleForValue={(v) => episodeStatusBadgeStyle(v)}
                          ariaLabel={`Status for ${ep.title || "episode"}`}
                        />
                      </div>
                    </td>
                    <td style={epTdMid}>
                      <div style={epListAssignCellInner}>
                        <AssigneeSelect
                          id={`ep-assign-${ep.id}`}
                          label={null}
                          hideLabel
                          value={ep.assigned_to_user_id}
                          members={orgMembers}
                          onChange={(uid) =>
                            handleEpisodeAssigneeQuickChange(ep, uid)
                          }
                          disabled={episodeAssigneeSavingId === ep.id}
                          style={{ gap: 0 }}
                          selectStyle={{
                            ...epListAssigneeSelect,
                            minWidth: 0,
                            opacity:
                              episodeAssigneeSavingId === ep.id ? 0.65 : 1,
                            cursor:
                              episodeAssigneeSavingId === ep.id
                                ? "wait"
                                : "pointer",
                          }}
                        />
                      </div>
                    </td>
                    <td style={epTdMid}>
                      <div style={epListDatesStack}>
                        <div style={epListDateBlock}>
                          <span style={epListDateCap}>Created</span>
                          <span style={epListDateVal}>
                            {formatProjectListDate(ep.created_at)}
                          </span>
                        </div>
                        <div style={epListDateBlock}>
                          <span style={epListDateCap}>Updated</span>
                          <span style={epListDateVal}>
                            {formatProjectListDate(
                              ep.updated_at != null
                                ? ep.updated_at
                                : ep.created_at
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={epTdActions}>
                      <div style={epListActions}>
                        <button
                          type="button"
                          className="projects-list-open-btn"
                          onClick={() => onOpenEpisode?.(ep.id)}
                        >
                          <span className="projects-list-open-btn-label">
                            Open
                          </span>
                          <span
                            className="projects-list-open-btn-icon"
                            aria-hidden
                          >
                            <ArrowUpRight size={15} strokeWidth={2.35} />
                          </span>
                        </button>
                        <button
                          type="button"
                          className="projects-list-ghost-btn"
                          style={epRowIconBtn}
                          title="Rename"
                          onClick={() => openEdit(ep)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="projects-list-ghost-btn projects-list-ghost-btn--danger"
                          style={epRowIconBtnDanger}
                          title="Delete episode"
                          onClick={() => {
                            setDeleteEp(ep);
                            setDeleteConfirm("");
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {displayedEpisodes.length > 0 && episodesView === "kanban" && (
        <div
          className="episodes-kanban-board syriona-kanban-hscroll"
          style={epKanbanBoard}
          role="region"
          aria-label="Episodes by status"
        >
          {EPISODE_KANBAN_COLUMNS.map((col) => {
            const colEps = displayedEpisodesByStatus[col.value] || [];
            const isOver = episodeKanbanDragOver === col.value;
            return (
              <div
                key={col.value}
                style={{
                  ...epKanbanColumn,
                  ...(isOver ? epKanbanColumnDragOver : {}),
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setEpisodeKanbanDragOver(col.value);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setEpisodeKanbanDragOver(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setEpisodeKanbanDragOver(null);
                  const raw =
                    e.dataTransfer.getData("application/x-syriona-episode") ||
                    e.dataTransfer.getData("text/plain");
                  handleEpisodeKanbanDrop(raw, col.value);
                }}
              >
                <div style={epKanbanColumnHeader}>
                  <div style={epKanbanColumnHeaderLeft}>
                    <GripVertical
                      size={14}
                      color="#A1A1AA"
                      style={{ flexShrink: 0, opacity: 0.9 }}
                      aria-hidden
                    />
                    <span
                      style={{
                        ...epKanbanColumnDot,
                        background:
                          EPISODE_KANBAN_DOT[col.value] || "#A1A1AA",
                      }}
                      aria-hidden
                    />
                    <span style={epKanbanColumnTitle}>{col.label}</span>
                  </div>
                  <span style={epKanbanColumnCountBadge}>
                    {colEps.length}
                  </span>
                </div>
                <div style={epKanbanColumnBody}>
                  {colEps.length === 0 ? (
                    <p style={epKanbanColumnEmpty}>Drop an episode here</p>
                  ) : (
                    colEps.map((ep) => {
                      const saving = episodeStatusSavingId === ep.id;
                      const accent = ACCENTS[Number(ep.id) % ACCENTS.length];
                      const updatedRaw =
                        ep.updated_at != null ? ep.updated_at : ep.created_at;
                      return (
                        <div
                          key={ep.id}
                          draggable={!saving}
                          onDragStart={(e) => beginEpisodeKanbanDrag(e, ep)}
                          onDragEnd={() => setEpisodeKanbanDragOver(null)}
                          title={
                            saving
                              ? undefined
                              : "Drag to change status column"
                          }
                          style={{
                            ...epKanbanCard,
                            opacity: saving ? 0.72 : 1,
                            cursor: saving ? "wait" : "grab",
                          }}
                        >
                          <div aria-hidden style={epKanbanCardGrip}>
                            <GripVertical size={20} color="#A1A1AA" />
                          </div>
                          <div style={epKanbanCardMain}>
                            <div style={epKanbanCardTitleRow}>
                              <div
                                style={{
                                  ...epKanbanCardIcon,
                                  background: accent.soft,
                                  color: accent.icon,
                                }}
                                aria-hidden
                              >
                                <Film size={18} strokeWidth={2} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <h3 style={epKanbanCardName}>
                                  {ep.title || "Untitled"}
                                </h3>
                                <p style={epKanbanCardEpNum}>
                                  Episode {ep.episode_number ?? "—"}
                                </p>
                              </div>
                            </div>

                            <div style={epKanbanMetaRow}>
                              <ClipboardList
                                size={17}
                                color="#A1A1AA"
                                style={epKanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span style={epKanbanMetaLabel}>Status</span>
                              <div style={epKanbanMetaValueCell}>
                                <WorkflowStatusSelect
                                  value={ep.status ?? "not_started"}
                                  options={EPISODE_STATUS_OPTIONS}
                                  onChange={(v) =>
                                    handleEpisodeStatusQuickChange(ep, v)
                                  }
                                  disabled={saving}
                                  comfortable
                                  badgeStyleForValue={(v) =>
                                    episodeStatusBadgeStyle(v)
                                  }
                                  ariaLabel={`Status for ${ep.title || "episode"}`}
                                />
                              </div>
                            </div>

                            <div style={epKanbanMetaRow}>
                              <Calendar
                                size={17}
                                color="#A1A1AA"
                                style={epKanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span style={epKanbanMetaLabel}>Updated</span>
                              <span
                                style={epKanbanMetaValueText}
                                title={formatProjectDate(updatedRaw)}
                              >
                                {formatProjectListDate(updatedRaw)}
                              </span>
                            </div>

                            <div style={epKanbanCardFooter}>
                              <UserRound
                                size={17}
                                color="#A1A1AA"
                                style={epKanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <div style={epKanbanCardFooterAssignee}>
                                <AssigneeSelect
                                  id={`ep-kanban-assign-${ep.id}`}
                                  label={null}
                                  hideLabel
                                  value={ep.assigned_to_user_id}
                                  members={orgMembers}
                                  onChange={(uid) =>
                                    handleEpisodeAssigneeQuickChange(ep, uid)
                                  }
                                  disabled={
                                    episodeAssigneeSavingId === ep.id ||
                                    saving
                                  }
                                  style={{ gap: 0 }}
                                  selectStyle={{
                                    ...epKanbanAssigneeSelect,
                                    opacity:
                                      episodeAssigneeSavingId === ep.id
                                        ? 0.65
                                        : 1,
                                    cursor:
                                      episodeAssigneeSavingId === ep.id
                                        ? "wait"
                                        : "pointer",
                                  }}
                                />
                              </div>
                              <span
                                style={epKanbanFooterDate}
                                title={formatProjectDate(updatedRaw)}
                              >
                                {formatProjectListDate(updatedRaw)}
                              </span>
                            </div>

                            <div style={epKanbanCardActions}>
                              <button
                                type="button"
                                className="projects-list-open-btn"
                                onClick={() => onOpenEpisode?.(ep.id)}
                              >
                                <span className="projects-list-open-btn-label">
                                  Open
                                </span>
                                <span
                                  className="projects-list-open-btn-icon"
                                  aria-hidden
                                >
                                  <ArrowUpRight size={17} strokeWidth={2.35} />
                                </span>
                              </button>
                              <button
                                type="button"
                                className="projects-list-ghost-btn"
                                style={epKanbanRowIconBtn}
                                title="Rename"
                                onClick={() => openEdit(ep)}
                              >
                                <Pencil size={17} />
                              </button>
                              <button
                                type="button"
                                className="projects-list-ghost-btn projects-list-ghost-btn--danger"
                                style={epKanbanRowIconBtnDanger}
                                title="Delete episode"
                                onClick={() => {
                                  setDeleteEp(ep);
                                  setDeleteConfirm("");
                                }}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {displayedEpisodes.length === 0 &&
        episodes.length > 0 &&
        !loading &&
        String(headerSearchQuery ?? "").trim() && (
          <div style={emptyBox}>
            <Film size={36} color="#94A3B8" />
            <p style={emptyTitle}>No episodes match your search</p>
            <p style={emptySub}>
              Try another term or clear the search in the header.
            </p>
          </div>
        )}

      {episodes.length === 0 && !loading && (
        <div style={emptyBox}>
          <Film size={36} color="#94A3B8" />
          <p style={emptyTitle}>No episodes yet</p>
          <p style={emptySub}>
            Add an episode to import scripts, dub, and export.
          </p>
          <button
            type="button"
            style={primaryButton}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={18} />
            Add episodes
          </button>
        </div>
      )}

      {/* Create episode(s) */}
      {showCreateModal && (
        <div style={modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={episodeBulkModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={episodeBulkModalHeader}>
              <div style={modalTitleWrap}>
                <div style={modalIconBulk}>
                  <Film size={22} strokeWidth={2} />
                </div>
                <div>
                  <h3 style={modalTitleBulk}>New episodes</h3>
                  <p style={modalSubtitleBulk}>
                    Add one or many titles to{" "}
                    <strong style={{ color: "#334155", fontWeight: 700 }}>
                      {project.name}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={closeBtnBulk}
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={episodeModalBody}>
              <label style={labelEpisodeBulk} htmlFor="episode-bulk-titles">
                Episode titles
              </label>
              <div style={episodeTextareaShell}>
                <textarea
                  id="episode-bulk-titles"
                  className="episode-bulk-textarea"
                  value={episodeName}
                  onChange={(e) => setEpisodeName(e.target.value)}
                  style={textareaEpisode}
                  placeholder={
                    "One title per line, e.g.\nEpisode 2\nEpisode 3\nThe reunion"
                  }
                  rows={6}
                  autoFocus
                />
              </div>
              <div style={episodeModalHintBox}>
                {(() => {
                  const n = countEpisodeLines(episodeName);
                  let main;
                  if (n === 0) {
                    main =
                      "Enter at least one line. Episode numbers continue after your current highest number.";
                  } else if (n === 1) {
                    main =
                      "Creates 1 episode. Add more lines to add up to 100 at once.";
                  } else {
                    main = `Creates ${n} episodes as Ep ${nextEpisodePreviewStart}–${nextEpisodePreviewStart + n - 1}.`;
                  }
                  if (n > 0) {
                    main += " Each is marked New until you change status.";
                  }
                  return main;
                })()}
              </div>
            </div>

            <div style={episodeModalFooter}>
              <button
                type="button"
                style={neutralBtnBulk}
                disabled={createEpisodeLoading}
                onClick={() => !createEpisodeLoading && setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...primaryButtonBulk,
                  opacity:
                    countEpisodeLines(episodeName) > 0 && !createEpisodeLoading
                      ? 1
                      : 0.5,
                }}
                disabled={
                  countEpisodeLines(episodeName) === 0 || createEpisodeLoading
                }
                onClick={handleCreateEpisode}
              >
                {createEpisodeLoading
                  ? "Creating…"
                  : (() => {
                      const n = countEpisodeLines(episodeName);
                      if (n <= 1) return "Create episode";
                      return `Create ${n} episodes`;
                    })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit episode */}
      {editEp && (
        <div style={modalOverlay} onClick={() => !editLoading && setEditEp(null)}>
          <div style={modalCardNarrow} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>Edit episode</h3>
              <button
                type="button"
                style={closeBtn}
                disabled={editLoading}
                onClick={() => setEditEp(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div style={formGroup}>
              <label style={label}>Title</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={input}
              />
            </div>
            <div style={formGroup}>
              <label style={label}>Episode number</label>
              <input
                value={editNum}
                onChange={(e) => setEditNum(e.target.value)}
                style={input}
                type="number"
                min={1}
              />
            </div>
            <div style={formGroup}>
              <label style={label}>Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={input}
              >
                {EPISODE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <AssigneeSelect
              id="edit-episode-assignee"
              label="Assign to"
              value={editAssignee}
              members={orgMembers}
              onChange={setEditAssignee}
              disabled={editLoading}
              selectStyle={{ ...input, padding: "10px 12px" }}
            />
            <div style={modalActions}>
              <button
                type="button"
                style={neutralBtn}
                disabled={editLoading}
                onClick={() => setEditEp(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={primaryButton}
                disabled={!editTitle.trim() || editLoading}
                onClick={saveEdit}
              >
                {editLoading ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete episode */}
      {deleteEp && (
        <div
          style={modalOverlayDark}
          onClick={() => !deleteLoading && setDeleteEp(null)}
        >
          <div style={deleteCard} onClick={(e) => e.stopPropagation()}>
            <div style={deleteIconWrap}>
              <Trash2 size={26} color="#DC2626" />
            </div>
            <h3 style={deleteTitle}>Delete episode?</h3>
            <p style={deleteText}>
              Removes this episode and all script lines and translations inside
              it.
            </p>
            <p style={deleteHint}>
              Type the episode title to confirm:{" "}
              <strong>{normalizeEpisodeTitleForCompare(deleteEp.title)}</strong>
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              style={deleteInput}
              placeholder="Episode title"
            />
            <div style={modalActions}>
              <button
                type="button"
                style={neutralBtn}
                disabled={deleteLoading}
                onClick={() => {
                  setDeleteEp(null);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                style={dangerBtn}
                disabled={!deleteMatches || deleteLoading}
                onClick={confirmDelete}
              >
                {deleteLoading ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const epKanbanBoard = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
  overflowX: "auto",
  padding: "16px 14px 18px",
  marginBottom: "8px",
  borderRadius: "16px",
  background: "#F4F4F5",
  border: "1px solid #E4E4E7",
  WebkitOverflowScrolling: "touch",
};

const epKanbanColumn = {
  flex: "1 1 0",
  minWidth: "min(100%, 280px)",
  borderRadius: "14px",
  background: "#EBEBEC",
  border: "1px solid #DCDCDE",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  maxHeight: "min(78vh, 880px)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
};

const epKanbanColumnDragOver = {
  borderColor: "#3B82F6",
  background: "#E8EEF9",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.65), 0 0 0 2px rgba(59, 130, 246, 0.35)",
};

const epKanbanColumnHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "14px 16px 12px",
  borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)",
};

const epKanbanColumnHeaderLeft = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  minWidth: 0,
  flex: "1 1 auto",
};

const epKanbanColumnDot = {
  width: "12px",
  height: "12px",
  borderRadius: "4px",
  flexShrink: 0,
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
};

const epKanbanColumnTitle = {
  fontSize: "0.8rem",
  fontWeight: 800,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#3F3F46",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const epKanbanColumnCountBadge = {
  fontSize: "0.78rem",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  color: "#52525B",
  background: "#FFFFFF",
  border: "1px solid #D4D4D8",
  borderRadius: "999px",
  padding: "5px 11px",
  lineHeight: 1.2,
  flexShrink: 0,
};

const epKanbanColumnBody = {
  flex: 1,
  overflowY: "auto",
  padding: "14px 12px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minHeight: "160px",
};

const epKanbanColumnEmpty = {
  margin: "28px 14px",
  fontSize: "0.9rem",
  color: "#A1A1AA",
  textAlign: "center",
  lineHeight: 1.45,
  fontWeight: 500,
};

const epKanbanCard = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  background: "#FFFFFF",
  borderRadius: "12px",
  border: "1px solid #E4E4E7",
  padding: "16px 16px 16px 10px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
};

const epKanbanCardGrip = {
  flexShrink: 0,
  padding: "2px 0 0",
  borderRadius: "6px",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  alignSelf: "stretch",
};

const epKanbanCardMain = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const epKanbanCardTitleRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
};

const epKanbanCardIcon = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const epKanbanCardName = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 700,
  color: "#18181B",
  lineHeight: 1.35,
  wordBreak: "break-word",
};

const epKanbanCardEpNum = {
  margin: "6px 0 0",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#94A3B8",
  letterSpacing: "0.03em",
};

const epKanbanMetaRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  minWidth: 0,
};

const epKanbanMetaIcon = {
  flexShrink: 0,
  marginTop: "1px",
};

const epKanbanMetaLabel = {
  flex: "0 0 72px",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#A1A1AA",
  lineHeight: 1.2,
};

const epKanbanMetaValueCell = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  justifyContent: "flex-end",
};

const epKanbanMetaValueText = {
  flex: 1,
  minWidth: 0,
  fontSize: "0.88rem",
  fontWeight: 600,
  color: "#52525B",
  textAlign: "right",
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const epKanbanCardFooter = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "6px",
  paddingTop: "14px",
  borderTop: "1px solid #F4F4F5",
};

const epKanbanCardFooterAssignee = {
  flex: 1,
  minWidth: 0,
};

const epKanbanFooterDate = {
  flexShrink: 0,
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#71717A",
  whiteSpace: "nowrap",
};

const epKanbanAssigneeSelect = {
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
  boxSizing: "border-box",
  padding: "8px 26px 8px 10px",
  fontSize: "0.88rem",
  fontWeight: 600,
  borderRadius: "10px",
};

const epKanbanCardActions = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "4px",
  paddingTop: "14px",
  borderTop: "1px solid #F4F4F5",
};

const pageWrap = {
  width: "100%",
  maxWidth: "1680px",
  margin: "0 auto",
  padding: "8px clamp(12px, 2.5vw, 40px) 48px",
  boxSizing: "border-box",
};

const loadingWrap = {
  padding: "48px 24px",
  textAlign: "center",
};

const loadingText = { color: "#64748B", fontSize: "1rem" };

const backBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  background: "none",
  border: "none",
  color: "#2563EB",
  fontSize: "0.92rem",
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: "20px",
  padding: "4px 0",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "18px",
  flexWrap: "wrap",
  padding: "20px 24px",
  borderRadius: "16px",
  background: "linear-gradient(125deg, #EEF2FF 0%, #F8FAFC 40%, #F0FDFA 100%)",
  border: "1px solid #E2E8F0",
  marginBottom: "22px",
  boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
};

const heroMain = { flex: "1 1 280px", minWidth: 0 };

const title = {
  fontSize: "1.75rem",
  fontWeight: 800,
  color: "#0F172A",
  margin: 0,
  letterSpacing: "-0.02em",
};

const abstractLabel = {
  display: "block",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#94A3B8",
  marginBottom: "4px",
};

const subtitle = {
  fontSize: "0.95rem",
  color: "#64748B",
  marginTop: 0,
  lineHeight: 1.5,
};

const heroMetaPanel = {
  marginTop: "18px",
  padding: "16px 18px",
  borderRadius: "16px",
  background: "rgba(255, 255, 255, 0.72)",
  WebkitBackdropFilter: "blur(10px)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  boxShadow:
    "0 1px 3px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
};

const metaToolbar = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px",
};

const metaPillLang = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: "999px",
  fontSize: "0.84rem",
  fontWeight: 600,
  letterSpacing: "0.01em",
  color: "#3730A3",
  background: "linear-gradient(180deg, #EEF2FF 0%, #E0E7FF 100%)",
  border: "1px solid #C7D2FE",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const metaPillCategory = {
  display: "inline-flex",
  alignItems: "center",
  padding: "10px 16px",
  borderRadius: "999px",
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "#475569",
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const heroActions = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  alignItems: "center",
};

const primaryButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.92rem",
  boxShadow: "0 6px 20px rgba(37,99,235,0.35)",
};

const secondaryButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 18px",
  borderRadius: "12px",
  border: "2px solid #2563EB",
  background: "#fff",
  color: "#2563EB",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.92rem",
};

const sectionLabel = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px 16px",
  marginBottom: "16px",
  padding: "0 4px",
};

const sectionLabelLeft = {
  display: "flex",
  alignItems: "baseline",
  gap: "12px",
  flexWrap: "wrap",
  minWidth: 0,
};

const sectionTitle = {
  margin: 0,
  fontSize: "1.28rem",
  fontWeight: 700,
  color: "#0F172A",
};

const sectionCount = {
  fontSize: "0.92rem",
  color: "#94A3B8",
  fontWeight: 600,
};

const epViewToggleWrap = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px",
  borderRadius: "12px",
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  flexShrink: 0,
};

const epViewToggleBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 12px",
  borderRadius: "9px",
  border: "1px solid transparent",
  background: "transparent",
  color: "#64748B",
  fontSize: "0.82rem",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const epViewToggleBtnActive = {
  background: "#EEF2FF",
  color: "#3730A3",
  borderColor: "#C7D2FE",
  boxShadow: "0 1px 2px rgba(67, 56, 202, 0.12)",
};

const epViewToggleLabel = {
  lineHeight: 1,
};

const epListShell = {
  background: "#FFFFFF",
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
  /* overflow-x: hidden forces overflow-y to clip in CSS; that cuts off dropdowns */
  overflow: "visible",
  maxWidth: "100%",
  padding: "0 8px 0 10px",
  boxSizing: "border-box",
};

const epListStatusCellInner = {
  width: "100%",
  maxWidth: "168px",
};

const epListAssignCellInner = {
  width: "100%",
  maxWidth: "176px",
};

const epListTable = {
  width: "100%",
  maxWidth: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  boxSizing: "border-box",
};

const epThFirst = {
  boxSizing: "border-box",
  borderLeft: "3px solid transparent",
  padding: "12px 6px 12px 11px",
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "0.64rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748B",
  background: "#F8FAFC",
};

const epTh = {
  boxSizing: "border-box",
  padding: "12px 6px",
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "0.64rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#64748B",
  background: "#F8FAFC",
};

const epThActions = {
  boxSizing: "border-box",
  padding: "12px 0 12px 6px",
  textAlign: "right",
  verticalAlign: "bottom",
  background: "#F8FAFC",
};

const epTdEpisode = {
  boxSizing: "border-box",
  verticalAlign: "middle",
  padding: "12px 6px 12px 11px",
  borderLeftWidth: "3px",
  borderLeftStyle: "solid",
  wordBreak: "break-word",
};

const epTdMid = {
  boxSizing: "border-box",
  verticalAlign: "middle",
  padding: "12px 6px",
  textAlign: "left",
};

const epTdActions = {
  boxSizing: "border-box",
  verticalAlign: "middle",
  padding: "12px 0 12px 6px",
  textAlign: "right",
};

const epLineLead = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
};

const epLineIcon = {
  flexShrink: 0,
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const epLineTitle = {
  margin: 0,
  padding: 0,
  fontWeight: 700,
  fontSize: "0.95rem",
  color: "#0F172A",
  lineHeight: 1.25,
  letterSpacing: "-0.015em",
  wordBreak: "break-word",
};

const epLineNum = {
  marginTop: "4px",
  fontSize: "0.68rem",
  fontWeight: 600,
  color: "#94A3B8",
  letterSpacing: "0.03em",
};

const epListAssigneeSelect = {
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
  boxSizing: "border-box",
  padding: "5px 20px 5px 6px",
  fontSize: "0.74rem",
  fontWeight: 600,
  borderRadius: "8px",
};

const epListDatesStack = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "6px",
};

const epListDateBlock = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  lineHeight: 1.3,
};

const epListDateCap = {
  fontSize: "0.62rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94A3B8",
};

const epListDateVal = {
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "#475569",
};

const epListActions = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: "8px",
  maxWidth: "100%",
};

const epRowIconBtn = {
  padding: "7px 9px",
  borderRadius: "10px",
  border: "1px solid #E4E4E7",
  background: "#FFFFFF",
  color: "#52525B",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const epRowIconBtnDanger = {
  padding: "7px 9px",
  borderRadius: "10px",
  border: "1px solid #FECACA",
  background: "#FFFBFB",
  color: "#DC2626",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
  boxShadow: "0 1px 2px rgba(220,38,38,0.06)",
};

const epKanbanRowIconBtn = {
  ...epRowIconBtn,
  padding: "10px 12px",
  borderRadius: "12px",
};

const epKanbanRowIconBtnDanger = {
  ...epRowIconBtnDanger,
  padding: "10px 12px",
  borderRadius: "12px",
};

const emptyBox = {
  textAlign: "center",
  padding: "48px 24px",
  background: "#F8FAFC",
  borderRadius: "18px",
  border: "1px dashed #CBD5E1",
  marginTop: "8px",
};

const emptyTitle = {
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "#475569",
  margin: "14px 0 6px",
};

const emptySub = {
  fontSize: "0.9rem",
  color: "#94A3B8",
  margin: "0 0 20px",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "20px",
};

const modalOverlayDark = {
  ...modalOverlay,
  background: "rgba(15,23,42,0.55)",
};

const modalCard = {
  background: "#fff",
  borderRadius: "20px",
  padding: "32px",
  width: "100%",
  maxWidth: "480px",
  boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
  border: "1px solid #E2E8F0",
};

const modalCardNarrow = { ...modalCard, maxWidth: "420px" };

const deleteCard = {
  ...modalCard,
  maxWidth: "420px",
  border: "1px solid #FECACA",
};

const deleteIconWrap = {
  width: "52px",
  height: "52px",
  borderRadius: "14px",
  background: "#FEF2F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "14px",
};

const deleteTitle = {
  margin: "0 0 8px",
  fontSize: "1.25rem",
  fontWeight: 800,
  color: "#991B1B",
};

const deleteText = {
  margin: "0 0 10px",
  fontSize: "0.9rem",
  color: "#475569",
  lineHeight: 1.5,
};

const deleteHint = {
  margin: "0 0 8px",
  fontSize: "0.85rem",
  color: "#64748B",
};

const deleteInput = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "2px solid #E2E8F0",
  fontSize: "0.95rem",
  marginBottom: "18px",
  boxSizing: "border-box",
};

const dangerBtn = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#DC2626",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "24px",
};

const modalTitleWrap = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
};

const modalTitle = {
  margin: 0,
  fontSize: "1.35rem",
  fontWeight: 700,
  color: "#0F172A",
};

const episodeBulkModalCard = {
  background: "linear-gradient(180deg, #FFFFFF 0%, #FAFBFC 100%)",
  borderRadius: "22px",
  padding: "0",
  width: "100%",
  maxWidth: "520px",
  boxShadow:
    "0 4px 6px rgba(15, 23, 42, 0.04), 0 24px 48px rgba(15, 23, 42, 0.14)",
  border: "1px solid rgba(226, 232, 240, 0.95)",
  overflow: "hidden",
};

const episodeBulkModalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  padding: "26px 28px 20px",
  borderBottom: "1px solid #F1F5F9",
  background: "linear-gradient(135deg, #F8FAFF 0%, #FFFFFF 70%)",
};

const modalIconBulk = {
  background: "linear-gradient(145deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#4338CA",
  padding: "14px",
  borderRadius: "16px",
  display: "flex",
  boxShadow: "0 2px 8px rgba(67, 56, 202, 0.12)",
  border: "1px solid #C7D2FE",
};

const modalTitleBulk = {
  margin: 0,
  fontSize: "1.4rem",
  fontWeight: 800,
  color: "#0F172A",
  letterSpacing: "-0.02em",
};

const modalSubtitleBulk = {
  margin: "8px 0 0",
  fontSize: "0.92rem",
  color: "#64748B",
  lineHeight: 1.5,
  maxWidth: "340px",
};

const closeBtnBulk = {
  background: "#F1F5F9",
  border: "1px solid #E2E8F0",
  borderRadius: "10px",
  cursor: "pointer",
  color: "#64748B",
  padding: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const episodeModalBody = {
  padding: "22px 28px 8px",
};

const labelEpisodeBulk = {
  fontSize: "0.8rem",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "10px",
  display: "block",
  letterSpacing: "0.02em",
};

const episodeTextareaShell = {
  borderRadius: "14px",
  padding: "3px",
  background:
    "linear-gradient(135deg, #E0E7FF 0%, #E2E8F0 50%, #EEF2FF 100%)",
  boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.06)",
};

const episodeModalHintBox = {
  marginTop: "14px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
  fontSize: "0.8rem",
  lineHeight: 1.5,
  color: "#475569",
};

const episodeModalFooter = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
  padding: "20px 28px 26px",
  borderTop: "1px solid #F1F5F9",
  background: "#FAFBFC",
};

const neutralBtnBulk = {
  background: "#FFFFFF",
  border: "1px solid #CBD5E1",
  padding: "12px 22px",
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: 600,
  color: "#475569",
  fontSize: "0.92rem",
  fontFamily: "inherit",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
};

const primaryButtonBulk = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  padding: "12px 22px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.92rem",
  fontFamily: "inherit",
  minWidth: "160px",
  boxShadow: "0 10px 28px rgba(37, 99, 235, 0.35)",
};

const closeBtn = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#94A3B8",
  padding: "4px",
};

const formGroup = {
  marginBottom: "20px",
};

const label = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "6px",
  display: "block",
};

const input = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid #CBD5E1",
  fontSize: "0.95rem",
  background: "#F8FAFC",
  color: "#0F172A",
  boxSizing: "border-box",
};

const textareaEpisode = {
  width: "100%",
  minHeight: "148px",
  resize: "vertical",
  lineHeight: 1.5,
  fontFamily: "inherit",
  fontSize: "0.95rem",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "2px solid #FFFFFF",
  background: "#FFFFFF",
  color: "#0F172A",
  boxSizing: "border-box",
  boxShadow: "inset 0 2px 4px rgba(15, 23, 42, 0.04)",
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  flexWrap: "wrap",
};

const neutralBtn = {
  background: "#F1F5F9",
  border: "1px solid #E2E8F0",
  padding: "12px 20px",
  borderRadius: "10px",
  cursor: "pointer",
  fontWeight: 600,
  color: "#475569",
};
