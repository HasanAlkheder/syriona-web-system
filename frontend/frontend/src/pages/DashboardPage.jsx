import { useState, useEffect, useCallback } from "react";
import {
  Folder,
  Film,
  Activity,
  Languages,
  Plus,
  Zap,
  RefreshCw,
  LayoutDashboard,
} from "lucide-react";

import { API_BASE_HINT, apiFetch } from "../api/client";

function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatInt(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString();
}

const emptyStats = {
  project_count: 0,
  episode_count: 0,
  sentence_count: 0,
  character_count: 0,
  translation_row_count: 0,
  translations_today: 0,
  dubbed_sentence_count: 0,
  last_translation_model: "—",
  activities: [],
};

export default function DashboardPage({
  onCreateProject,
  onOpenProjects,
  onTranslateSingle,
}) {
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/dashboard/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats({
        ...emptyStats,
        ...data,
        activities: Array.isArray(data.activities) ? data.activities : [],
      });
    } catch (e) {
      setError(e?.message || "Could not load dashboard");
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={pageWrap}>
      <div style={hero}>
        <div style={heroRow}>
          <div style={heroIcon}>
            <LayoutDashboard size={26} color="#4338CA" strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={title}>Dashboard</h1>
            <p style={subtitle}>
              Live counts from your database — projects, episodes, script lines,
              and translations.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              ...refreshBtn,
              opacity: loading ? 0.65 : 1,
            }}
            title="Refresh"
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
        {error && (
          <div style={errorBanner}>
            {error}. {API_BASE_HINT}
          </div>
        )}
      </div>

      <div style={kpiGrid}>
        <KpiCard
          icon={<Folder size={18} />}
          label="Total projects"
          value={loading ? "…" : formatInt(stats.project_count)}
          color="#2563EB"
          tint="indigo"
        />
        <KpiCard
          icon={<Film size={18} />}
          label="Episodes"
          value={loading ? "…" : formatInt(stats.episode_count)}
          color="#7C3AED"
          tint="violet"
        />
        <KpiCard
          icon={<Activity size={18} />}
          label="Translations today (UTC)"
          value={loading ? "…" : formatInt(stats.translations_today)}
          color="#EA580C"
          tint="orange"
        />
        <KpiCard
          icon={<Languages size={18} />}
          label="Lines dubbed"
          value={loading ? "…" : formatInt(stats.dubbed_sentence_count)}
          color="#059669"
          tint="emerald"
        />
      </div>

      <div className="dashboard-main-grid" style={mainGrid}>
        <div style={card}>
          <div style={cardHead}>
            <h3 style={sectionTitle}>Recent activity</h3>
            <span style={cardMeta}>
              {stats.activities.length} event
              {stats.activities.length === 1 ? "" : "s"}
            </span>
          </div>
          {loading ? (
            <p style={muted}>Loading activity…</p>
          ) : stats.activities.length === 0 ? (
            <p style={muted}>
              No projects or episodes yet. Create a project and add episodes to
              see activity here.
            </p>
          ) : (
            <div
              className="dashboard-activity-scroll"
              style={activityScroll}
            >
              {stats.activities.map((a, i) => (
                <ActivityItem
                  key={`${a.kind}-${a.at}-${i}`}
                  kind={a.kind}
                  title={a.title}
                  detail={a.detail}
                  time={formatRelativeTime(a.at)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={sectionTitle}>System status</h3>
          <StatusRow
            label="API"
            value={error ? "Unavailable" : "Connected"}
            valueColor={error ? "#DC2626" : "#059669"}
          />
          <StatusRow
            label="Translation model"
            value={
              loading ? "…" : stats.last_translation_model || "—"
            }
            valueColor="#4338CA"
          />
          <StatusRow
            label="Script lines"
            value={loading ? "…" : formatInt(stats.sentence_count)}
          />
          <StatusRow
            label="Characters"
            value={loading ? "…" : formatInt(stats.character_count)}
          />
          <StatusRow
            label="Translation rows"
            hint="All versions stored"
            value={loading ? "…" : formatInt(stats.translation_row_count)}
          />
        </div>

        <div style={{ ...card, gridColumn: "1 / -1" }}>
          <h3 style={sectionTitle}>Quick actions</h3>
          <div style={actionRow}>
            <ActionButton
              variant="primary"
              icon={<Plus size={18} />}
              label="Create project"
              onClick={() => onCreateProject?.()}
            />
            <ActionButton
              variant="secondary"
              icon={<Folder size={18} />}
              label="Open projects"
              onClick={() => onOpenProjects?.()}
            />
            <ActionButton
              variant="secondary"
              icon={<Zap size={18} />}
              label="Translate single sentence"
              onClick={() => onTranslateSingle?.()}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ icon, label, value, color, tint }) {
  const bg =
    tint === "violet"
      ? "linear-gradient(145deg, #FAF5FF 0%, #F3E8FF 100%)"
      : tint === "orange"
        ? "linear-gradient(145deg, #FFF7ED 0%, #FFEDD5 100%)"
        : tint === "emerald"
          ? "linear-gradient(145deg, #ECFDF5 0%, #D1FAE5 100%)"
          : "linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%)";

  return (
    <div style={{ ...kpiCard, background: bg }}>
      <div style={{ ...accentBar, background: color }} />
      <div style={kpiContent}>
        <div style={{ ...iconWrap, background: `${color}22`, color }}>
          {icon}
        </div>
        <div>
          <div style={{ ...kpiValue, color: "#0F172A" }}>{value}</div>
          <div style={kpiLabel}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ kind, title, detail, time }) {
  const dot =
    kind === "project"
      ? "#7C3AED"
      : "#2563EB";
  return (
    <div style={activityItem}>
      <div style={{ ...activityDot, background: dot }} />
      <div style={{ minWidth: 0 }}>
        <div style={activityTitle}>{title}</div>
        {detail ? <div style={activityDetail}>{detail}</div> : null}
        <div style={activityTime}>{time}</div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, valueColor, hint }) {
  return (
    <div style={statusRow}>
      <div>
        <span style={statusLabel}>{label}</span>
        {hint ? <div style={statusHint}>{hint}</div> : null}
      </div>
      <span
        style={{
          ...statusValue,
          color: valueColor || "#0F172A",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ActionButton({ icon, label, onClick, variant }) {
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      style={{
        ...actionButton,
        ...(isPrimary ? actionPrimary : actionSecondary),
      }}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

const pageWrap = {
  width: "100%",
  maxWidth: "min(1440px, 100%)",
  margin: "0 auto",
  padding: "8px 0 40px",
  boxSizing: "border-box",
  color: "#0F172A",
};

const hero = {
  marginBottom: "24px",
  padding: "22px 24px",
  borderRadius: "20px",
  background:
    "linear-gradient(120deg, #EEF2FF 0%, #FAF5FF 48%, #F0FDFA 100%)",
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

const title = {
  fontSize: "1.75rem",
  fontWeight: 800,
  margin: 0,
  letterSpacing: "-0.02em",
  color: "#0F172A",
};

const subtitle = {
  fontSize: "0.92rem",
  color: "#64748B",
  marginTop: "8px",
  lineHeight: 1.55,
  maxWidth: "560px",
};

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

const errorBanner = {
  marginTop: "14px",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#FEF2F2",
  border: "1px solid #FECACA",
  color: "#991B1B",
  fontSize: "0.88rem",
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const kpiCard = {
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  overflow: "hidden",
  boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
};

const accentBar = {
  height: "4px",
};

const kpiContent = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "18px 18px 20px",
};

const iconWrap = {
  padding: "11px",
  borderRadius: "12px",
  display: "flex",
};

const kpiValue = {
  fontSize: "1.5rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
};

const kpiLabel = {
  fontSize: "0.8rem",
  color: "#64748B",
  marginTop: "4px",
  fontWeight: 600,
  lineHeight: 1.35,
};

const mainGrid = {
  display: "grid",
  gap: "20px",
};

const card = {
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  padding: "22px 24px",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
};

const cardHead = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "16px",
};

const sectionTitle = {
  fontSize: "1.05rem",
  fontWeight: 700,
  margin: 0,
  color: "#1E293B",
};

const cardMeta = {
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6366F1",
  background: "#EEF2FF",
  padding: "5px 10px",
  borderRadius: "999px",
};

const muted = {
  fontSize: "0.92rem",
  color: "#64748B",
  lineHeight: 1.5,
  margin: 0,
};

const activityScroll = {
  maxHeight: "min(340px, 42vh)",
  overflowY: "auto",
  marginRight: "-4px",
  paddingRight: "8px",
  scrollbarWidth: "thin",
  scrollbarColor: "#CBD5E1 #F1F5F9",
};

const activityItem = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  padding: "12px 0",
  borderBottom: "1px solid #F1F5F9",
};

const activityDot = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  marginTop: "5px",
  flexShrink: 0,
};

const activityTitle = {
  fontSize: "0.9rem",
  fontWeight: 600,
  color: "#0F172A",
};

const activityDetail = {
  fontSize: "0.82rem",
  color: "#64748B",
  marginTop: "3px",
};

const activityTime = {
  fontSize: "0.78rem",
  color: "#94A3B8",
  marginTop: "4px",
  fontWeight: 600,
};

const statusRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "16px",
  paddingBottom: "14px",
  borderBottom: "1px solid #F1F5F9",
};

const statusLabel = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#64748B",
};

const statusHint = {
  fontSize: "0.72rem",
  color: "#94A3B8",
  marginTop: "4px",
};

const statusValue = {
  fontSize: "0.88rem",
  fontWeight: 700,
  textAlign: "right",
};

const actionRow = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const actionButton = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 20px",
  borderRadius: "14px",
  fontWeight: 600,
  fontSize: "0.92rem",
  fontFamily: "inherit",
  cursor: "pointer",
  transition: "transform 0.15s ease, box-shadow 0.2s ease",
  border: "2px solid transparent",
};

const actionPrimary = {
  background: "linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)",
  color: "#FFFFFF",
  borderColor: "#4338CA",
  boxShadow: "0 8px 22px rgba(67, 56, 202, 0.3)",
};

const actionSecondary = {
  background: "#FFFFFF",
  color: "#475569",
  borderColor: "#E2E8F0",
  boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
};
