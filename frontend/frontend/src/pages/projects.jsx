import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FolderPlus,
  X,
  Folder,
  Pencil,
  Trash2,
  ArrowUpRight,
  List,
  Kanban,
  GripVertical,
  ChevronDown,
  ClipboardList,
  Calendar,
  Tag,
  Languages,
  UserRound,
} from "lucide-react";
import { apiFetch } from "../api/client";
import AssigneeSelect, { memberLabel } from "../components/AssigneeSelect";
import ProjectCategorySelect from "../components/ProjectCategorySelect";
import { PROJECT_CATEGORY_OPTIONS } from "../constants/projectCategories";

const PROJECTS_PATH = "/projects";
const PROJECTS_VIEW_STORAGE_KEY = "syriona-projects-view";

export function formatProjectDate(value) {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact date for dense list rows (full detail still in formatProjectDate). */
export function formatProjectListDate(value) {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Kept in sync with backend `_ALLOWED_PROJECT_STATUS` */
export const PROJECT_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "on_hold", label: "On hold" },
];

function parseYMDLocalStart(ymd) {
  const parts = String(ymd).trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const t = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return Number.isNaN(t) ? null : t;
}

function parseYMDLocalEnd(ymd) {
  const parts = String(ymd).trim().split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const t = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  return Number.isNaN(t) ? null : t;
}

function projectTimestampForDateFilter(p, field) {
  const raw =
    field === "updated" ? (p.updated_at ?? p.created_at) : p.created_at;
  if (raw == null || raw === "") return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Episodes include `new` (e.g. bulk add). Keep aligned with `_ALLOWED_EPISODE_STATUS` on the API. */
export const EPISODE_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  ...PROJECT_STATUS_OPTIONS,
];

export function episodeStatusLabel(value) {
  const v = value || "not_started";
  if (v === "new") return "New";
  return projectStatusLabel(v);
}

export function episodeStatusBadgeStyle(value) {
  const v = value || "not_started";
  if (v === "new") {
    return {
      background: "#EEF2FF",
      color: "#3730A3",
      border: "1px solid #A5B4FC",
    };
  }
  return projectStatusBadgeStyle(v);
}

export function projectStatusLabel(value) {
  const v = value || "not_started";
  const found = PROJECT_STATUS_OPTIONS.find((o) => o.value === v);
  return found ? found.label : "Not started";
}

