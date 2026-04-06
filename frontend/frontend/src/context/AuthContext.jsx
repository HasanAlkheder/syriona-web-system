import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, getToken, setToken } from "../api/client";

const AuthContext = createContext(null);

/** Avoid infinite "Loading workspace…" when the API is down or the proxy hangs. */
const AUTH_FETCH_MS = 12_000;
function authSignal() {
  return typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(AUTH_FETCH_MS)
    : undefined;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setOrganization(null);
      setUsage(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/auth/me", { signal: authSignal() });
      if (!res.ok) {
        setToken(null);
        setUser(null);
        setOrganization(null);
        setUsage(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
      setOrganization(data.organization ?? null);
      setUsage(data.usage ?? null);
    } catch {
      setToken(null);
      setUser(null);
      setOrganization(null);
      setUsage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, AUTH_FETCH_MS + 2000);

    (async () => {
      try {
        const s = await apiFetch("/auth/bootstrap-status", {
          signal: authSignal(),
        });
        if (!cancelled && s.ok) {
          const j = await s.json();
          setNeedsSetup(!!j.needs_setup);
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) await refresh();
    })().finally(() => {
      clearTimeout(safety);
    });

    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    let res;
    try {
      res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data.detail === "string"
          ? data.detail
          : "Login failed";
      throw new Error(msg);
    }
    setToken(data.access_token);
    setUser(data.user);
    setNeedsSetup(false);
    await refresh();
    return data;
  }, [refresh]);

  const register = useCallback(
    async ({ organization_name, email, password, full_name }) => {
      let res;
      try {
        res = await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            organization_name,
            email,
            password,
            full_name: full_name || "",
          }),
        });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : "Registration failed";
        throw new Error(msg);
      }
      setToken(data.access_token);
      setUser(data.user);
      setNeedsSetup(false);
      await refresh();
      return data;
    },
    [refresh]
  );

  const setup = useCallback(
    async ({ email, password, full_name }) => {
      let res;
      try {
        res = await apiFetch("/auth/setup", {
          method: "POST",
          body: JSON.stringify({ email, password, full_name }),
        });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.detail === "string"
            ? data.detail
            : "Setup failed";
        throw new Error(msg);
      }
      setToken(data.access_token);
      setUser(data.user);
      setNeedsSetup(false);
      await refresh();
      return data;
    },
    [refresh]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setOrganization(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      organization,
      usage,
      loading,
      needsSetup,
      setNeedsSetup,
      refresh,
      login,
      register,
      setup,
      logout,
    }),
    [
      user,
      organization,
      usage,
      loading,
      needsSetup,
      refresh,
      login,
      register,
      setup,
      logout,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
