import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Cpu,
  Coins,
  BadgeCheck,
  Building2,
  Mail,
  KeyRound,
  Calendar,
  Users,
  Hash,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../api/client";

function initialsFromUser(user) {
  const name = (user?.full_name || user?.email || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function formatPlan(plan) {
  if (!plan || typeof plan !== "string") return "Starter";
  return plan
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatInt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StatCard({ icon, label, value, color, tint }) {
  const bg =
    tint === "violet"
      ? "linear-gradient(145deg, #FAF5FF 0%, #F3E8FF 100%)"
      : tint === "emerald"
        ? "linear-gradient(145deg, #ECFDF5 0%, #D1FAE5 100%)"
        : "linear-gradient(145deg, #EFF6FF 0%, #DBEAFE 100%)";

  return (
    <div style={{ ...statCard, background: bg }}>
      <div style={{ ...statAccent, background: color }} />
      <div style={statInner}>
        <div style={{ ...statIconWrap, background: `${color}22`, color }}>{icon}</div>
        <div>
          <div style={{ ...statValue, color: "#0F172A" }}>{value}</div>
          <div style={statLabel}>{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, organization, usage, refresh } = useAuth();
  const initials = useMemo(() => initialsFromUser(user), [user]);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [securityOpen, setSecurityOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const planLabel = formatPlan(organization?.subscription_plan);
  const gpuLeft =
    usage?.gpu_minutes_remaining == null
      ? "Unlimited"
      : `${formatInt(usage.gpu_minutes_remaining)} min`;
  const credits =
    usage?.translation_credits == null
      ? "Unlimited"
      : formatInt(usage.translation_credits);

  useEffect(() => {
    setFullName(user?.full_name || "");
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      const res = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.detail === "string" ? data.detail : "Could not save");
        return;
      }
      setMsg("Saved.");
      await refresh();
    } catch {
      setMsg("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg("");
    setPwBusy(true);
    try {
      const res = await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPw,
          new_password: newPw,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwMsg(typeof data.detail === "string" ? data.detail : "Could not update");
        return;
      }
      setPwMsg("Password updated.");
      setCurrentPw("");
      setNewPw("");
    } catch {
      setPwMsg("Network error");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div style={pageWrap}>
      <div style={hero}>
        <div style={heroRow}>
          <div style={avatar}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={title}>Profile</h1>
            <p style={subtitle}>
              Workspace account, plan, and usage — same visual language as the
              dashboard and header.
            </p>
          </div>
        </div>
      </div>

      <div style={kpiGrid}>
        <StatCard
          icon={<BadgeCheck size={18} strokeWidth={2} />}
          label="Subscription"
          value={planLabel}
          color="#7C3AED"
          tint="violet"
        />
        <StatCard
          icon={<Cpu size={18} strokeWidth={2} />}
          label="GPU time left"
          value={gpuLeft}
          color="#2563EB"
          tint="indigo"
        />
        <StatCard
          icon={<Coins size={18} strokeWidth={2} />}
          label="Translation credits"
          value={credits}
          color="#059669"
          tint="emerald"
        />
      </div>

      <div style={mainCard}>
        <div style={sectionHead}>
          <div style={sectionIconTile}>
            <Building2 size={20} strokeWidth={2} color="#4338CA" />
          </div>
          <div>
            <h2 style={sectionTitle}>Account</h2>
            <p style={sectionHint}>
              Your workspace membership and how you appear to others.
            </p>
          </div>
        </div>

        <div style={detailGrid}>
          <DetailRow
            icon={<Building2 size={16} />}
            label="Workspace"
            value={organization?.name || "—"}
          />
          <DetailRow
            icon={<BadgeCheck size={16} />}
            label="Plan"
            value={planLabel}
            badge
          />
          <DetailRow
            icon={<Users size={16} />}
            label="Seat limit"
            value={
              organization?.max_seats != null
                ? `${organization.max_seats} seats`
                : "Not set"
            }
          />
          <DetailRow
            icon={<Hash size={16} />}
            label="User ID"
            value={user?.id != null ? String(user.id) : "—"}
          />
          <DetailRow
            icon={<Mail size={16} />}
            label="Email"
            value={user?.email ?? "—"}
          />
          <DetailRow
            icon={<Calendar size={16} />}
            label="Member since"
            value={formatDate(user?.created_at)}
          />
        </div>

        <div style={divider} />

        <form onSubmit={saveProfile}>
          <label style={label}>Display name</label>
          <input
            style={input}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="How your name appears in the app"
          />
          {msg ? (
            <p style={msg.startsWith("Saved") ? hintOk : hintErr}>{msg}</p>
          ) : null}
          <button type="submit" style={primaryBtn} disabled={saving}>
            {saving ? "Saving…" : "Save display name"}
          </button>
        </form>
      </div>

      <div style={securityCard}>
        <button
          type="button"
          style={securityToggle}
          onClick={() => {
            setSecurityOpen((o) => !o);
            setPwMsg("");
          }}
          aria-expanded={securityOpen}
        >
          <div style={securityToggleLeft}>
            <div style={securityIconSmall}>
              <ShieldIcon />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={securityToggleTitle}>Password & sign-in</div>
              <div style={securityToggleSub}>
                Update your password only when you need to — kept out of the way.
              </div>
            </div>
          </div>
          <ChevronDown
            size={22}
            color="#64748B"
            style={{
              flexShrink: 0,
              transform: securityOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
            aria-hidden
          />
        </button>

        {securityOpen ? (
          <div style={securityPanel}>
            <p style={securityNote}>
              Use a strong password you do not reuse elsewhere. You will need your
              current password to confirm.
            </p>
            <form onSubmit={changePassword}>
              <label style={label}>Current password</label>
              <input
                style={input}
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
              <label style={label}>New password</label>
              <input
                style={input}
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
              <p style={mutedSmall}>At least 8 characters.</p>
              {pwMsg ? (
                <p style={pwMsg.includes("updated") ? hintOk : hintErr}>{pwMsg}</p>
              ) : null}
              <button type="submit" style={secondaryBtn} disabled={pwBusy}>
                <KeyRound size={16} strokeWidth={2} />
                {pwBusy ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      <p style={footNote}>
        GPU minutes and translation credits are sample quotas by plan until billing
        is connected. Your workspace plan is{" "}
        <strong>{planLabel}</strong>.
      </p>
    </div>
  );
}

function ShieldIcon() {
  return <Shield size={18} strokeWidth={2} color="#475569" />;
}

function DetailRow({ icon, label, value, badge }) {
  return (
    <div style={detailRow}>
      <div style={detailIcon}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={detailLabel}>{label}</div>
        <div style={badge ? { ...detailValue, ...planBadge } : detailValue}>{value}</div>
      </div>
    </div>
  );
}

const pageWrap = {
  width: "100%",
  maxWidth: "min(960px, 100%)",
  margin: "0 auto",
  padding: "8px 0 48px",
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
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
};

const avatar = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  background: "linear-gradient(145deg, #3B82F6 0%, #1D4ED8 100%)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.05rem",
  fontWeight: 700,
  border: "2px solid rgba(255,255,255,0.85)",
  boxShadow: "0 8px 22px rgba(37,99,235,0.35)",
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
  marginBottom: 0,
};

const kpiGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "16px",
  marginBottom: "24px",
};

const statCard = {
  borderRadius: "16px",
  border: "1px solid #E2E8F0",
  overflow: "hidden",
  boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
};

const statAccent = {
  height: "4px",
};

const statInner = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "18px 18px 20px",
};

const statIconWrap = {
  padding: "11px",
  borderRadius: "12px",
  display: "flex",
};

const statValue = {
  fontSize: "1.25rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
};

const statLabel = {
  fontSize: "0.78rem",
  color: "#64748B",
  marginTop: "4px",
  fontWeight: 600,
  lineHeight: 1.35,
};

const mainCard = {
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  padding: "24px 26px",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
  marginBottom: "20px",
};

const sectionHead = {
  display: "flex",
  alignItems: "flex-start",
  gap: "14px",
  marginBottom: "22px",
};

const sectionIconTile = {
  width: "44px",
  height: "44px",
  borderRadius: "14px",
  background: "#EEF2FF",
  border: "1px solid #E0E7FF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const sectionTitle = {
  fontSize: "1.08rem",
  fontWeight: 700,
  margin: 0,
  color: "#1E293B",
};

const sectionHint = {
  fontSize: "0.85rem",
  color: "#64748B",
  margin: "6px 0 0 0",
  lineHeight: 1.45,
};

const detailGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "16px 24px",
};

const detailRow = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
};

const detailIcon = {
  color: "#94A3B8",
  marginTop: "2px",
  flexShrink: 0,
};

const detailLabel = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#94A3B8",
  marginBottom: "4px",
};

const detailValue = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#0F172A",
  wordBreak: "break-word",
};

const planBadge = {
  display: "inline-block",
  marginTop: "2px",
  padding: "4px 10px",
  borderRadius: "999px",
  background: "#EEF2FF",
  color: "#4338CA",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const divider = {
  height: "1px",
  background: "#F1F5F9",
  margin: "22px 0",
};

const label = {
  display: "block",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "6px",
};

const input = {
  width: "100%",
  maxWidth: "400px",
  padding: "11px 14px",
  borderRadius: "12px",
  border: "1px solid #CBD5E1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  fontFamily: "inherit",
  background: "#ffffff",
  color: "#0F172A",
};

const mutedSmall = {
  fontSize: "0.78rem",
  color: "#94A3B8",
  margin: "4px 0 12px 0",
};

const hintOk = {
  fontSize: "0.85rem",
  color: "#059669",
  margin: "8px 0 0 0",
  fontWeight: 600,
};

const hintErr = {
  fontSize: "0.85rem",
  color: "#DC2626",
  margin: "8px 0 0 0",
};

const primaryBtn = {
  marginTop: "14px",
  padding: "11px 20px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 8px 22px rgba(67, 56, 202, 0.28)",
};

const securityCard = {
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #E2E8F0",
  boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
  overflow: "hidden",
};

const securityToggle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  padding: "18px 22px",
  border: "none",
  background: "#F8FAFC",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "background 0.15s ease",
};

const securityToggleLeft = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  minWidth: 0,
};

const securityIconSmall = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "#ffffff",
  border: "1px solid #E2E8F0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const securityToggleTitle = {
  fontSize: "0.95rem",
  fontWeight: 700,
  color: "#1E293B",
};

const securityToggleSub = {
  fontSize: "0.8rem",
  color: "#64748B",
  marginTop: "4px",
  lineHeight: 1.4,
  maxWidth: "520px",
};

const securityPanel = {
  padding: "20px 22px 24px",
  borderTop: "1px solid #F1F5F9",
  background: "#ffffff",
};

const securityNote = {
  fontSize: "0.85rem",
  color: "#64748B",
  lineHeight: 1.5,
  margin: "0 0 16px 0",
};

const secondaryBtn = {
  marginTop: "14px",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 18px",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
};

const footNote = {
  fontSize: "0.78rem",
  color: "#94A3B8",
  lineHeight: 1.5,
  margin: "20px 0 0 0",
  maxWidth: "640px",
};
