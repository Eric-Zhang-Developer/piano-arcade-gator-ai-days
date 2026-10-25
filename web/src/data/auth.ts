// Browser sessions on Supabase Auth, over its REST API (no SDK). A player becomes an anonymous user on their first
// save, with no sign-in screen; "Keep my progress" links Google to that same user, so their history stays.
// On another device, "Sign in with Google" returns to that account, and the device's anonymous takes move into it.
import { isConfigured, publishableKey, supabaseUrl } from "./config";

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user_id: string;
  is_anonymous: boolean;
  email?: string;
}

export const SESSION_KEY = "pianoArcade.session";
/** The anonymous session to merge after a Google sign-in on this device (its refresh token survives the redirect). */
const MERGE_KEY = "pianoArcade.mergeFrom";
/** Where to land after Google sends the player back (a path on this site). Kept outside the redirect URL, which
 * Supabase matches exactly against its allow-list. */
const NEXT_KEY = "pianoArcade.afterSignIn";

/** A path on this site, or "/". Never another origin: "//evil.example" and "https://..." become "/". */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

function rememberNext(next: string | undefined): void {
  try {
    localStorage.setItem(NEXT_KEY, safeNext(next ?? window.location.pathname + window.location.search));
  } catch {
    // storage blocked: the player lands on the menu
  }
}

function peekNext(): string {
  try {
    return safeNext(localStorage.getItem(NEXT_KEY));
  } catch {
    return "/";
  }
}

/** The page to open once sign-in finishes (the menu unless something else asked), and forget it. */
export function takeNext(): string {
  try {
    const next = localStorage.getItem(NEXT_KEY);
    localStorage.removeItem(NEXT_KEY);
    return safeNext(next);
  } catch {
    return "/";
  }
}

/** The signed-in Google player, or null for guests and when signed out. */
export async function googleSession(): Promise<Session | null> {
  const s = await getSession().catch(() => null);
  return s && !s.is_anonymous ? s : null;
}

function load(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return s && typeof s.access_token === "string" ? s : null;
  } catch {
    return null;
  }
}

// Everything that shows who's playing (the menu chip, /auth/login, /progress, the save line) listens here, so signing
// in or out anywhere, in this tab or another, updates all of them at once.
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** Calls `listener` whenever this browser's session changes (sign-in, sign-out, a new guest). Returns unsubscribe. */
export function onSessionChange(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") window.addEventListener("storage", fromOtherTab);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", fromOtherTab);
  };
}

function fromOtherTab(e: StorageEvent): void {
  if (e.key === SESSION_KEY || e.key === null) changed();
}

/** Who a session is, for telling a new player apart from a refreshed token. */
const who = (s: Session | null) => (s ? `${s.user_id}:${s.is_anonymous}` : "");

function store(s: Session | null): void {
  const before = who(load());
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: the session lasts until the tab closes
  }
  if (who(s) !== before) changed();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; is_anonymous?: boolean; email?: string };
}

