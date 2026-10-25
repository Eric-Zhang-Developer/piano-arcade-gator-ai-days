// After Google sign-in the player lands on a page of this site, never on one a crafted link names.
// And one browser is one player: saves arriving together share one guest, and a network blip never starts a new one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeNext } from "./auth";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/progress?song=fur-elise")).toBe("/progress?song=fur-elise");
    expect(safeNext("/play?song=twinkle&hands=R")).toBe("/play?song=twinkle&hands=R");
  });

  it("sends anything else to the menu", () => {
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "progress"])
      expect(safeNext(bad)).toBe("/");
  });
});

describe("the browser's session", () => {
  const items = new Map<string, string>();
  const calls: string[] = [];
  let refreshStatus = 200;
  let signups = 0;

  const token = (id: string, email?: string) => ({
    access_token: `at-${id}`,
    refresh_token: `rt-${id}-${calls.length}`,
    expires_in: 3600,
    user: { id, is_anonymous: !email, ...(email ? { email } : {}) },
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    items.clear();
    calls.length = 0;
    refreshStatus = 200;
    signups = 0;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
    });
    vi.stubGlobal("fetch", async (url: string) => {
      const path = new URL(url).pathname + new URL(url).search;
      calls.push(path);
      await new Promise((r) => setTimeout(r, 5));
      if (path === "/auth/v1/signup") return Response.json(token(`guest-${++signups}`));
      if (path.startsWith("/auth/v1/token")) {
        if (refreshStatus !== 200) return Response.json({ error: "x" }, { status: refreshStatus });
        return Response.json(token("player"));
      }
      return new Response(null, { status: 404 });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const expired = (email?: string) =>
    items.set("pianoArcade.session", JSON.stringify({ access_token: "old", refresh_token: "rt-old", expires_at: 1, user_id: "player", is_anonymous: !email, email }));

  it("makes one guest when several saves ask at once", async () => {
    const { ensureSession } = await import("./auth");
    const all = await Promise.all([ensureSession(), ensureSession(), ensureSession()]);
    expect(signups).toBe(1);
    expect(new Set(all.map((s) => s.user_id))).toEqual(new Set(["guest-1"]));
  });

  it("refreshes an expired session once, however many ask", async () => {
    expired();
    const { getSession } = await import("./auth");
    await Promise.all([getSession(), getSession(), getSession()]);
    expect(calls.filter((c) => c.startsWith("/auth/v1/token"))).toHaveLength(1);
  });

  it("keeps the same player through a Supabase blip instead of starting a new guest", async () => {
    expired();
    refreshStatus = 503;
    const { ensureSession, getSession } = await import("./auth");
    await expect(ensureSession()).rejects.toThrow(); // the take waits in the outbox
    expect(signups).toBe(0);
    expect(await getSession()).toBeNull();
    expect(JSON.parse(items.get("pianoArcade.session")!).user_id).toBe("player"); // still there for next time
  });

  it("forgets a session Supabase has revoked, and the next save starts a guest", async () => {
    expired();
    refreshStatus = 400;
    const { ensureSession } = await import("./auth");
    expect((await ensureSession()).user_id).toBe("guest-1");
  });

  it("keeps a Google player's email through a refresh", async () => {
    expired("ada@example.com");
    const { getSession } = await import("./auth");
    expect((await getSession())?.email).toBe("ada@example.com");
  });

  it("tells listeners when the player changes, not when a token refreshes", async () => {
    expired();
    const { ensureSession, getSession, onSessionChange, signOut } = await import("./auth");
    const heard = vi.fn();
    onSessionChange(heard);
    await getSession(); // a new token for the same player
    expect(heard).not.toHaveBeenCalled();
    await signOut();
    expect(heard).toHaveBeenCalledTimes(1);
    await ensureSession(); // a new guest
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