export function projectStatusBadgeStyle(value) {
  const v = value || "not_started";
  if (v === "in_progress") {
    return { background: "#DBEAFE", color: "#1D4ED8", border: "1px solid #93C5FD" };
  }
  if (v === "done") {
    return { background: "#DCFCE7", color: "#166534", border: "1px solid #86EFAC" };
  }
  if (v === "on_hold") {
    return { background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" };
  }
  return { background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" };
}

const CARD_ACCENTS = [
  { bar: "#4F46E5", soft: "#EEF2FF", iconTint: "#4338CA" },
  { bar: "#059669", soft: "#ECFDF5", iconTint: "#047857" },
  { bar: "#C026D3", soft: "#FAE8FF", iconTint: "#A21CAF" },
  { bar: "#EA580C", soft: "#FFEDD5", iconTint: "#C2410C" },
];

/** Column status swatch (Notion-style board headers). */
const KANBAN_STATUS_DOT = {
  not_started: "#3B82F6",
  in_progress: "#CA8A04",
  done: "#16A34A",
  on_hold: "#EA580C",
};

export default function ProjectsPage({
  onOpenProject,
  headerSearchQuery = "",
}) {
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [seriesAbstract, setSeriesAbstract] = useState("");
  const [category, setCategory] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("Turkish");
  const [targetLanguage, setTargetLanguage] = useState("Syrian Arabic");
  const [newProjectStatus, setNewProjectStatus] = useState("not_started");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [projectDateField, setProjectDateField] = useState("created");
  const [projectDateFrom, setProjectDateFrom] = useState("");
  const [projectDateTo, setProjectDateTo] = useState("");
  const [projects, setProjects] = useState([]);
  const [orgMembers, setOrgMembers] = useState([]);
  const [newProjectAssigneeId, setNewProjectAssigneeId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [listAssigneeSavingId, setListAssigneeSavingId] = useState(null);

  const [projectsView, setProjectsView] = useState(() => {
    try {
      const v = localStorage.getItem(PROJECTS_VIEW_STORAGE_KEY);
      return v === "kanban" ? "kanban" : "list";
    } catch {
      return "list";
    }
  });
  const [kanbanDragOver, setKanbanDragOver] = useState(null);
  const [kanbanStatusSavingId, setKanbanStatusSavingId] = useState(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiFetch(`${PROJECTS_PATH}/`);
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load projects", err);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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

  const statusFilterPickerOptions = useMemo(
    () => [
      { value: "all", label: "All statuses" },
      ...PROJECT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    ],
    []
  );

  const projectDateFieldOptions = useMemo(
    () => [
      { value: "created", label: "Created date" },
      { value: "updated", label: "Updated date" },
    ],
    []
  );

  const categoryFilterOptions = useMemo(() => {
    const names = new Set(PROJECT_CATEGORY_OPTIONS);
    for (const p of projects) {
      const c = String(p.category ?? "").trim();
      if (c) names.add(c);
    }
    const sorted = [...names].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    return [
      { value: "all", label: "All categories" },
      ...sorted.map((c) => ({ value: c, label: c })),
    ];
  }, [projects]);

  const resetProjectFilters = useCallback(() => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setProjectDateField("created");
    setProjectDateFrom("");
    setProjectDateTo("");
  }, []);

  const filteredProjects = useMemo(() => {
    let list = projects;

    if (statusFilter !== "all") {
      list = list.filter(
        (p) => (p.status || "not_started") === statusFilter
      );
    }

    if (categoryFilter !== "all") {
      list = list.filter(
        (p) => String(p.category ?? "").trim() === categoryFilter
      );
    }

    if (projectDateFrom || projectDateTo) {
      const fromT = projectDateFrom
        ? parseYMDLocalStart(projectDateFrom)
        : null;
      const toT = projectDateTo ? parseYMDLocalEnd(projectDateTo) : null;
      list = list.filter((p) => {
        const ts = projectTimestampForDateFilter(p, projectDateField);
        if (ts == null) return false;
        if (fromT != null && ts < fromT) return false;
        if (toT != null && ts > toT) return false;
        return true;
      });
    }

    const q = String(headerSearchQuery ?? "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const assignee = orgMembers.find(
        (m) => Number(m.id) === Number(p.assigned_to_user_id)
      );
      const assigneeBlob = assignee ? memberLabel(assignee).toLowerCase() : "";
      const blob = [
        p.name,
        p.category,
        p.source_language,
        p.target_language,
        p.description,
        p.status,
        assigneeBlob,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");
      return blob.includes(q);
    });
  }, [
    projects,
    statusFilter,
    categoryFilter,
    projectDateField,
    projectDateFrom,
    projectDateTo,
    headerSearchQuery,
    orgMembers,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_VIEW_STORAGE_KEY, projectsView);
    } catch {
      /* ignore */
    }
  }, [projectsView]);

  const projectsByStatus = useMemo(() => {
    const map = {
      not_started: [],
      in_progress: [],
      done: [],
      on_hold: [],
    };
    for (const p of filteredProjects) {
      const s = p.status || "not_started";
      if (map[s]) map[s].push(p);
      else map.not_started.push(p);
    }
    return map;
  }, [filteredProjects]);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key !== "Escape") return;
      setShowModal(false);
      setDeleteTarget(null);
      setEditTarget(null);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  async function handleCreate() {
    if (!projectName.trim()) return;
    try {
      const res = await apiFetch(`${PROJECTS_PATH}/`, {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          description: seriesAbstract,
          category: category,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          status: newProjectStatus,
          assigned_to_user_id: newProjectAssigneeId,
        }),
      });
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { detail: raw.slice(0, 200) || `HTTP ${res.status}` };
      }
      if (!res.ok) {
        console.error("Backend error:", data);
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail || data);
        alert(msg || `Could not create project (HTTP ${res.status})`);
        return;
      }
      setProjects((prev) => [data, ...prev]);
      setShowModal(false);
      setNewProjectAssigneeId(null);
      setProjectName("");
      setSeriesAbstract("");
      setCategory("");
      setNewProjectStatus("not_started");
      setSourceLanguage("Turkish");
      setTargetLanguage("Syrian Arabic");
    } catch (error) {
      console.error("Error creating project:", error);
    }
  }

  async function handleListAssigneeChange(p, nextUserId) {
    if (!p || listAssigneeSavingId === p.id) return;
    const cur =
      p.assigned_to_user_id != null ? Number(p.assigned_to_user_id) : null;
    const next = nextUserId != null ? Number(nextUserId) : null;
    if (cur === next) return;
    setListAssigneeSavingId(p.id);
    try {
      const res = await apiFetch(`${PROJECTS_PATH}/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ assigned_to_user_id: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update assignee");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
      );
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setListAssigneeSavingId(null);
    }
  }

  async function handlePatchProjectStatus(projectId, nextStatus) {
    if (kanbanStatusSavingId === projectId) return;
    const p = projects.find((x) => x.id === projectId);
    if (!p) return;
    const cur = p.status || "not_started";
    if (cur === nextStatus) return;
    setKanbanStatusSavingId(projectId);
    try {
      const res = await apiFetch(`${PROJECTS_PATH}/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update status");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row))
      );
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setKanbanStatusSavingId(null);
    }
  }

  function beginKanbanCardDrag(e, p) {
    if (kanbanStatusSavingId === p.id) {
      e.preventDefault();
      return;
    }
    if (
      e.target.closest(
        "button, select, input, textarea, a[href], option, label"
      )
    ) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/x-syriona-project", String(p.id));
    e.dataTransfer.setData("text/plain", String(p.id));
    e.dataTransfer.effectAllowed = "move";
  }

  function openEdit(p) {
    setEditTarget({ id: p.id, name: p.name || "" });
    setEditName(p.name || "");
  }

  async function handleSaveEdit() {
    if (!editTarget || !editName.trim()) return;
    setEditLoading(true);
    try {
      const res = await apiFetch(`${PROJECTS_PATH}/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Could not update project");
        return;
      }
      const updated = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
      );
      setEditTarget(null);
      setEditName("");
    } catch (e) {
      alert(e?.message || "Update failed");
    } finally {
      setEditLoading(false);
    }
  }

  function openDelete(p) {
    setDeleteTarget({ id: p.id, name: p.name || "" });
    setDeleteConfirmInput("");
  }

  const deleteNameMatches =
    deleteTarget &&
    deleteConfirmInput.trim() === String(deleteTarget.name).trim();

  async function handleConfirmDelete() {
    if (!deleteTarget || !deleteNameMatches) return;
    setDeleteLoading(true);
    try {
      const res = await apiFetch(`${PROJECTS_PATH}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const msg = Array.isArray(detail)
          ? detail.map((x) => x?.msg || JSON.stringify(x)).join("\n")
          : typeof detail === "string"
            ? detail
            : detail
              ? JSON.stringify(detail)
              : `Could not delete project (HTTP ${res.status})`;
        alert(msg);
        return;
      }
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteConfirmInput("");
    } catch (e) {
      alert(e?.message || "Delete failed");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={hero}>
        <div>
          <h2 style={title}>Projects</h2>
          <p style={subtitle}>
            Manage your dubbing projects — open, rename, or remove when you are
            sure.
          </p>
        </div>
        <button type="button" style={primaryButton} onClick={() => setShowModal(true)}>
          <FolderPlus size={18} />
          Create project
        </button>
      </div>

      {projects.length > 0 && (
        <div style={filterBar}>
          <div style={filterBarMain}>
            <div style={projectsFiltersGrid} role="group" aria-label="Project filters">
              <label style={projectsFilterItem}>
                <span style={projectsFilterLabel}>Status</span>
                <ProjectsFilterPicker
                  value={statusFilter}
                  options={statusFilterPickerOptions}
                  onChange={setStatusFilter}
                />
              </label>
              <label style={projectsFilterItem}>
                <span style={projectsFilterLabel}>Category</span>
                <ProjectsFilterPicker
                  value={categoryFilter}
                  options={categoryFilterOptions}
                  onChange={setCategoryFilter}
                />
              </label>
              <label style={projectsFilterItem}>
                <span style={projectsFilterLabel}>Date</span>
                <ProjectsFilterPicker
                  value={projectDateField}
                  options={projectDateFieldOptions}
                  onChange={setProjectDateField}
                />
              </label>
              <label style={projectsFilterItem}>
                <span style={projectsFilterLabel}>From</span>
                <input
                  type="date"
                  value={projectDateFrom}
                  style={projectsDateInput}
                  onChange={(e) => setProjectDateFrom(e.target.value)}
                />
              </label>
              <label style={projectsFilterItem}>
                <span style={projectsFilterLabel}>To</span>
                <input
                  type="date"
                  value={projectDateTo}
                  style={projectsDateInput}
                  onChange={(e) => setProjectDateTo(e.target.value)}
                />
              </label>
              <div style={projectsFilterResetWrap}>
                <button
                  type="button"
                  style={projectsFilterResetBtn}
                  onClick={resetProjectFilters}
                >
                  Reset filters
                </button>
              </div>
            </div>
          </div>
          <div style={viewToggleWrap} role="group" aria-label="Layout">
            <button
              type="button"
              style={{
                ...viewToggleBtn,
                ...(projectsView === "list" ? viewToggleBtnActive : {}),
              }}
              onClick={() => setProjectsView("list")}
              title="List view"
              aria-pressed={projectsView === "list"}
            >
              <List size={18} strokeWidth={2} aria-hidden />
              <span style={viewToggleLabel}>List</span>
            </button>
            <button
              type="button"
              style={{
                ...viewToggleBtn,
                ...(projectsView === "kanban" ? viewToggleBtnActive : {}),
              }}
              onClick={() => setProjectsView("kanban")}
              title="Board view"
              aria-pressed={projectsView === "kanban"}
            >
              <Kanban size={18} strokeWidth={2} aria-hidden />
              <span style={viewToggleLabel}>Board</span>
            </button>
          </div>
        </div>
      )}

      {projects.length > 0 && filteredProjects.length > 0 && (
        <div style={viewOverviewBlock}>
          <h3 style={viewOverviewTitle}>
            {projectsView === "list" ? "List overview" : "Board overview"}
          </h3>
          <p style={viewOverviewHint}>
            {projectsView === "list"
              ? "Table of all projects that match your filters and search."
              : "Each column is a status. Drag cards between columns or use the status control on a card."}
          </p>
        </div>
      )}

      {filteredProjects.length > 0 && projectsView === "list" && (
        <div style={listShell}>
          <table
            className="projects-table"
            style={listTable}
            aria-label="Projects list"
          >
            <colgroup>
              <col style={{ width: "28%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "25%" }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" style={listThProject}>
                  Project
                </th>
                <th scope="col" style={listTh}>
                  Status & category
                </th>
                <th scope="col" style={listTh}>
                  Assign to
                </th>
                <th scope="col" style={listTh}>
                  Created / updated
                </th>
                <th scope="col" style={listThActions}>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p, i) => {
                const accent = CARD_ACCENTS[i % CARD_ACCENTS.length];
                return (
                  <tr key={p.id} className="projects-list-row">
                    <td
                      style={{
                        ...listTdProject,
                        borderLeftColor: accent.bar,
                      }}
                      title={`${p.name || "Untitled"} — ${formatProjectDate(p.created_at)}`}
                    >
                      <div style={listProjectLead}>
                        <div
                          style={{
                            ...listRowIcon,
                            background: accent.soft,
                            color: accent.iconTint,
                          }}
                          aria-hidden
                        >
                          <Folder size={17} strokeWidth={2} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={listProjectName}>
                            {p.name || "Untitled"}
                          </h3>
                          <p style={listProjectLang}>
                            {(p.source_language || "—") +
                              " → " +
                              (p.target_language || "—")}
                          </p>
                          <div
                            style={listProjectIdLine}
                            aria-label={`Project id ${p.id}`}
                          >
                            #{p.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={listTdStatus}>
                      <div style={listTagsStack}>
                        <span
                          style={{
                            ...listStatusPill,
                            ...projectStatusBadgeStyle(p.status),
                          }}
                        >
                          {projectStatusLabel(p.status)}
                        </span>
                        {p.category ? (
                          <span style={listCatPill}>{p.category}</span>
                        ) : (
                          <span style={listCatMuted}>—</span>
                        )}
                      </div>
                    </td>
                    <td style={listTdMiddle}>
                      <AssigneeSelect
                        id={`projects-list-assign-${p.id}`}
                        label={null}
                        hideLabel
                        value={p.assigned_to_user_id}
                        members={orgMembers}
                        onChange={(uid) => handleListAssigneeChange(p, uid)}
                        disabled={listAssigneeSavingId === p.id}
                        style={{ gap: 0 }}
                        selectStyle={{
                          ...listAssigneeSelect,
                          opacity: listAssigneeSavingId === p.id ? 0.65 : 1,
                          cursor:
                            listAssigneeSavingId === p.id
                              ? "wait"
                              : "pointer",
                        }}
                      />
                    </td>
                    <td style={listTdMiddle}>
                      <div style={listDatesStack}>
                        <div style={listDateBlock}>
                          <span style={listDateCap}>Created</span>
                          <span style={listDateVal}>
                            {formatProjectListDate(p.created_at)}
                          </span>
                        </div>
                        <div style={listDateBlock}>
                          <span style={listDateCap}>Updated</span>
                          <span style={listDateVal}>
                            {formatProjectListDate(
                              p.updated_at != null
                                ? p.updated_at
                                : p.created_at
                            )}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={listTdActions}>
                      <div style={listActionsInner}>
                        <button
                          type="button"
                          className="projects-list-open-btn"
                          onClick={() => onOpenProject && onOpenProject(p.id)}
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
                          style={listIconBtn}
                          onClick={() => openEdit(p)}
                          title="Edit name"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="projects-list-ghost-btn projects-list-ghost-btn--danger"
                          style={listIconBtnDanger}
                          onClick={() => openDelete(p)}
                          title="Delete project"
                        >
                          <Trash2 size={16} />
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

      {filteredProjects.length > 0 && projectsView === "kanban" && (
        <div
          className="projects-kanban-board syriona-kanban-hscroll"
          style={kanbanBoard}
          role="region"
          aria-label="Projects by status"
        >
          {PROJECT_STATUS_OPTIONS.map((col) => {
            const colProjects = projectsByStatus[col.value] || [];
            const isOver = kanbanDragOver === col.value;
            return (
              <div
                key={col.value}
                style={{
                  ...kanbanColumn,
                  ...(isOver ? kanbanColumnDragOver : {}),
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setKanbanDragOver(col.value);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setKanbanDragOver(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setKanbanDragOver(null);
                  const raw =
                    e.dataTransfer.getData("application/x-syriona-project") ||
                    e.dataTransfer.getData("text/plain");
                  const id = Number(raw);
                  if (!Number.isFinite(id)) return;
                  handlePatchProjectStatus(id, col.value);
                }}
              >
                <div style={kanbanColumnHeader}>
                  <div style={kanbanColumnHeaderLeft}>
                    <GripVertical
                      size={14}
                      color="#A1A1AA"
                      style={{ flexShrink: 0, opacity: 0.9 }}
                      aria-hidden
                    />
                    <span
                      style={{
                        ...kanbanColumnDot,
                        background:
                          KANBAN_STATUS_DOT[col.value] || "#A1A1AA",
                      }}
                      aria-hidden
                    />
                    <span style={kanbanColumnTitle}>{col.label}</span>
                  </div>
                  <span style={kanbanColumnCountBadge}>
                    {colProjects.length}
                  </span>
                </div>
                <div style={kanbanColumnBody}>
                  {colProjects.length === 0 ? (
                    <p style={kanbanColumnEmpty}>Drop a project here</p>
                  ) : (
                    colProjects.map((p) => {
                      const saving = kanbanStatusSavingId === p.id;
                      const updatedRaw =
                        p.updated_at != null ? p.updated_at : p.created_at;
                      return (
                        <div
                          key={p.id}
                          draggable={!saving}
                          onDragStart={(e) => beginKanbanCardDrag(e, p)}
                          onDragEnd={() => setKanbanDragOver(null)}
                          title={
                            saving
                              ? undefined
                              : "Drag anywhere on the card to move columns"
                          }
                          style={{
                            ...kanbanCard,
                            opacity: saving ? 0.72 : 1,
                            cursor: saving ? "wait" : "grab",
                          }}
                        >
                          <div aria-hidden style={kanbanCardGrip}>
                            <GripVertical size={16} color="#A1A1AA" />
                          </div>
                          <div style={kanbanCardMain}>
                            <h3 style={kanbanCardName}>
                              {p.name || "Untitled"}
                            </h3>

                            <div style={kanbanMetaRow}>
                              <ClipboardList
                                size={14}
                                color="#A1A1AA"
                                style={kanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span style={kanbanMetaLabel}>Status</span>
                              <div style={kanbanMetaValueCell}>
                                <select
                                  value={p.status || "not_started"}
                                  disabled={saving}
                                  onChange={(e) =>
                                    handlePatchProjectStatus(
                                      p.id,
                                      e.target.value
                                    )
                                  }
                                  style={{
                                    ...kanbanCardStatusSelect,
                                    ...projectStatusBadgeStyle(p.status),
                                    opacity: saving ? 0.65 : 1,
                                  }}
                                  aria-label={`Status for ${p.name || "project"}`}
                                >
                                  {PROJECT_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div style={kanbanMetaRow}>
                              <Calendar
                                size={14}
                                color="#A1A1AA"
                                style={kanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span style={kanbanMetaLabel}>Updated</span>
                              <span
                                style={kanbanMetaValueText}
                                title={formatProjectDate(updatedRaw)}
                              >
                                {formatProjectListDate(updatedRaw)}
                              </span>
                            </div>

                            <div style={kanbanMetaRow}>
                              <Languages
                                size={14}
                                color="#A1A1AA"
                                style={kanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span style={kanbanMetaLabel}>Languages</span>
                              <span
                                style={kanbanMetaValueText}
                                title={
                                  (p.source_language || "—") +
                                  " → " +
                                  (p.target_language || "—")
                                }
                              >
                                {(p.source_language || "—") +
                                  " → " +
                                  (p.target_language || "—")}
                              </span>
                            </div>

                            <div style={kanbanMetaRow}>
                              <Tag
                                size={14}
                                color="#A1A1AA"
                                style={kanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <span style={kanbanMetaLabel}>Category</span>
                              <span style={kanbanMetaValueText}>
                                {p.category ? (
                                  <span style={kanbanCatPill}>
                                    {p.category}
                                  </span>
                                ) : (
                                  <span style={kanbanMetaDash}>—</span>
                                )}
                              </span>
                            </div>

                            <div style={kanbanCardFooter}>
                              <UserRound
                                size={14}
                                color="#A1A1AA"
                                style={kanbanMetaIcon}
                                strokeWidth={2}
                                aria-hidden
                              />
                              <div style={kanbanCardFooterAssignee}>
                                <AssigneeSelect
                                  id={`kanban-assign-${p.id}`}
                                  label={null}
                                  hideLabel
                                  value={p.assigned_to_user_id}
                                  members={orgMembers}
                                  onChange={(uid) =>
                                    handleListAssigneeChange(p, uid)
                                  }
                                  disabled={
                                    listAssigneeSavingId === p.id || saving
                                  }
                                  style={{ gap: 0 }}
                                  selectStyle={{
                                    ...kanbanAssigneeSelect,
                                    opacity:
                                      listAssigneeSavingId === p.id
                                        ? 0.65
                                        : 1,
                                    cursor:
                                      listAssigneeSavingId === p.id
                                        ? "wait"
                                        : "pointer",
                                  }}
                                />
                              </div>
                              <span
                                style={kanbanFooterDate}
                                title={formatProjectDate(updatedRaw)}
                              >
                                {formatProjectListDate(updatedRaw)}
                              </span>
                            </div>

                            <div style={kanbanCardActions}>
                              <button
                                type="button"
                                className="projects-list-open-btn"
                                onClick={() =>
                                  onOpenProject && onOpenProject(p.id)
                                }
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
                                style={listIconBtn}
                                onClick={() => openEdit(p)}
                                title="Edit name"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                className="projects-list-ghost-btn projects-list-ghost-btn--danger"
                                style={listIconBtnDanger}
                                onClick={() => openDelete(p)}
                                title="Delete project"
                              >
                                <Trash2 size={16} />
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

      {projects.length === 0 && (
        <div style={emptyState}>
          <Folder size={40} color="#94A3B8" />
          <p style={emptyTitle}>No projects yet</p>
          <p style={emptySub}>Create one to start your dubbing workflow.</p>
        </div>
      )}

      {projects.length > 0 && filteredProjects.length === 0 && (
        <div style={emptyState}>
          <Folder size={40} color="#94A3B8" />
          <p style={emptyTitle}>
            {(() => {
              const hasSearch = Boolean(
                String(headerSearchQuery ?? "").trim()
              );
              const hasBar =
                statusFilter !== "all" ||
                categoryFilter !== "all" ||
                Boolean(projectDateFrom) ||
                Boolean(projectDateTo);
              if (hasSearch && hasBar)
                return "No projects match your search and filters";
              if (hasSearch) return "No projects match your search";
              if (hasBar) return "No projects match your filters";
              return "No projects to show";
            })()}
          </p>
          <p style={emptySub}>
            {String(headerSearchQuery ?? "").trim()
              ? "Clear the header search, adjust the filters below, or try different keywords."
              : "Use Reset filters or widen status, category, or the date range."}
          </p>
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <>
          <div style={modalOverlay} onClick={() => setShowModal(false)} />
          <div style={modalWrapper}>
            <div style={modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <div style={modalTitleWrap}>
                  <div style={modalIcon}>
                    <FolderPlus size={22} />
                  </div>
                  <div>
                    <h3 style={modalTitle}>Create new project</h3>
                    <div style={modalSubtitle}>Start a new dubbing workflow</div>
                  </div>
                </div>
                <button
                  type="button"
                  style={closeBtn}
                  onClick={() => setShowModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={formGroup}>
                <label style={label}>Series name</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  style={input}
                />
              </div>
              <div style={formGroup}>
                <label htmlFor="create-project-category" style={label}>
                  Category
                </label>
                <ProjectCategorySelect
                  id="create-project-category"
                  hideLabel
                  value={category}
                  onChange={setCategory}
                  options={PROJECT_CATEGORY_OPTIONS}
                  selectStyle={{ ...input, padding: "10px 12px" }}
                />
              </div>
              <div style={formGroup}>
                <label style={label}>Project status</label>
                <select
                  value={newProjectStatus}
                  onChange={(e) => setNewProjectStatus(e.target.value)}
                  style={input}
                >
                  {PROJECT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <AssigneeSelect
                id="create-project-assignee"
                label="Assign to (optional)"
                value={newProjectAssigneeId}
                members={orgMembers}
                onChange={setNewProjectAssigneeId}
                selectStyle={{ ...input, padding: "10px 12px" }}
              />
              <div style={formGroup}>
                <label style={label}>Source language</label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  style={input}
                >
                  <option>Turkish</option>
                  <option>English</option>
                </select>
              </div>
              <div style={formGroup}>
                <label style={label}>Target language</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  style={input}
                >
                  <option>Syrian Arabic</option>
                  <option>Arabic</option>
                </select>
              </div>
              <div style={formGroup}>
                <label style={label}>Abstract (optional)</label>
                <p style={fieldHint}>
                  Short series/film synopsis — GPT uses it for translation context
                  (tone, setting, relationships).
                </p>
                <textarea
                  value={seriesAbstract}
                  onChange={(e) => setSeriesAbstract(e.target.value)}
                  placeholder="e.g. Crime thriller; an inspector returns to her hometown…"
                  style={textarea}
                />
              </div>
              <div style={modalActions}>
                <button
                  type="button"
                  style={neutralBtn}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={primaryButton}
                  disabled={!projectName.trim()}
                  onClick={handleCreate}
                >
                  Create project
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit name modal */}
      {editTarget && (
        <>
          <div
            style={modalOverlay}
            onClick={() => !editLoading && setEditTarget(null)}
          />
          <div style={modalWrapper}>
            <div style={modalCardNarrow} onClick={(e) => e.stopPropagation()}>
              <div style={modalHeader}>
                <h3 style={modalTitle}>Edit project name</h3>
                <button
                  type="button"
                  style={closeBtn}
                  disabled={editLoading}
                  onClick={() => setEditTarget(null)}
                >
                  <X size={20} />
                </button>
              </div>
              <label style={label}>Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={input}
                autoFocus
              />
              <div style={modalActions}>
                <button
                  type="button"
                  style={neutralBtn}
                  disabled={editLoading}
                  onClick={() => setEditTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={primaryButton}
                  disabled={!editName.trim() || editLoading}
                  onClick={handleSaveEdit}
                >
                  {editLoading ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <>
          <div
            style={modalOverlayDark}
            onClick={() => !deleteLoading && setDeleteTarget(null)}
          />
          <div style={modalWrapper}>
            <div
              style={deleteModalCard}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={deleteModalIcon}>
                <Trash2 size={28} color="#DC2626" />
              </div>
              <h3 style={deleteModalTitle}>Delete project?</h3>
              <p style={deleteModalText}>
                This removes the project and its episodes, characters, scripts,
                and translations. This cannot be undone.
              </p>
              <p style={deleteModalHint}>
                Type the project name exactly to confirm:{" "}
                <strong style={{ color: "#111827" }}>{deleteTarget.name}</strong>
              </p>
              <input
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                style={deleteConfirmInputStyle}
                placeholder="Project name"
                autoComplete="off"
              />
              <div style={modalActions}>
                <button
                  type="button"
                  style={neutralBtn}
                  disabled={deleteLoading}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteConfirmInput("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={dangerBtn}
                  disabled={!deleteNameMatches || deleteLoading}
                  onClick={handleConfirmDelete}
                >
                  {deleteLoading ? "Deleting…" : "Delete forever"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const page = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  margin: "0 auto",
  boxSizing: "border-box",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "20px",
  flexWrap: "wrap",
  marginBottom: "28px",
  padding: "24px 28px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, #EEF2FF 0%, #F8FAFC 45%, #ECFDF5 100%)",
  border: "1px solid #E2E8F0",
};

const title = {
  fontSize: "1.85rem",
  fontWeight: 800,
  color: "#0F172A",
  margin: 0,
  letterSpacing: "-0.02em",
};

const subtitle = {
  fontSize: "0.95rem",
  color: "#64748B",
  marginTop: "8px",
  maxWidth: "520px",
  lineHeight: 1.5,
};

const primaryButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 20px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: "0.95rem",
  boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
};

const listShell = {
  background: "#FFFFFF",
  borderRadius: "16px",
  border: "1px solid #E4E4E7",
  boxShadow:
    "0 1px 3px rgba(15, 23, 42, 0.05), 0 10px 28px rgba(15, 23, 42, 0.04)",
  overflowX: "hidden",
  maxWidth: "100%",
  padding: "0 10px 4px 12px",
  boxSizing: "border-box",
};

const listTable = {
  width: "100%",
  maxWidth: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  boxSizing: "border-box",
};

const listThProject = {
  boxSizing: "border-box",
  borderLeft: "3px solid transparent",
  padding: "14px 8px 14px 13px",
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "0.64rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#71717A",
  background: "linear-gradient(180deg, #FAFAFA 0%, #F4F4F5 100%)",
};

const listTh = {
  boxSizing: "border-box",
  padding: "14px 8px",
  textAlign: "left",
  verticalAlign: "bottom",
  fontSize: "0.64rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: "#71717A",
  background: "linear-gradient(180deg, #FAFAFA 0%, #F4F4F5 100%)",
};

const listThActions = {
  boxSizing: "border-box",
  padding: "14px 0 14px 8px",
  textAlign: "right",
  verticalAlign: "bottom",
  background: "linear-gradient(180deg, #FAFAFA 0%, #F4F4F5 100%)",
};

const listTdProject = {
  boxSizing: "border-box",
  verticalAlign: "top",
  padding: "14px 8px 14px 13px",
  borderLeftWidth: "3px",
  borderLeftStyle: "solid",
  wordBreak: "break-word",
};

const listTdStatus = {
  boxSizing: "border-box",
  verticalAlign: "middle",
  padding: "14px 8px",
  textAlign: "left",
};

const listTdMiddle = {
  boxSizing: "border-box",
  verticalAlign: "middle",
  padding: "14px 8px",
  textAlign: "left",
};

const listTdActions = {
  boxSizing: "border-box",
  verticalAlign: "middle",
  padding: "14px 0 14px 8px",
  textAlign: "right",
};

const listTagsStack = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "6px",
};

const listDatesStack = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "8px",
};

const listActionsInner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: "8px",
  maxWidth: "100%",
};

const listProjectLead = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
};

const listRowIcon = {
  flexShrink: 0,
  width: "40px",
  height: "40px",
  borderRadius: "11px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const listProjectName = {
  margin: 0,
  padding: 0,
  fontWeight: 800,
  fontSize: "1.05rem",
  color: "#0F172A",
  lineHeight: 1.25,
  letterSpacing: "-0.02em",
  wordBreak: "break-word",
};

const listProjectLang = {
  margin: "10px 0 0",
  padding: 0,
  fontSize: "0.78rem",
  color: "#64748B",
  fontWeight: 500,
  lineHeight: 1.45,
  letterSpacing: "0.01em",
};

const listProjectIdLine = {
  marginTop: "6px",
  fontSize: "0.68rem",
  fontWeight: 600,
  color: "#94A3B8",
  letterSpacing: "0.04em",
};

const listStatusPill = {
  fontSize: "0.68rem",
  padding: "4px 9px",
  borderRadius: "999px",
  fontWeight: 700,
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
};

const listCatPill = {
  fontSize: "0.68rem",
  background: "#F1F5F9",
  color: "#475569",
  padding: "3px 8px",
  borderRadius: "999px",
  fontWeight: 600,
};

const listCatMuted = {
  fontSize: "0.72rem",
  color: "#CBD5E1",
  fontWeight: 500,
};

const listAssigneeSelect = {
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
  boxSizing: "border-box",
  padding: "5px 20px 5px 6px",
  fontSize: "0.74rem",
  fontWeight: 600,
  borderRadius: "8px",
};

const listDateBlock = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  lineHeight: 1.3,
};

const listDateCap = {
  fontSize: "0.62rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#94A3B8",
};

const listDateVal = {
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "#475569",
};

const listIconBtn = {
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

const listIconBtnDanger = {
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

const filterBar = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px 16px",
  marginBottom: "16px",
  padding: "14px 18px",
  borderRadius: "14px",
  background: "#F8FAFC",
  border: "1px solid #E2E8F0",
};

const viewOverviewBlock = {
  marginBottom: "14px",
  padding: "0 4px",
};

const viewOverviewTitle = {
  margin: "0 0 6px",
  fontSize: "1.05rem",
  fontWeight: 700,
  color: "#0F172A",
  letterSpacing: "-0.02em",
};

const viewOverviewHint = {
  margin: 0,
  fontSize: "0.84rem",
  lineHeight: 1.45,
  color: "#64748B",
  fontWeight: 500,
};

const filterBarMain = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "12px 16px",
  flex: "1 1 auto",
  minWidth: 0,
};

const viewToggleWrap = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px",
  borderRadius: "12px",
  background: "#FFFFFF",
  border: "1px solid #E2E8F0",
  flexShrink: 0,
};

const viewToggleBtn = {
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

const viewToggleBtnActive = {
  background: "#EEF2FF",
  color: "#3730A3",
  borderColor: "#C7D2FE",
  boxShadow: "0 1px 2px rgba(67, 56, 202, 0.12)",
};

const viewToggleLabel = {
  lineHeight: 1,
};

const projectsFiltersGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(158px, 1fr))",
  gap: "10px 12px",
  width: "100%",
  alignItems: "end",
};

const projectsFilterItem = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  minWidth: 0,
};

const projectsFilterLabel = {
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#64748B",
  fontWeight: 700,
};

const projectsDateInput = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #CBD5E1",
  borderRadius: "10px",
  background: "#fff",
  color: "#0F172A",
  padding: "9px 11px",
  fontSize: "0.84rem",
  fontFamily: "inherit",
  transition:
    "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
};

const projectsFilterResetWrap = {
  display: "flex",
  alignItems: "flex-end",
};

const projectsFilterResetBtn = {
  width: "100%",
  border: "1px solid #CBD5E1",
  borderRadius: "10px",
  background: "#fff",
  color: "#475569",
  fontSize: "0.84rem",
  fontWeight: 600,
  padding: "9px 12px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const projPickerAnchor = { position: "relative", minWidth: 0, width: "100%" };
const projPickerTrigger = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  width: "100%",
  boxSizing: "border-box",
  background: "#FFFFFF",
  padding: "9px 11px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "#0F172A",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition:
    "border-color 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease",
};
const projPickerTriggerOpen = {
  borderColor: "#A5B4FC",
  background: "#FFFFFF",
  boxShadow: "0 0 0 3px rgba(129, 140, 248, 0.18)",
};
const projPickerValue = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const projPickerMenu = {
  position: "absolute",
  top: "calc(100% + 7px)",
  left: 0,
  right: 0,
  zIndex: 220,
  background: "#FFFFFF",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  boxShadow:
    "0 16px 40px rgba(15,23,42,0.14), 0 0 0 1px rgba(99,102,241,0.06)",
  padding: "6px",
  maxHeight: "260px",
  overflowY: "auto",
};
const projPickerOption = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "none",
  borderRadius: "9px",
  background: "transparent",
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "#334155",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
};
const projPickerOptionActive = {
  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#3730A3",
  boxShadow: "inset 0 0 0 1px #C7D2FE",
};

const kanbanBoard = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  overflowX: "auto",
  padding: "12px 10px 14px",
  marginBottom: "8px",
  borderRadius: "16px",
  background: "#F4F4F5",
  border: "1px solid #E4E4E7",
  WebkitOverflowScrolling: "touch",
};

const kanbanColumn = {
  flex: "1 1 260px",
  minWidth: "240px",
  maxWidth: "340px",
  borderRadius: "12px",
  background: "#EBEBEC",
  border: "1px solid #DCDCDE",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  maxHeight: "min(70vh, 720px)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
};

const kanbanColumnDragOver = {
  borderColor: "#3B82F6",
  background: "#E8EEF9",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.65), 0 0 0 2px rgba(59, 130, 246, 0.35)",
};

const kanbanColumnHeader = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "10px",
  padding: "11px 12px 10px",
  borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)",
};

const kanbanColumnHeaderLeft = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
  flex: "1 1 auto",
};

const kanbanColumnDot = {
  width: "10px",
  height: "10px",
  borderRadius: "3px",
  flexShrink: 0,
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
};

const kanbanColumnTitle = {
  fontSize: "0.68rem",
  fontWeight: 800,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "#3F3F46",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const kanbanColumnCountBadge = {
  fontSize: "0.65rem",
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
  color: "#52525B",
  background: "#FFFFFF",
  border: "1px solid #D4D4D8",
  borderRadius: "999px",
  padding: "3px 9px",
  lineHeight: 1.2,
  flexShrink: 0,
};

const kanbanColumnBody = {
  flex: 1,
  overflowY: "auto",
  padding: "10px 8px 12px",
  display: "flex",
  flexDirection: "column",
  gap: "9px",
  minHeight: "120px",
};

const kanbanColumnEmpty = {
  margin: "20px 10px",
  fontSize: "0.78rem",
  color: "#A1A1AA",
  textAlign: "center",
  lineHeight: 1.45,
  fontWeight: 500,
};

const kanbanCard = {
  display: "flex",
  gap: "6px",
  alignItems: "flex-start",
  background: "#FFFFFF",
  borderRadius: "10px",
  border: "1px solid #E4E4E7",
  padding: "12px 12px 12px 8px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
};

const kanbanCardGrip = {
  flexShrink: 0,
  padding: "2px 0 0",
  borderRadius: "6px",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  alignSelf: "stretch",
};

const kanbanCardMain = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const kanbanCardName = {
  margin: "0 0 2px",
  fontSize: "0.9rem",
  fontWeight: 700,
  color: "#18181B",
  lineHeight: 1.35,
  wordBreak: "break-word",
};

const kanbanMetaRow = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  minWidth: 0,
};

const kanbanMetaIcon = {
  flexShrink: 0,
  marginTop: "1px",
};

const kanbanMetaLabel = {
  flex: "0 0 64px",
  fontSize: "0.62rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#A1A1AA",
  lineHeight: 1.2,
};

const kanbanMetaValueCell = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  justifyContent: "flex-end",
};

const kanbanMetaValueText = {
  flex: 1,
  minWidth: 0,
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#52525B",
  textAlign: "right",
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const kanbanMetaDash = {
  color: "#D4D4D8",
  fontWeight: 600,
};

const kanbanCatPill = {
  display: "inline-block",
  fontSize: "0.65rem",
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#F4F4F5",
  color: "#52525B",
  border: "1px solid #E4E4E7",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const kanbanCardFooter = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "4px",
  paddingTop: "10px",
  borderTop: "1px solid #F4F4F5",
};

const kanbanCardFooterAssignee = {
  flex: 1,
  minWidth: 0,
};

const kanbanFooterDate = {
  flexShrink: 0,
  fontSize: "0.68rem",
  fontWeight: 600,
  color: "#71717A",
  whiteSpace: "nowrap",
};

const kanbanAssigneeSelect = {
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
  boxSizing: "border-box",
  padding: "5px 20px 5px 6px",
  fontSize: "0.72rem",
  fontWeight: 600,
  borderRadius: "8px",
};

const kanbanCardStatusSelect = {
  width: "100%",
  maxWidth: "100%",
  minWidth: "0",
  boxSizing: "border-box",
  fontSize: "0.65rem",
  fontWeight: 700,
  padding: "4px 20px 4px 10px",
  borderRadius: "999px",
  cursor: "pointer",
  fontFamily: "inherit",
};

const kanbanCardActions = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "2px",
  paddingTop: "10px",
  borderTop: "1px solid #F4F4F5",
};

const emptyState = {
  textAlign: "center",
  padding: "48px 24px",
  color: "#64748B",
};

const emptyTitle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  color: "#475569",
  margin: "12px 0 4px",
};

const emptySub = {
  fontSize: "0.9rem",
  margin: 0,
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.35)",
  backdropFilter: "blur(4px)",
  zIndex: 999,
};

const modalOverlayDark = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.55)",
  backdropFilter: "blur(5px)",
  zIndex: 999,
};

const modalWrapper = {
  position: "fixed",
  inset: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "20px",
};

const modalCard = {
  background: "#ffffff",
  borderRadius: "20px",
  padding: "36px",
  width: "100%",
  maxWidth: "560px",
  boxShadow: "0 25px 60px rgba(0,0,0,0.2)",
  border: "1px solid #E2E8F0",
};

const modalCardNarrow = {
  ...modalCard,
  maxWidth: "420px",
};

const deleteModalCard = {
  background: "#ffffff",
  borderRadius: "20px",
  padding: "32px",
  width: "100%",
  maxWidth: "440px",
  boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
  border: "1px solid #FECACA",
};

const deleteModalIcon = {
  width: "56px",
  height: "56px",
  borderRadius: "16px",
  background: "#FEF2F2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px",
};

const deleteModalTitle = {
  margin: "0 0 10px",
  fontSize: "1.35rem",
  fontWeight: 800,
  color: "#991B1B",
};

const deleteModalText = {
  margin: "0 0 12px",
  fontSize: "0.92rem",
  color: "#475569",
  lineHeight: 1.55,
};

const deleteModalHint = {
  margin: "0 0 10px",
  fontSize: "0.88rem",
  color: "#64748B",
  lineHeight: 1.5,
};

const deleteConfirmInputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "2px solid #E2E8F0",
  fontSize: "0.95rem",
  marginBottom: "20px",
  boxSizing: "border-box",
};

const dangerBtn = {
  padding: "12px 20px",
  borderRadius: "10px",
  border: "none",
  background: "#DC2626",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  opacity: 1,
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "24px",
};

const modalTitleWrap = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
};

const modalIcon = {
  background: "#EEF2FF",
  color: "#4338CA",
  padding: "12px",
  borderRadius: "12px",
  display: "flex",
};

const modalTitle = {
  margin: 0,
  fontSize: "1.35rem",
  fontWeight: 700,
  color: "#0F172A",
};

const modalSubtitle = {
  fontSize: "0.9rem",
  color: "#64748B",
  marginTop: "4px",
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

const fieldHint = {
  fontSize: "0.78rem",
  lineHeight: 1.45,
  color: "#64748B",
  margin: "0 0 8px 0",
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #CBD5E1",
  fontSize: "0.95rem",
  background: "#F8FAFC",
  color: "#0F172A",
  boxSizing: "border-box",
};

const textarea = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #CBD5E1",
  minHeight: "100px",
  resize: "vertical",
  background: "#ffffff",
  color: "#0F172A",
  boxSizing: "border-box",
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "12px",
  marginTop: "8px",
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

/* eslint-disable react/prop-types -- local filter control; parent page has no PropTypes */
function ProjectsFilterPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const current =
    options.find((o) => String(o.value) === String(value)) || options[0];

  return (
    <div ref={rootRef} style={projPickerAnchor}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          ...projPickerTrigger,
          ...(open ? projPickerTriggerOpen : {}),
        }}
      >
        <span style={projPickerValue}>{current?.label || "Select"}</span>
        <ChevronDown
          size={17}
          style={{
            color: "#64748B",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
          aria-hidden
        />
      </button>
      {open && (
        <div role="listbox" style={projPickerMenu}>
          {options.map((opt) => {
            const selected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(String(opt.value));
                  setOpen(false);
                }}
                style={{
                  ...projPickerOption,
                  ...(selected ? projPickerOptionActive : {}),
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
/* eslint-enable react/prop-types */
