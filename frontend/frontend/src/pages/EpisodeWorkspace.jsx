import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Clapperboard,
  FileText,
  Mic2,
  Download,
} from "lucide-react";

import ScriptTab from "../components/script/ScriptTab";
import DubbingTab from "../components/dubbing/DubbingTab";
import ExportTab from "./ExportTab";
import { apiFetch } from "../api/client";
import { memberLabel } from "../components/AssigneeSelect";

const TABS = [
  { id: "script", label: "Script", Icon: FileText },
  { id: "dubbing", label: "Dubbing", Icon: Mic2 },
  { id: "export", label: "Export", Icon: Download },
];

export default function EpisodeWorkspace({
  projectId,
  episodeId,
  episodeName = "Episode 12",
  headerSearchQuery = "",
  onBack,
}) {
  const [activeTab, setActiveTab] = useState("script");
  const [project, setProject] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState([]);

  useEffect(() => {
    if (projectId == null || episodeId == null) {
      setMetaLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMeta() {
      setMetaLoading(true);
      try {
        const [projectRes, episodesRes] = await Promise.all([
          apiFetch(`/projects/${projectId}`),
          apiFetch(`/episodes/project/${projectId}`),
        ]);

        const projectJson = projectRes.ok ? await projectRes.json() : null;
        const episodesJson = episodesRes.ok ? await episodesRes.json() : [];

        if (cancelled) return;

        setProject(projectJson);
        const list = Array.isArray(episodesJson) ? episodesJson : [];
        const match = list.find((e) => Number(e.id) === Number(episodeId));
        setEpisode(match ?? null);
      } catch {
        if (!cancelled) {
          setProject(null);
          setEpisode(null);
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [projectId, episodeId]);

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

  const headerTitle =
    episode?.title ??
    (metaLoading ? "Loading…" : episodeName);

  const projectLabel =
    project?.name ?? (metaLoading ? "Loading…" : "—");

  const episodeLabel =
    episode?.title ??
    (metaLoading ? "Loading…" : episodeName || "—");

  const episodeNumberSuffix =
    episode?.episode_number != null
      ? ` · Ep ${episode.episode_number}`
      : "";

  return (
    <div style={page}>
      <button type="button" onClick={onBack} style={backBtn}>
        <ArrowLeft size={18} strokeWidth={2.25} />
        Back to Episodes
      </button>

      <div style={hero}>
        <div style={heroMain}>
          <div style={heroIcon}>
            <Clapperboard size={26} color="#4338CA" strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={title}>{headerTitle}</h1>
            <div style={metaRow}>
              <span style={chipProject}>
                <span style={chipKey}>Project</span>
                {projectLabel}
              </span>
              <span style={chipEpisode}>
                <span style={chipKey}>Episode</span>
                {episodeLabel}
                {episodeNumberSuffix}
              </span>
              {episode?.assigned_to_user_id != null ? (
                <span style={chipAssignee}>
                  <span style={chipKey}>Assigned</span>
                  {memberLabel(
                    orgMembers.find(
                      (m) =>
                        Number(m.id) === Number(episode.assigned_to_user_id)
                    )
                  )}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div style={tabsContainer}>
        <div style={tabsWrap} role="tablist" aria-label="Episode workspace">
          {TABS.map(({ id, label, Icon }) => (
            <Tab
              key={id}
              label={label}
              Icon={Icon}
              active={activeTab === id}
              onClick={() => setActiveTab(id)}
            />
          ))}
        </div>
      </div>

      <div style={contentCard}>
        {activeTab === "script" && (
          <ScriptTab
            projectId={projectId}
            episodeId={episodeId}
            headerSearchQuery={headerSearchQuery}
            onImportSuccess={() => setActiveTab("dubbing")}
          />
        )}
        {activeTab === "dubbing" && (
          <DubbingTab
            episodeId={episodeId}
            headerSearchQuery={headerSearchQuery}
            onContinueToExport={() => setActiveTab("export")}
          />
        )}
        {activeTab === "export" && (
          <ExportTab
            episodeId={episodeId}
            headerSearchQuery={headerSearchQuery}
          />
        )}
      </div>
    </div>
  );
}

function Tab({ label, active, onClick, Icon }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        ...tabBtn,
        ...(active ? activeTabBtn : inactiveTabBtn),
      }}
    >
      <Icon size={17} strokeWidth={active ? 2.35 : 2} />
      {label}
    </button>
  );
}

/** Wide layout for tables (dubbing/script/export); caps so lines stay readable on ultrawide */
const page = {
  width: "100%",
  maxWidth: "min(1440px, 100%)",
  margin: "0 auto",
  padding: "24px 20px 40px",
  boxSizing: "border-box",
  minWidth: 0,
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
  marginBottom: "18px",
  padding: "6px 2px",
  fontFamily: "inherit",
};

const hero = {
  marginBottom: "22px",
  padding: "22px 24px",
  borderRadius: "20px",
  background:
    "linear-gradient(120deg, #EEF2FF 0%, #FAF5FF 48%, #F0FDFA 100%)",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
};

const heroMain = {
  display: "flex",
  gap: "16px",
  alignItems: "flex-start",
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
  fontSize: "1.85rem",
  fontWeight: 800,
  color: "#0F172A",
  margin: 0,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const metaRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "14px",
};

const chipBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "0.84rem",
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: "999px",
  maxWidth: "100%",
  boxSizing: "border-box",
};

const chipKey = {
  fontSize: "0.68rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  opacity: 0.85,
};

const chipProject = {
  ...chipBase,
  background: "linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)",
  color: "#1E3A8A",
  border: "1px solid #93C5FD",
};

const chipEpisode = {
  ...chipBase,
  background: "linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)",
  color: "#5B21B6",
  border: "1px solid #D8B4FE",
};

const chipAssignee = {
  ...chipBase,
  background: "linear-gradient(135deg, #ECFEFF 0%, #CFFAFE 100%)",
  color: "#0E7490",
  border: "1px solid #67E8F9",
};

const tabsContainer = {
  marginBottom: "22px",
};

const tabsWrap = {
  display: "inline-flex",
  flexWrap: "wrap",
  background: "linear-gradient(180deg, #EEF2FF 0%, #E0E7FF 100%)",
  padding: "8px",
  borderRadius: "14px",
  gap: "8px",
  border: "1px solid #C7D2FE",
  boxShadow: "0 2px 12px rgba(67, 56, 202, 0.08)",
};

const tabBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 18px",
  borderRadius: "11px",
  border: "1px solid transparent",
  cursor: "pointer",
  fontSize: "0.9rem",
  fontWeight: 600,
  fontFamily: "inherit",
  transition: "background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
};

const inactiveTabBtn = {
  background: "rgba(255,255,255,0.35)",
  color: "#475569",
  borderColor: "rgba(199, 210, 254, 0.6)",
};

const activeTabBtn = {
  background: "#FFFFFF",
  color: "#4338CA",
  fontWeight: 700,
  borderColor: "#A5B4FC",
  boxShadow: "0 4px 16px rgba(67, 56, 202, 0.18)",
};

const contentCard = {
  background: "#ffffff",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
  border: "1px solid #E2E8F0",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflowX: "hidden",
};
