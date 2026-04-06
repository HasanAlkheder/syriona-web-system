const env = typeof import.meta !== "undefined" ? import.meta.env : {};

/**
 * In Vite dev, when VITE_API_BASE is not set, use same-origin `/api` (proxied to FastAPI).
 * Set VITE_API_BASE=http://127.0.0.1:8000 (or your URL) to bypass the proxy.
 */
const explicitBase = env.VITE_API_BASE;
export const USE_DEV_PROXY = Boolean(env.DEV && !explicitBase);

export const API_BASE = USE_DEV_PROXY
  ? "/api"
  : (explicitBase || "http://localhost:8000");

/** Human-readable line for UI (login hint, errors). */
export const API_BASE_HINT = USE_DEV_PROXY
  ? "Dev proxy: this page → /api → http://127.0.0.1:8000"
  : API_BASE;

const TOKEN_KEY = "syriona_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function requestUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE.replace(/\/$/, "")}${p}`;
}

/**
 * Fetch with Bearer token when logged in.
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    options.body &&
    typeof options.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const url = requestUrl(path);
  try {
    return await fetch(url, { ...options, headers });
  } catch (e) {
    const isNetwork =
      e?.name === "TypeError" ||
      (typeof e?.message === "string" &&
        e.message.toLowerCase().includes("fetch"));
    if (isNetwork) {
      const hint = USE_DEV_PROXY
        ? "Dev server could not reach the API on http://127.0.0.1:8000. Start the backend: uvicorn app:app --reload --port 8000"
        : `Cannot reach the API at ${API_BASE}. Start the backend (from the backend folder): uvicorn app:app --reload --host 0.0.0.0 --port 8000`;
      throw new Error(hint);
    }
    throw e;
  }
}
