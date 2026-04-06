import {
  LayoutDashboard,
  Folder,
  Zap,
  BarChart3,
  Settings,
  Trash2,
} from "lucide-react";

export default function Sidebar({ active, onSelectMenu }) {
  return (
    <aside className="app-sidebar-shell" style={sidebar}>
      <div style={sidebarGlow} aria-hidden />

      <nav style={navMain}>
        <SidebarItem
          icon={<LayoutDashboard size={19} strokeWidth={2} />}
          label="Dashboard"
          description="Overview & activity"
          accent="#38BDF8"
          active={active === "dashboard"}
          onClick={() => onSelectMenu("dashboard")}
        />

        <SidebarItem
          icon={<Folder size={19} strokeWidth={2} />}
          label="Projects"
          description="Manage dubbing projects"
          accent="#FACC15"
          active={active === "projects"}
          onClick={() => onSelectMenu("projects")}
        />

        <SidebarItem
          icon={<Zap size={19} strokeWidth={2} />}
          label="Single Sentence"
          description="Quick translation tool"
          accent="#60A5FA"
          active={active === "single"}
          onClick={() => onSelectMenu("single")}
        />

        <SidebarItem
          icon={<BarChart3 size={19} strokeWidth={2} />}
          label="Reports"
          description="Usage & performance"
          accent="#34D399"
          active={active === "reports"}
          onClick={() => onSelectMenu("reports")}
        />
      </nav>

      <div style={navFooter}>
        <SidebarItem
          icon={<Settings size={19} strokeWidth={2} />}
          label="Settings"
          description="System preferences"
          accent="#A78BFA"
          active={active === "settings"}
          onClick={() => onSelectMenu("settings")}
        />
        <SidebarItem
          icon={<Trash2 size={19} strokeWidth={2} />}
          label="Trash"
          description="Deleted items"
          accent="#FB7185"
          active={active === "trash"}
          onClick={() => onSelectMenu("trash")}
        />
      </div>
    </aside>
  );
}

function SidebarItem({ icon, label, description, active, onClick, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "sidebar-nav-btn sidebar-nav-btn-active" : "sidebar-nav-btn"}
      style={{
        ...item,
        ...(active
          ? {
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 100%)",
              boxShadow: `inset 3px 0 0 ${accent}`,
            }
          : {}),
      }}
    >
      <div
        style={{
          ...iconTile,
          color: accent,
          background: active
            ? "rgba(255,255,255,0.12)"
            : "rgba(255,255,255,0.06)",
          border: active
            ? `1px solid ${accent}44`
            : "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {icon}
      </div>

      <div style={{ textAlign: "left", minWidth: 0 }}>
        <div
          style={{
            ...labelStyle,
            color: active ? "#ffffff" : "#F1F5F9",
            fontWeight: active ? 700 : 600,
          }}
        >
          {label}
        </div>
        <div
          style={{
            ...descStyle,
            color: active ? "rgba(255,255,255,0.65)" : "rgba(226,232,240,0.55)",
          }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}

const sidebar = {
  position: "relative",
  width: "260px",
  minWidth: "260px",
  maxWidth: "260px",
  flexShrink: 0,
  alignSelf: "stretch",
  minHeight: 0,
  maxHeight: "100%",
  overflowY: "auto",
  overscrollBehavior: "contain",
  background: "linear-gradient(180deg, #102a45 0%, #0F2A43 40%, #0b2438 100%)",
  color: "#E2E8F0",
  padding: "22px 14px 20px",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  borderRight: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "4px 0 32px rgba(0,0,0,0.12)",
};

const sidebarGlow = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "3px",
  height: "100%",
  background:
    "linear-gradient(180deg, rgba(56,189,248,0.25) 0%, transparent 45%, rgba(167,139,250,0.15) 100%)",
  pointerEvents: "none",
  opacity: 0.9,
};

const navMain = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  flex: 1,
};

const navFooter = {
  marginTop: "auto",
  paddingTop: "16px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const item = {
  width: "100%",
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  padding: "12px 12px",
  borderRadius: "12px",
  border: "1px solid transparent",
  cursor: "pointer",
  transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
  fontFamily: "inherit",
  textAlign: "left",
  background: "transparent",
};

const iconTile = {
  width: "38px",
  height: "38px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const labelStyle = {
  fontSize: "0.92rem",
  letterSpacing: "-0.01em",
};

const descStyle = {
  fontSize: "0.72rem",
  marginTop: "3px",
  lineHeight: 1.35,
};
