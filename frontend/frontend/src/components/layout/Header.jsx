import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";
import Logo from "../Logo";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../api/client";

const DISMISSED_NOTIF_STORAGE_KEY = "syriona_notif_dismissed";

function loadDismissedNotificationIds() {
  try {
    const raw = localStorage.getItem(DISMISSED_NOTIF_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function stableActivityId(a, index) {
  const t = String(a?.title ?? "").slice(0, 80);
  const at = String(a?.at ?? "");
  const k = String(a?.kind ?? "");
  return `activity:${k}:${at}:${t}:${index}`;
}

function formatNotifDate(iso) {
  if (iso == null || iso === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialsFromUser(user) {
  const name = (user?.full_name || user?.email || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function Header({
  onOpenProfile,
  onOpenSettings,
  onLogout,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search…",
  searchDisabled = false,
}) {
  const { user } = useAuth();
  const initials = useMemo(() => initialsFromUser(user), [user]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const [notifItems, setNotifItems] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [dismissedNotifIds, setDismissedNotifIds] = useState(loadDismissedNotificationIds);

  const visibleNotifItems = useMemo(
    () => notifItems.filter((n) => !dismissedNotifIds.has(n.id)),
    [notifItems, dismissedNotifIds]
  );

  function dismissNotification(id) {
    setDismissedNotifIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem(
          DISMISSED_NOTIF_STORAGE_KEY,
          JSON.stringify([...next])
        );
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }

  function resetDismissedNotifications() {
    setDismissedNotifIds(new Set());
    try {
      localStorage.removeItem(DISMISSED_NOTIF_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const refreshNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [statsRes, trashRes] = await Promise.all([
        apiFetch("/dashboard/stats"),
        apiFetch("/projects/trash"),
      ]);
      const items = [];
      if (trashRes.ok) {
        const trash = await trashRes.json();
        if (Array.isArray(trash) && trash.length > 0) {
          const latest = trash
            .map((p) => p.deleted_at)
            .filter(Boolean)
            .sort()
            .pop();
          items.push({
            id: `trash:${trash.length}:${latest || "0"}`,
            title: `${trash.length} project(s) in Trash`,
            detail:
              "Open Trash in the sidebar to restore or delete forever.",
            at: latest || new Date().toISOString(),
            kind: "trash",
          });
        }
      }
      if (statsRes.ok) {
        const data = await statsRes.json();
        const acts = Array.isArray(data?.activities) ? data.activities : [];
        acts.forEach((a, i) => {
          items.push({
            id: stableActivityId(a, i),
            title: a.title || "Activity",
            detail: a.detail || "",
            at: a.at,
            kind: a.kind || "activity",
          });
        });
      }
      setNotifItems(items);
    } catch {
      setNotifItems([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="app-header-shell" style={header}>
      <div style={headerAccent} aria-hidden />

      <div style={left}>
        <div style={logoBox}>
          <Logo size={28} />
        </div>
        <div style={brandBlock}>
          <span style={brand}>Syriona</span>
          <span style={brandTag}>Dubbing workspace</span>
        </div>
      </div>

      <div style={searchContainer}>
        <label
          className="header-search-label"
          style={{
            ...searchLabel,
            opacity: searchDisabled ? 0.55 : 1,
            pointerEvents: searchDisabled ? "none" : "auto",
          }}
        >
          <Search
            size={18}
            strokeWidth={2}
            style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0 }}
            aria-hidden
          />
          <input
            type="search"
            placeholder={searchPlaceholder}
            className="header-search-input"
            style={searchInput}
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            disabled={searchDisabled}
            aria-disabled={searchDisabled}
          />
        </label>
      </div>

      <div style={right}>
        <div style={notifWrap} ref={notifRef}>
          <button
            type="button"
            className="header-notif-bell"
            style={notifBellBtn}
            onClick={() => {
              setNotifOpen((v) => {
                if (!v) refreshNotifications();
                return !v;
              });
            }}
            aria-expanded={notifOpen}
            aria-haspopup="menu"
            aria-label="Notifications"
          >
            <Bell
              size={22}
              strokeWidth={2.25}
              className="header-notif-bell-icon"
              aria-hidden
            />
            {visibleNotifItems.length > 0 && (
              <span style={notifBadge}>
                {visibleNotifItems.length > 99 ? "99+" : visibleNotifItems.length}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="header-notif-panel" style={notifPanel} role="menu">
              <div style={notifPanelHead}>
                <span style={notifPanelTitle}>Notifications</span>
                <div style={notifHeadActions}>
                  {dismissedNotifIds.size > 0 && (
                    <button
                      type="button"
                      style={notifResetBtn}
                      onClick={resetDismissedNotifications}
                    >
                      Show dismissed
                    </button>
                  )}
                  <button
                    type="button"
                    style={{
                      ...notifRefreshBtn,
                      opacity: notifLoading ? 0.6 : 1,
                      cursor: notifLoading ? "wait" : "pointer",
                    }}
                    onClick={() => refreshNotifications()}
                    disabled={notifLoading}
                  >
                    {notifLoading ? "…" : "Refresh"}
                  </button>
                </div>
              </div>
              <div className="header-notif-list" style={notifList}>
                {notifItems.length === 0 ? (
                  <p style={notifEmpty}>
                    {notifLoading
                      ? "Loading…"
                      : "No notifications yet. Activity from your workspace will show here."}
                  </p>
                ) : visibleNotifItems.length === 0 ? (
                  <p style={notifEmpty}>
                    All notifications are hidden. Use{" "}
                    <button
                      type="button"
                      style={notifInlineLink}
                      onClick={resetDismissedNotifications}
                    >
                      Show dismissed
                    </button>{" "}
                    or <strong>Refresh</strong> for new activity.
                  </p>
                ) : (
                  visibleNotifItems.map((n) => (
                    <div
                      key={n.id}
                      className="header-notif-row"
                      style={notifRow}
                    >
                      <div style={notifRowBody}>
                        <div style={notifRowTitle}>{n.title}</div>
                        {n.detail ? (
                          <div style={notifRowDetail}>{n.detail}</div>
                        ) : null}
                        <time style={notifRowDate} dateTime={n.at || undefined}>
                          {formatNotifDate(n.at)}
                        </time>
                      </div>
                      <button
                        type="button"
                        className="header-notif-dismiss"
                        style={notifDismissBtn}
                        title="Dismiss"
                        aria-label={`Dismiss notification: ${n.title}`}
                        onClick={() => dismissNotification(n.id)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="header-notif-dismiss-icon"
                          aria-hidden
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="header-status-pill" style={statusPill}>
          <span className="header-status-dot" style={statusDot} />
          <span style={statusText}>Connected</span>
        </div>

        <div style={profileWrapper} ref={dropdownRef}>
          <button
            type="button"
            className="header-profile-btn"
            style={{
              ...profileTrigger,
              ...(open ? profileTriggerOpen : {}),
            }}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <div style={avatar}>{initials}</div>
            <ChevronDown
              size={16}
              style={{
                color: "rgba(255,255,255,0.85)",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
              }}
              aria-hidden
            />
          </button>

          {open && (
            <div style={dropdown} role="menu">
              <button
                type="button"
                className="header-dropdown-item-hover"
                style={dropdownItem}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenProfile?.();
                }}
              >
                <User size={16} style={dropdownIcon} />
                Profile
              </button>
              <button
                type="button"
                className="header-dropdown-item-hover"
                style={dropdownItem}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings?.();
                }}
              >
                <Settings size={16} style={dropdownIcon} />
                Settings
              </button>
              <div style={divider} />
              <button
                type="button"
                className="header-dropdown-item-hover"
                style={{ ...dropdownItem, ...dropdownItemDanger }}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onLogout?.();
                }}
              >
                <LogOut size={16} style={{ ...dropdownIcon, color: "#DC2626" }} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

const header = {
  position: "relative",
  flexShrink: 0,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  minHeight: "72px",
  padding: "0 20px 0 22px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  minWidth: 0,
  background: "linear-gradient(180deg, #123652 0%, #0f2d4a 48%, #0c2842 100%)",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 24px rgba(0,0,0,0.22)",
};

const headerAccent = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: "2px",
  background:
    "linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.35) 20%, rgba(96,165,250,0.5) 50%, rgba(56,189,248,0.35) 80%, transparent 100%)",
  pointerEvents: "none",
};

const left = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  flexShrink: 0,
};

const logoBox = {
  borderRadius: "12px",
  padding: "2px",
  background: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
  boxShadow:
    "0 0 0 1px rgba(255,255,255,0.12), 0 8px 20px rgba(0,0,0,0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const brandBlock = {
  display: "flex",
  flexDirection: "column",
  gap: "1px",
  lineHeight: 1.15,
};

const brand = {
  fontSize: "1.35rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#ffffff",
  fontFamily: "inherit",
};

const brandTag = {
  fontSize: "0.65rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "rgba(255,255,255,0.42)",
};

const searchContainer = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  justifyContent: "center",
};

const searchLabel = {
  width: "100%",
  maxWidth: "520px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  height: "42px",
  padding: "0 16px 0 14px",
  borderRadius: "12px",
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(15,45,74,0.65)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

const searchInput = {
  flex: 1,
  minWidth: 0,
  height: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: "0.9rem",
  color: "#ffffff",
  fontFamily: "inherit",
};

const right = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  flexShrink: 0,
};

const notifWrap = {
  position: "relative",
};

const notifBellBtn = {
  position: "relative",
  display: "inline-flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  minHeight: "40px",
  padding: "8px 11px 8px 10px",
  borderRadius: "11px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
};

const notifBadge = {
  flexShrink: 0,
  minWidth: "22px",
  height: "22px",
  padding: "0 6px",
  borderRadius: "999px",
  background: "linear-gradient(180deg, #FB7185 0%, #E11D48 100%)",
  color: "#ffffff",
  fontSize: "0.68rem",
  fontWeight: 700,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  border: "1px solid rgba(255,255,255,0.35)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
};

const notifPanel = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  width: "min(392px, calc(100vw - 36px))",
  maxHeight: "min(420px, 72vh)",
  background: "#ffffff",
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.35)",
  boxShadow:
    "0 4px 6px -1px rgba(15,23,42,0.06), 0 24px 48px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(255,255,255,0.6) inset",
  zIndex: 1001,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const notifPanelHead = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  minHeight: "52px",
  padding: "10px 16px",
  borderBottom: "1px solid #EEF2F6",
  background: "linear-gradient(180deg, #FAFBFC 0%, #FFFFFF 100%)",
  flexShrink: 0,
  boxSizing: "border-box",
};

const notifPanelTitle = {
  fontSize: "0.9375rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "#0F172A",
  lineHeight: 1.2,
};

const notifHeadActions = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
};

const notifRefreshBtn = {
  border: "1px solid #E2E8F0",
  background: "#FFFFFF",
  color: "#475569",
  fontSize: "0.75rem",
  fontWeight: 600,
  padding: "7px 12px",
  borderRadius: "9px",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1.2,
  flexShrink: 0,
  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
};

const notifResetBtn = {
  border: "none",
  background: "transparent",
  color: "#64748B",
  fontSize: "0.72rem",
  fontWeight: 600,
  padding: "6px 8px",
  borderRadius: "8px",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const notifInlineLink = {
  border: "none",
  background: "transparent",
  color: "#2563EB",
  fontSize: "inherit",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const notifList = {
  overflowY: "auto",
  padding: "10px 10px 12px",
  flex: 1,
  minHeight: 0,
};

const notifEmpty = {
  margin: "20px 16px 24px",
  fontSize: "0.875rem",
  color: "#64748B",
  lineHeight: 1.55,
  textAlign: "center",
};

const notifRow = {
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: "6px",
  padding: "11px 10px 11px 14px",
  borderRadius: "12px",
  marginBottom: "8px",
  background: "#FFFFFF",
  border: "1px solid #EEF2F6",
  boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

const notifRowBody = {
  flex: 1,
  minWidth: 0,
};

const notifDismissBtn = {
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  marginTop: "-2px",
  marginRight: "-2px",
  border: "none",
  borderRadius: "8px",
  background: "transparent",
  color: "#1e293b",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.15s ease, color 0.15s ease",
};

const notifRowTitle = {
  fontSize: "0.875rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "#1E293B",
  lineHeight: 1.45,
};

const notifRowDetail = {
  fontSize: "0.8125rem",
  color: "#64748B",
  marginTop: "6px",
  lineHeight: 1.45,
};

const notifRowDate = {
  display: "block",
  fontSize: "0.6875rem",
  color: "#94A3B8",
  marginTop: "10px",
  fontWeight: 600,
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

const statusPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 14px",
  borderRadius: "999px",
  background: "rgba(16,185,129,0.12)",
  border: "1px solid rgba(52,211,153,0.28)",
  boxShadow: "0 0 20px rgba(16,185,129,0.12)",
};

const statusDot = {
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "#34D399",
  boxShadow: "0 0 10px rgba(52,211,153,0.9)",
  flexShrink: 0,
};

const statusText = {
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#A7F3D0",
  letterSpacing: "0.02em",
};

const profileWrapper = {
  position: "relative",
};

const profileTrigger = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 6px 4px 4px",
  borderRadius: "999px",
  border: "1px solid transparent",
  background: "transparent",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.2s ease, border-color 0.2s ease",
};

const profileTriggerOpen = {
  background: "rgba(255,255,255,0.08)",
  borderColor: "rgba(255,255,255,0.12)",
};

const avatar = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "linear-gradient(145deg, #3B82F6 0%, #1D4ED8 100%)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "0.82rem",
  fontWeight: 700,
  border: "2px solid rgba(255,255,255,0.35)",
  boxShadow: "0 4px 14px rgba(37,99,235,0.45)",
};

const dropdown = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  minWidth: "188px",
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 18px 48px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.04)",
  padding: "6px",
  zIndex: 1000,
};

const dropdownItem = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  border: "none",
  borderRadius: "10px",
  background: "transparent",
  fontSize: "0.88rem",
  fontWeight: 500,
  cursor: "pointer",
  color: "#1e293b",
  textAlign: "left",
  fontFamily: "inherit",
};

const dropdownIcon = {
  color: "#64748B",
  flexShrink: 0,
};

const dropdownItemDanger = {
  color: "#DC2626",
};

const divider = {
  height: "1px",
  background: "#F1F5F9",
  margin: "4px 6px",
};
