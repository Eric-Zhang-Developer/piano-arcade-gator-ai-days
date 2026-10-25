// What /auth/login shows about the player: their Google name, email and avatar (read from Supabase Auth on each
// visit, never stored in our tables) and their handle (players.handle, written only by POST /auth/handle).
import { getSession, type Session } from "./auth";
import { isConfigured, publishableKey, supabaseUrl } from "./config";

/** players.handle's CHECK: ^[A-Za-z0-9_ ]{1,16}$ (supabase/migrations/20261024000001_take_store.sql). */
export const HANDLE_RULE = /^[A-Za-z0-9_ ]{1,16}$/;
export const HANDLE_MAX = 16;

export type HandleCheck = { ok: true; handle: string } | { ok: false; reason: string };

/** The handle as it would be stored (outer spaces trimmed), or why the database would refuse it. */
export function checkHandle(raw: unknown): HandleCheck {
  if (typeof raw !== "string") return { ok: false, reason: "A handle is text." };
  const handle = raw.trim();
  if (!handle) return { ok: false, reason: "Type a handle first." };
  if (handle.length > HANDLE_MAX) return { ok: false, reason: `${HANDLE_MAX} characters at most.` };
  if (!HANDLE_RULE.test(handle)) return { ok: false, reason: "Letters, numbers, spaces and _ only." };
  return { ok: true, handle };
}

export interface UserDetails {
  name: string | null;
  email: string | null;
  avatarUrl: string | null; // https only
  google: boolean;
}

type Bag = Record<string, unknown>;
const bag = (x: unknown): Bag => (x && typeof x === "object" ? (x as Bag) : {});
const text = (...xs: unknown[]) => {
  for (const x of xs) if (typeof x === "string" && x.trim()) return x.trim();
  return null;
};
const https = (...xs: unknown[]) => {
  for (const x of xs) {
    if (typeof x !== "string") continue;
    try {
      if (new URL(x).protocol === "https:") return x;
    } catch {
      // not a URL: try the next one
    }
  }
  return null;
};

/** Supabase's GET /auth/v1/user body -> what the page shows. Whatever Google didn't give stays null. */
export function userDetails(user: unknown): UserDetails {
  const u = bag(user);
  const identities = Array.isArray(u.identities) ? u.identities.map(bag) : [];
  const google = identities.find((i) => i.provider === "google");
  const g = bag(google?.identity_data);
  const meta = bag(u.user_metadata);
  return {
    name: text(g.full_name, g.name, meta.full_name, meta.name),
    email: text(u.email, g.email, meta.email),
    avatarUrl: https(g.avatar_url, g.picture, meta.avatar_url, meta.picture),
    google: Boolean(google),
  };
}

/** The signed-in user's details from Supabase Auth, or null when that can't be read (offline, expired). */
export async function fetchUserDetails(s: Session): Promise<UserDetails | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${s.access_token}` },
    });
    return res.ok ? userDetails(await res.json()) : null;
  } catch {
    return null;
  }
}

/** This player's handle, null when unset, or undefined when it can't be read. */
export async function fetchHandle(s: Session): Promise<string | null | undefined> {
  try {
    const res = await fetch("/auth/handle", { headers: { Authorization: `Bearer ${s.access_token}` } });
    if (!res.ok) return undefined;
    const { handle } = (await res.json()) as { handle?: unknown };
    return typeof handle === "string" ? handle : null;
  } catch {
    return undefined;
  }
}

/** Saves the handle through the server route. Returns the stored handle, or the reason it was refused. */
export async function saveHandle(raw: string): Promise<HandleCheck> {
  const checked = checkHandle(raw);
  if (!checked.ok) return checked;
  const s = await getSession();
  if (!s) return { ok: false, reason: "Play a song first, or sign in." };
  try {
    const res = await fetch("/auth/handle", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}` },
      body: JSON.stringify({ handle: checked.handle }),
    });
    const body = (await res.json().catch(() => ({}))) as { handle?: unknown; error?: unknown };
    if (res.ok && typeof body.handle === "string") return { ok: true, handle: body.handle };
    return { ok: false, reason: typeof body.error === "string" ? body.error : `Couldn't save (${res.status}).` };
  } catch {
    return { ok: false, reason: "Couldn't reach the server. Your old handle is kept." };
  }
}

/** A first-sign-in suggestion from the Google name: its first word, cut to what players.handle accepts. */
export function suggestName(details: Pick<UserDetails, "name" | "email"> | null): string {
  const first = (details?.name ?? details?.email?.split("@")[0] ?? "").trim().split(/\s+/)[0] ?? "";
  return first.replace(/[^A-Za-z0-9_ ]/g, "").slice(0, HANDLE_MAX);
}

/** Who "Welcome, …" greets: the handle, else the Google first name, else "player". */
export function greetingName(handle: string | null | undefined, details: Pick<UserDetails, "name" | "email"> | null): string {
  return handle?.trim() || suggestName(details) || "player";
}

const SKIPPED_KEY = "pianoArcade.nameSkipped";

/** Whether this player skipped the Name prompt on this device, so sign-in doesn't ask again here. */
export function nameSkipped(userId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? "[]") as string[]).includes(userId);
  } catch {
    return false;
  }
}

export function rememberNameSkipped(userId: string): void {
  try {
    const ids = JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? "[]") as string[];
    if (!ids.includes(userId)) localStorage.setItem(SKIPPED_KEY, JSON.stringify([...ids, userId].slice(-20)));
  } catch {
    // storage blocked: the prompt may ask again next time
  }
}
