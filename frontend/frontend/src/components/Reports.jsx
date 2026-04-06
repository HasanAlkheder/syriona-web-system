import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  Folder,
  Film,
  FileText,
  CheckCircle,
  BarChart3,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

import { API_BASE_HINT, apiFetch } from "../api/client";

const EPISODE_STATUS_OPTIONS = [
  { value: "all", label: "All episode statuses" },
  { value: "new", label: "New" },
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "on_hold", label: "On hold" },
];

function formatInt(n) {
  if (n == null || Number.isNaN(Number(n))) return "?";
  return Number(n).toLocaleString();
}

function asDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildReportQuery(filters) {
  const q = new URLSearchParams();
  q.set("date_range", filters.dateRange);
  if (filters.dateRange === "custom") {
    if (filters.startDate) q.set("start_date", filters.startDate);
    if (filters.endDate) q.set("end_date", filters.endDate);
  }
  if (filters.projectId !== "all") q.set("project_id", filters.projectId);
  if (filters.episodeStatus !== "all") q.set("episode_status", filters.episodeStatus);
  if (filters.assigneeId !== "all") q.set("assignee_id", filters.assigneeId);
  if (filters.sourceLanguage !== "all") q.set("source_language", filters.sourceLanguage);
  if (filters.targetLanguage !== "all") q.set("target_language", filters.targetLanguage);
  return q.toString();
}

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: "10px",
  boxShadow: "0 8px 24px rgba(15,23,42,0.1)",
  fontSize: "0.85rem",
  padding: "10px 12px",
};

