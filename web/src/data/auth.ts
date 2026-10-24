// Browser sessions on Supabase Auth, over its REST API (no SDK). A player becomes an anonymous user on their first
// save, with no sign-in screen; "Keep my progress" links Google to that same user, so their history stays.
import { isConfigured, publishableKey, supabaseUrl } from "./config";

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user_id: string;
  is_anonymous: boolean;
}

export const SESSION_KEY = "pianoArcade.session";

function load(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return s && typeof s.access_token === "string" ? s : null;
  } catch {
    return null;
  }
}

function store(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: the session lasts until the tab closes
  }
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; is_anonymous?: boolean };
}

function toSession(t: TokenResponse): Session {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_at ?? Math.floor(Date.now() / 1000) + t.expires_in,
    user_id: t.user.id,
    is_anonymous: t.user.is_anonymous ?? true,
  };
}

async function authFetch(path: string, init: RequestInit = {}, token?: string): Promise<Response> {
  return fetch(`${supabaseUrl}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function refresh(s: Session): Promise<Session | null> {
  const res = await authFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (!res.ok) return null;
  const next = toSession(await res.json());
  store(next);
  return next;
}

/** The current session, refreshed if it expires within a minute. Null when signed out or offline. */
export async function getSession(): Promise<Session | null> {
  if (!isConfigured()) return null;
  const s = load();
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  try {
    return await refresh(s);
  } catch {
    return null; // offline: try again next time
  }
}

/** The current session, or a new anonymous one. Throws when offline; callers keep the take in the outbox. */
export async function ensureSession(): Promise<Session> {
  const s = await getSession();
  if (s) return s;
  const res = await authFetch("/signup", { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error(`anonymous sign-in failed: ${res.status}`);
  const next = toSession(await res.json());
  store(next);
  return next;
}

/** Sends the player to Google; they come back to /auth/callback signed in as the same user. */
export async function linkGoogle(): Promise<void> {
  const s = await ensureSession();
  const redirectTo = `${window.location.origin}/auth/callback`;
  const q = new URLSearchParams({ provider: "google", redirect_to: redirectTo, skip_http_redirect: "true" });
  const res = await authFetch(`/user/identities/authorize?${q}`, { method: "GET" }, s.access_token);
  if (!res.ok) throw new Error(`Google link failed: ${res.status}`);
  const { url } = (await res.json()) as { url: string };
  window.location.assign(url);
}

/** On /auth/callback: read the tokens Supabase put in the URL hash. Returns an error message, or null on success. */
export async function finishRedirect(hash: string): Promise<string | null> {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const err = p.get("error_description") ?? p.get("error");
  if (err) return err;
  const access = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  if (!access || !refreshToken) return "Sign-in didn't return a session.";
  const res = await authFetch("/user", { method: "GET" }, access);
  if (!res.ok) return `Couldn't read the signed-in user (${res.status}).`;
  const user = (await res.json()) as { id: string; is_anonymous?: boolean };
  store({
    access_token: access,
    refresh_token: refreshToken,
    expires_at: Number(p.get("expires_at")) || Math.floor(Date.now() / 1000) + Number(p.get("expires_in") || 3600),
    user_id: user.id,
    is_anonymous: user.is_anonymous ?? false,
  });
  return null;
}
