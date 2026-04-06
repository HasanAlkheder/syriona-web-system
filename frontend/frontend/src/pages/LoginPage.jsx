import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE_HINT } from "../api/client";
import Logo from "../components/Logo";

/** Pre-filled on Sign in when the server seeds this user (see backend bootstrap). */
const DEMO_EMAIL = "demo@syriona.local";
const DEMO_PASSWORD = "demo123";

export default function LoginPage() {
  const { needsSetup, login, register, setup } = useAuth();
  const [mode, setMode] = useState(needsSetup ? "setup" : "login");

  useEffect(() => {
    if (needsSetup) setMode("setup");
  }, [needsSetup]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!needsSetup && mode === "login") {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    }
  }, [needsSetup, mode]);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else if (mode === "setup") {
        await setup({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
        });
      } else {
        await register({
          organization_name: orgName.trim(),
          email: email.trim(),
          password,
          full_name: fullName.trim(),
        });
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <div style={brandRow}>
          <div style={logoWrap}>
            <Logo size={36} />
          </div>
          <div>
            <h1 style={title}>Syriona</h1>
            <p style={tag}>Dubbing workspace</p>
          </div>
        </div>

        {needsSetup && (
          <div style={banner}>
            <strong>First run:</strong> create the administrator account for the
            default workspace. Existing projects on this server stay linked to
            that organization.
          </div>
        )}

        <div style={tabs}>
          {needsSetup ? (
            <button
              type="button"
              style={mode === "setup" ? tabActive : tab}
              onClick={() => setMode("setup")}
            >
              Admin setup
            </button>
          ) : null}
          <button
            type="button"
            style={mode === "login" ? tabActive : tab}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            style={mode === "register" ? tabActive : tab}
            onClick={() => setMode("register")}
          >
            New company
          </button>
        </div>

        <form onSubmit={handleSubmit} style={form}>
          {mode === "register" && (
            <>
              <label style={label}>Company / studio name</label>
              <input
                style={input}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                autoComplete="organization"
              />
            </>
          )}
          {(mode === "setup" || mode === "register") && (
            <>
              <label style={label}>Your name</label>
              <input
                style={input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required={mode === "setup"}
                autoComplete="name"
              />
            </>
          )}
          <label style={label}>Email</label>
          <input
            style={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label style={label}>Password</label>
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "login" ? 1 : 8}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
          {mode !== "login" && (
            <p style={hint}>Use at least 8 characters for a new password.</p>
          )}
          {error ? (
            <p style={errText} role="alert">
              {error}
            </p>
          ) : null}
          <p style={apiHint}>
            {API_BASE_HINT}. To call the API directly instead of the dev proxy, set{" "}
            <code style={codeInHint}>VITE_API_BASE</code> in{" "}
            <code style={codeInHint}>frontend/.env</code> and restart Vite.
          </p>
          <button type="submit" style={submit} disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "setup"
                  ? "Complete setup"
                  : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  boxSizing: "border-box",
  background:
    "linear-gradient(165deg, #0f2d4a 0%, #123652 35%, #1e3a5f 70%, #0c2842 100%)",
};

const card = {
  width: "100%",
  maxWidth: "420px",
  background: "#ffffff",
  borderRadius: "20px",
  padding: "32px 28px",
  boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const brandRow = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  marginBottom: "20px",
};

const logoWrap = {
  borderRadius: "14px",
  padding: "6px",
  background: "linear-gradient(135deg, #EEF2FF, #DBEAFE)",
};

const title = {
  margin: 0,
  fontSize: "1.5rem",
  fontWeight: 800,
  color: "#0F172A",
  letterSpacing: "-0.02em",
};

const tag = {
  margin: "2px 0 0 0",
  fontSize: "0.72rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#64748B",
};

const banner = {
  fontSize: "0.85rem",
  lineHeight: 1.5,
  color: "#1E40AF",
  background: "#EFF6FF",
  border: "1px solid #BFDBFE",
  borderRadius: "12px",
  padding: "12px 14px",
  marginBottom: "18px",
};

const tabs = {
  display: "flex",
  gap: "8px",
  marginBottom: "20px",
  flexWrap: "wrap",
};

const tab = {
  flex: "1 1 auto",
  minWidth: "100px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #E2E8F0",
  background: "#F8FAFC",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#475569",
  cursor: "pointer",
  fontFamily: "inherit",
};

const tabActive = {
  ...tab,
  background: "#123652",
  color: "#ffffff",
  borderColor: "#123652",
};

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const label = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#374151",
  marginTop: "10px",
  marginBottom: "4px",
};

const input = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const hint = {
  fontSize: "0.78rem",
  color: "#64748B",
  margin: "4px 0 0 0",
};

const errText = {
  color: "#DC2626",
  fontSize: "0.85rem",
  margin: "8px 0 0 0",
  lineHeight: 1.45,
};

const apiHint = {
  fontSize: "0.72rem",
  color: "#94A3B8",
  margin: "10px 0 0 0",
  lineHeight: 1.4,
};

const codeInHint = {
  fontSize: "0.68rem",
  background: "#F1F5F9",
  padding: "1px 4px",
  borderRadius: "4px",
};

const submit = {
  marginTop: "18px",
  padding: "12px 18px",
  borderRadius: "12px",
  border: "none",
  background: "#2563EB",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "0.95rem",
  cursor: "pointer",
  fontFamily: "inherit",
};
