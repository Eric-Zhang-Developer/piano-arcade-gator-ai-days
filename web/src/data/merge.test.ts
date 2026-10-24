// /auth/merge: only an anonymous player's takes ever move, and only into a signed-in Google account.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const users: Record<string, { id: string; is_anonymous: boolean }> = {
  anon: { id: "u-anon", is_anonymous: true },
  anon2: { id: "u-anon2", is_anonymous: true },
  google: { id: "u-google", is_anonymous: false },
  google2: { id: "u-google2", is_anonymous: false },
};
let calls: string[];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    calls.push(`${init.method ?? "GET"} ${path}`);
    if (path === "/auth/v1/user") {
      const token = (init.headers as Record<string, string>).Authorization.replace("Bearer ", "");
      const u = users[token];
      return u ? Response.json(u) : new Response("{}", { status: 401 });
    }
    if (path === "/rest/v1/rpc/merge_player") return Response.json(3);
    if (path.startsWith("/auth/v1/admin/users/")) return new Response(null, { status: 200 });
    return new Response("unexpected", { status: 500 });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function merge(to: string | null, fromToken: unknown) {
  const { POST } = await import("../app/auth/merge/route");
  const res = await POST(
    new Request("http://localhost/auth/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(to ? { Authorization: `Bearer ${to}` } : {}) },
      body: JSON.stringify({ fromToken }),
    }),
  );
  return { status: res.status, body: await res.json() };
}
const wrote = () => calls.filter((c) => c.includes("merge_player") || c.includes("admin"));

describe("/auth/merge", () => {
  it("moves an anonymous device's takes into the Google account, then deletes the anonymous user", async () => {
    expect(await merge("google", "anon")).toEqual({ status: 200, body: { moved: 3 } });
    expect(wrote()).toEqual(["POST /rest/v1/rpc/merge_player", "DELETE /auth/v1/admin/users/u-anon"]);
  });

  it("never pulls a real account's history into another account", async () => {
    expect((await merge("google", "google2")).status).toBe(403);
    expect(wrote()).toEqual([]);
  });

  it("never merges into another anonymous player", async () => {
    expect((await merge("anon2", "anon")).status).toBe(403);
    expect(wrote()).toEqual([]);
  });

  it("needs both sessions to be real", async () => {
    expect((await merge(null, "anon")).status).toBe(401);
    expect((await merge("google", "forged")).status).toBe(401);
    expect((await merge("google", 42)).status).toBe(400);
    expect(wrote()).toEqual([]);
  });

  it("the same user on both sides is a no-op", async () => {
    expect(await merge("google", "google")).toEqual({ status: 200, body: { moved: 0 } });
    expect(wrote()).toEqual([]);
  });
});