function ChartTooltip({ active, payload, label, mode }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  const raw = payload[0]?.value ?? 0;
  const value = Number(raw);

  if (mode === "weekly") {
    return (
      <div style={tooltipStyle}>
        <div style={tooltipHead}>{row.full_date || label || "?"}</div>
        <div style={tooltipRow}>
          <span style={tooltipKey}>Translations</span>
          <span style={tooltipVal}>{`${Number.isFinite(value) ? value : 0} row(s)`}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={tooltipStyle}>
      <div style={tooltipHead}>{row.name || label || "Episode"}</div>
      <div style={tooltipRow}>
        <span style={tooltipKey}>Progress</span>
        <span style={tooltipVal}>{`${Number.isFinite(value) ? value : 0}%`}</span>
      </div>
      {typeof row.lines_total === "number" && typeof row.lines_dubbed === "number" ? (
        <div style={tooltipSub}>{`${row.lines_dubbed}/${row.lines_total} lines dubbed`}</div>
      ) : null}
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);

  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      dateRange: "7d",
      startDate: asDateInputValue(weekAgo),
      endDate: asDateInputValue(today),
      projectId: "all",
      episodeStatus: "all",
      assigneeId: "all",
      sourceLanguage: "all",
      targetLanguage: "all",
    };
  });

  const loadFilterOptions = useCallback(async () => {
    try {
      const [projectsRes, usersRes] = await Promise.all([
        apiFetch("/projects/"),
        apiFetch("/users/"),
      ]);
      const projectsJson = projectsRes.ok ? await projectsRes.json() : [];
      const usersJson = usersRes.ok ? await usersRes.json() : [];
      setProjects(Array.isArray(projectsJson) ? projectsJson : []);
      setMembers(Array.isArray(usersJson) ? usersJson : []);
    } catch {
      setProjects([]);
      setMembers([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildReportQuery(filters);
      const res = await apiFetch(`/reports/analytics?${query}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e?.message || "Failed to load reports");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    load();
  }, [load]);

  const languageOptions = useMemo(() => {
    const srcSet = new Set();
    const dstSet = new Set();
    for (const p of projects) {
      if (p?.source_language) srcSet.add(p.source_language);
      if (p?.target_language) dstSet.add(p.target_language);
    }
    return {
      source: [...srcSet].sort((a, b) => a.localeCompare(b)),
      target: [...dstSet].sort((a, b) => a.localeCompare(b)),
    };
  }, [projects]);

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(filters.projectId)) || null,
    [projects, filters.projectId]
  );
  const dateRangeOptions = useMemo(
    () => [
      { value: "7d", label: "Last 7 days" },
      { value: "30d", label: "Last 30 days" },
      { value: "90d", label: "Last 90 days" },
      { value: "custom", label: "Custom" },
    ],
    []
  );
  const projectOptions = useMemo(
    () => [
      { value: "all", label: "All projects" },
      ...projects.map((p) => ({
        value: String(p.id),
        label: p.name || `Project #${p.id}`,
      })),
    ],
    [projects]
  );
  const assigneeOptions = useMemo(
    () => [
      { value: "all", label: "All assignees" },
      ...members.map((m) => ({
        value: String(m.id),
        label: m.full_name || m.email || `User #${m.id}`,
      })),
    ],
    [members]
  );
  const sourceLangOptions = useMemo(
    () => [
      { value: "all", label: "All sources" },
      ...languageOptions.source.map((s) => ({ value: s, label: s })),
    ],
    [languageOptions.source]
  );
  const targetLangOptions = useMemo(
    () => [
      { value: "all", label: "All targets" },
      ...languageOptions.target.map((t) => ({ value: t, label: t })),
    ],
    [languageOptions.target]
  );

  const stats = useMemo(() => {
    if (!data) {
      return [
        {
          label: "Total projects",
          value: "?",
          icon: <Folder size={20} />,
          color: "#2563EB",
          tint: "indigo",
        },
        {
          label: "Total episodes",
          value: "?",
          icon: <Film size={20} />,
          color: "#7C3AED",
          tint: "violet",
        },
        {
          label: "Lines dubbed",
          value: "?",
          sub: "Sentences with a saved translation",
          icon: <FileText size={20} />,
          color: "#EA580C",
          tint: "orange",
        },
        {
          label: "Completion rate",
          value: "?",
          sub: "Dubbed lines ? script lines",
          icon: <CheckCircle size={20} />,
          color: "#059669",
          tint: "emerald",
        },
      ];
    }
    const pct = Number(data.completion_rate);
    return [
      {
        label: "Total projects",
        value: formatInt(data.project_count),
        icon: <Folder size={20} />,
        color: "#2563EB",
        tint: "indigo",
      },
      {
        label: "Total episodes",
        value: formatInt(data.episode_count),
        icon: <Film size={20} />,
        color: "#7C3AED",
        tint: "violet",
      },
      {
        label: "Lines dubbed",
        value: formatInt(data.dubbed_sentence_count),
        sub: `${formatInt(data.translation_row_count)} translation rows stored`,
        icon: <FileText size={20} />,
        color: "#EA580C",
        tint: "orange",
      },
      {
        label: "Completion rate",
        value: `${Number.isFinite(pct) ? pct : 0}%`,
        sub:
          data.sentence_count > 0
            ? `${formatInt(data.dubbed_sentence_count)} of ${formatInt(data.sentence_count)} script lines`
            : "No script lines yet",
        icon: <CheckCircle size={20} />,
        color: "#059669",
        tint: "emerald",
      },
    ];
  }, [data]);

  const weekly = data?.weekly_translations ?? [];
  const progress = data?.episode_progress ?? [];
  const weeklyMax = useMemo(() => Math.max(1, ...weekly.map((d) => d.lines || 0)), [weekly]);
  const hasWeeklyData = weekly.some((d) => d.lines > 0);
  const hasProgressData = progress.length > 0;

  return (
    <div style={outer}>
      <div style={hero}>
        <div style={heroRow}>
          <div style={heroIcon}>
            <BarChart3 size={26} color="#4338CA" strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={title}>Reports &amp; Analytics</h2>
            <p style={subtitle}>
              Customizable metrics by date, project, status, assignee, and language pair.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{ ...refreshBtn, opacity: loading ? 0.65 : 1 }}
          >
            <RefreshCw
              size={18}
              style={{ animation: loading ? "reports-spin 0.85s linear infinite" : "none" }}
            />
            Refresh
          </button>
        </div>

        <div style={filtersWrap}>
          <label style={filterItem}>
            <span style={filterLabel}>Date range</span>
            <ReportsFilterPicker
              value={filters.dateRange}
              options={dateRangeOptions}
              onChange={(v) => setFilters((f) => ({ ...f, dateRange: v }))}
            />
          </label>

          {filters.dateRange === "custom" && (
            <>
              <label style={filterItem}>
                <span style={filterLabel}>From</span>
                <input
                  type="date"
                  value={filters.startDate}
                  style={filterControl}
                  onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                />
              </label>
              <label style={filterItem}>
                <span style={filterLabel}>To</span>
                <input
                  type="date"
                  value={filters.endDate}
                  style={filterControl}
                  onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                />
              </label>
            </>
          )}

          <label style={filterItem}>
            <span style={filterLabel}>Project</span>
            <ReportsFilterPicker
              value={filters.projectId}
              options={projectOptions}
              onChange={(v) => setFilters((f) => ({ ...f, projectId: v }))}
            />
          </label>

          <label style={filterItem}>
            <span style={filterLabel}>Episode status</span>
            <ReportsFilterPicker
              value={filters.episodeStatus}
              options={EPISODE_STATUS_OPTIONS}
              onChange={(v) => setFilters((f) => ({ ...f, episodeStatus: v }))}
            />
          </label>

          <label style={filterItem}>
            <span style={filterLabel}>Assignee</span>
            <ReportsFilterPicker
              value={filters.assigneeId}
              options={assigneeOptions}
              onChange={(v) => setFilters((f) => ({ ...f, assigneeId: v }))}
            />
          </label>

          <label style={filterItem}>
            <span style={filterLabel}>Source language</span>
            <ReportsFilterPicker
              value={filters.sourceLanguage}
              options={sourceLangOptions}
              onChange={(v) => setFilters((f) => ({ ...f, sourceLanguage: v }))}
            />
          </label>

          <label style={filterItem}>
            <span style={filterLabel}>Target language</span>
            <ReportsFilterPicker
              value={filters.targetLanguage}
              options={targetLangOptions}
              onChange={(v) => setFilters((f) => ({ ...f, targetLanguage: v }))}
            />
          </label>

          <button
            type="button"
            style={resetBtn}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                dateRange: "7d",
                projectId: "all",
                episodeStatus: "all",
                assigneeId: "all",
                sourceLanguage: "all",
                targetLanguage: "all",
              }))
            }
          >
            Reset
          </button>
        </div>

        {selectedProject ? (
          <div style={scopeBanner}>Scope: {selectedProject.name || `Project #${selectedProject.id}`}</div>
        ) : null}

        {error && <div style={errorBanner}>{error}. {API_BASE_HINT}</div>}
      </div>

      <div style={cardShell}>
        <div style={cardGrid}>
          {stats.map((item, i) => (
            <div key={i} style={{ ...card, background: tintBg(item.tint) }}>
              <div style={cardTop}>
                <div style={{ ...iconCircle, backgroundColor: `${item.color}22`, color: item.color }}>{item.icon}</div>
              </div>
              <div style={cardValue}>{loading && !data ? "?" : item.value}</div>
              <div style={cardLabel}>{item.label}</div>
              {item.sub ? <div style={cardSub}>{item.sub}</div> : null}
            </div>
          ))}
        </div>

        <div style={chartsGrid}>
          <div style={chartCard}>
            <div style={chartHead}>
              <h3 style={chartTitle}>Translation activity</h3>
              <span style={chartHint}>New translation rows per day (UTC)</span>
            </div>
            {!loading && !hasWeeklyData && weekly.length > 0 && (
              <p style={chartEmpty}>No translations recorded in the selected range.</p>
            )}
            <div style={{ height: 280, opacity: loading ? 0.45 : 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekly.length ? weekly : [{ name: "?", lines: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[0, Math.ceil(weeklyMax * 1.15)]} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip mode="weekly" />} />
                  <Bar dataKey="lines" fill="url(#barGrad)" radius={[10, 10, 0, 0]} />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={chartCard}>
            <div style={chartHead}>
              <h3 style={chartTitle}>Episode progress</h3>
              <span style={chartHint}>% of script lines with a non-empty translation</span>
            </div>
            {!loading && !hasProgressData && (
              <p style={chartEmpty}>No matching episodes with script lines for the selected filters.</p>
            )}
            <div style={{ height: 280, opacity: loading ? 0.45 : 1 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progress.length ? progress : [{ name: "?", progress: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={68} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
                  <Tooltip content={<ChartTooltip mode="progress" />} />
                  <Line type="monotone" dataKey="progress" stroke="#059669" strokeWidth={3} dot={{ r: 5, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes reports-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function ReportsFilterPicker({ value, options, onChange }) {
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

  const current = options.find((o) => String(o.value) === String(value)) || options[0];

  return (
    <div ref={rootRef} style={pickerAnchor}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          ...pickerTrigger,
          ...(open ? pickerTriggerOpen : {}),
        }}
      >
        <span style={pickerValue}>{current?.label || "Select"}</span>
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
        <div role="listbox" style={pickerMenu}>
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
                  ...pickerOption,
                  ...(selected ? pickerOptionActive : {}),
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

function tintBg(tint) {
  switch (tint) {
    case "violet":
      return "linear-gradient(145deg, #FAF5FF 0%, #F3E8FF 100%)";
    case "orange":
      return "linear-gradient(145deg, #FFF7ED 0%, #FFEDD5 100%)";
    case "emerald":
      return "linear-gradient(145deg, #ECFDF5 0%, #D1FAE5 100%)";
    default:
      return "linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%)";
  }
}

const outer = {
  width: "100%",
  maxWidth: "min(1440px, 100%)",
  margin: "0 auto",
  padding: "8px 0 32px",
  boxSizing: "border-box",
};

const hero = {
  marginBottom: "22px",
  padding: "22px 24px",
  borderRadius: "20px",
  background: "linear-gradient(120deg, #EEF2FF 0%, #FAF5FF 48%, #F0FDFA 100%)",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
};

const heroRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
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

const title = { margin: 0, fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#0F172A" };
const subtitle = { marginTop: "8px", fontSize: "0.92rem", color: "#64748B", lineHeight: 1.55, maxWidth: "700px" };

const refreshBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid #C7D2FE",
  background: "#FFFFFF",
  color: "#4338CA",
  fontWeight: 600,
  fontSize: "0.88rem",
  fontFamily: "inherit",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(67,56,202,0.08)",
  alignSelf: "flex-start",
};

const filtersWrap = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "10px 12px",
  marginTop: "14px",
  padding: "12px",
  background: "rgba(255,255,255,0.74)",
  border: "1px solid #E2E8F0",
  borderRadius: "14px",
};

const filterItem = { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0 };
const filterLabel = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748B", fontWeight: 700 };
const filterControl = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  border: "1px solid #CBD5E1",
  borderRadius: "10px",
  background: "#fff",
  color: "#0F172A",
  padding: "9px 36px 9px 11px",
  fontSize: "0.84rem",
  fontFamily: "inherit",
  transition: "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
};
const pickerAnchor = { position: "relative", minWidth: 0, width: "100%" };
const pickerTrigger = {
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
  transition: "border-color 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease",
};
const pickerTriggerOpen = {
  borderColor: "#A5B4FC",
  background: "#FFFFFF",
  boxShadow: "0 0 0 3px rgba(129, 140, 248, 0.18)",
};
const pickerValue = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};
const pickerMenu = {
  position: "absolute",
  top: "calc(100% + 7px)",
  left: 0,
  right: 0,
  zIndex: 220,
  background: "#FFFFFF",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 16px 40px rgba(15,23,42,0.14), 0 0 0 1px rgba(99,102,241,0.06)",
  padding: "6px",
  maxHeight: "260px",
  overflowY: "auto",
};
const pickerOption = {
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
const pickerOptionActive = {
  background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  color: "#3730A3",
  boxShadow: "inset 0 0 0 1px #C7D2FE",
};

const resetBtn = {
  alignSelf: "end",
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

const scopeBanner = {
  marginTop: "10px",
  padding: "8px 10px",
  borderRadius: "10px",
  background: "#EEF2FF",
  color: "#3730A3",
  fontSize: "0.8rem",
  fontWeight: 600,
  border: "1px solid #C7D2FE",
};

const errorBanner = {
  marginTop: "14px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  color: "#991B1B",
  fontSize: "0.88rem",
};

const cardShell = { background: "#FFFFFF", borderRadius: "20px", border: "1px solid #E2E8F0", padding: "28px", boxShadow: "0 4px 24px rgba(15,23,42,0.05)" };
const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginBottom: "32px" };
const card = { borderRadius: "16px", padding: "22px", border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(15,23,42,0.05)" };
const cardTop = { display: "flex", justifyContent: "flex-start", marginBottom: "14px" };
const iconCircle = { width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" };
const cardValue = { fontSize: "1.85rem", fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" };
const cardLabel = { fontSize: "0.88rem", fontWeight: 600, color: "#475569", marginTop: "6px" };
const cardSub = { fontSize: "0.75rem", color: "#94A3B8", marginTop: "6px", lineHeight: 1.4 };

const chartsGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: "24px" };
const chartCard = { background: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)", borderRadius: "16px", padding: "20px 18px 12px", border: "1px solid #E2E8F0" };
const chartHead = { marginBottom: "12px" };
const chartTitle = { margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1E293B" };
const chartHint = { display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#64748B", marginTop: "4px" };
const chartEmpty = { fontSize: "0.85rem", lineHeight: 1.5, marginBottom: "12px", padding: "10px 12px", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "10px", color: "#92400E" };
const tooltipHead = { fontSize: "0.72rem", fontWeight: 700, color: "#64748B", marginBottom: "5px" };
const tooltipRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" };
const tooltipKey = { fontSize: "0.76rem", color: "#475569", fontWeight: 600 };
const tooltipVal = { fontSize: "0.82rem", color: "#0F172A", fontWeight: 800 };
const tooltipSub = { marginTop: "5px", fontSize: "0.74rem", color: "#64748B", fontWeight: 600 };