function toSession(t: TokenResponse): Session {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_at ?? Math.floor(Date.now() / 1000) + t.expires_in,
    user_id: t.user.id,
    is_anonymous: t.user.is_anonymous ?? true,
    ...(t.user.email ? { email: t.user.email } : {}),
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

/**
 * Runs `make` once at a time: callers that arrive while it's running share its result. Two saves (or a save and the
 * coach) asking at once must not make two guests, and a refresh token is single-use, so two refreshes would race.
 */
function once<T>(make: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => (pending ??= make().finally(() => (pending = null)));
}

/**
 * Refreshes the stored session. Null only when Supabase says it's gone for good (signed out elsewhere, or the guest
 * was deleted): then it's forgotten. Throws when offline or Supabase is busy, so nobody mistakes a blip for "signed
 * out" and starts a new guest, splitting the player's history in two.
 */
const refreshStored = once(async (): Promise<Session | null> => {
  const s = load();
  if (!s) return null;
  const res = await authFetch("/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const now = load();
    if (now && now.refresh_token !== s.refresh_token) return now; // another tab refreshed first: use its session
    store(null);
    return null;
  }
  if (!res.ok) throw new Error(`session refresh failed: ${res.status}`);
  const fresh = toSession(await res.json());
  const next = { ...fresh, email: fresh.email ?? s.email };
  store(next);
  return next;
});

/** The current session; throws when it needs a refresh and Supabase can't be reached. */
async function current(): Promise<Session | null> {
  if (!isConfigured()) return null;
  const s = load();
  if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  return refreshStored();
}

/** The current session, refreshed if it expires within a minute. Null when signed out or offline. */
export async function getSession(): Promise<Session | null> {
  try {
    return await current();
  } catch {
    return null; // offline: try again next time
  }
}

const newGuest = once(async (): Promise<Session> => {
  const res = await authFetch("/signup", { method: "POST", body: JSON.stringify({}) });
  if (!res.ok) throw new Error(`anonymous sign-in failed: ${res.status}`);
  const next = toSession(await res.json());
  store(next);
  return next;
});

/** The current session, or a new anonymous one. Throws when offline; callers keep the take in the outbox. */
export async function ensureSession(): Promise<Session> {
  return (await current()) ?? (await newGuest());
}

/** Sends the player to Google; they come back to /auth/callback signed in as the same user, then to `next`. */
export async function linkGoogle(next?: string): Promise<void> {
  const s = await ensureSession();
  rememberNext(next);
  const redirectTo = `${window.location.origin}/auth/callback`;
  const q = new URLSearchParams({ provider: "google", redirect_to: redirectTo, skip_http_redirect: "true" });
  const res = await authFetch(`/user/identities/authorize?${q}`, { method: "GET" }, s.access_token);
  if (!res.ok) throw new Error(`Google link failed: ${res.status}`);
  const { url } = (await res.json()) as { url: string };
  window.location.assign(url);
}

/** Sends the player to Google to sign in to an existing account. This device's anonymous takes follow them there. */
export async function signInWithGoogle(next?: string): Promise<void> {
  rememberNext(next);
  const current = await getSession().catch(() => null);
  try {
    if (current?.is_anonymous) localStorage.setItem(MERGE_KEY, current.refresh_token);
  } catch {
    // storage blocked: sign-in still works, this device's anonymous takes stay with the old user
  }
  const q = new URLSearchParams({ provider: "google", redirect_to: `${window.location.origin}/auth/callback` });
  window.location.assign(new URL(`/auth/v1/authorize?${q}`, supabaseUrl).href); // Supabase, then Google
}

/** Forgets this device's session. The next save starts a new anonymous player; the account keeps its takes. */
export async function signOut(): Promise<void> {
  const s = load();
  store(null);
  if (s) await authFetch("/logout", { method: "POST" }, s.access_token).catch(() => undefined);
}

/** Moves the remembered anonymous session's takes into the signed-in account, then forgets it. */
async function mergeRemembered(into: string): Promise<string | null> {
  let refreshToken: string | null = null;
  try {
    refreshToken = localStorage.getItem(MERGE_KEY);
    localStorage.removeItem(MERGE_KEY);
  } catch {
    return null;
  }
  if (!refreshToken) return null;
  const res = await authFetch("/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!res.ok) return null; // the old anonymous session is gone: nothing to move
  const old = (await res.json()) as TokenResponse;
  const merge = await fetch("/auth/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${into}` },
    body: JSON.stringify({ fromToken: old.access_token }),
  });
  return merge.ok ? null : "Signed in, but this device's earlier takes couldn't be moved to your account.";
}

/**
 * On /auth/callback: read the tokens Supabase put in the URL hash. Returns null on success, "redirecting" when it
 * sent the player on to Google sign-in, or an error message.
 */
export async function finishRedirect(hash: string, search = ""): Promise<string | null> {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  // Supabase reports errors in the hash or, depending on the flow, the query string.
  for (const [k, v] of new URLSearchParams(search)) if (k.startsWith("error") && !p.has(k)) p.set(k, v);
  if (p.get("error_code") === "identity_already_exists") {
    // This Google account already belongs to a player (linked on another device): sign in to it instead.
    await signInWithGoogle(peekNext());
    return "redirecting";
  }
  const err = p.get("error_description") ?? p.get("error");
  if (err) return err;
  const access = p.get("access_token");
  const refreshToken = p.get("refresh_token");
  if (!access || !refreshToken) return "Sign-in didn't return a session.";
  const res = await authFetch("/user", { method: "GET" }, access);
  if (!res.ok) return `Couldn't read the signed-in user (${res.status}).`;
  const user = (await res.json()) as { id: string; is_anonymous?: boolean; email?: string };
  store({
    access_token: access,
    refresh_token: refreshToken,
    expires_at: Number(p.get("expires_at")) || Math.floor(Date.now() / 1000) + Number(p.get("expires_in") || 3600),
    user_id: user.id,
    is_anonymous: user.is_anonymous ?? false,
    email: user.email,
  });
  return user.is_anonymous ? null : mergeRemembered(access);
}
