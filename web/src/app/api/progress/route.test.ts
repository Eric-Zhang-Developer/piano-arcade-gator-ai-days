// /api/progress?as=: one of the 200 synthetic learners, read by the server for that learner's player only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syntheticLearner } from "../../../learn/frontend/mastery/sim";

const URL_BASE = "https://example.supabase.co";
let fetchMock: ReturnType<typeof vi.fn>;
let handle: string | null;

async function get(query: string, headers: Record<string, string> = {}) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/progress?${query}`, { headers }));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_BASE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  handle = "synthetic 042";
  fetchMock = vi.fn(async (url: string) => {
    const body = url.includes("/players?") ? [{ handle }] : [];
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/progress?as=", () => {
  it("answers for synthetic-042 with no sign-in, reading only that learner's player with the server key", async () => {
    const playerId = syntheticLearner("synthetic-042")!.playerId;
    const res = await get("view=profile&as=synthetic-042");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sessions: [], hands: [] });
    const calls = fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), headers: (init as RequestInit).headers as Record<string, string> }));
    expect(calls.map((c) => c.url.split("?")[0].replace(URL_BASE, ""))).toEqual(["/rest/v1/players", "/rest/v1/session_history", "/rest/v1/hand_stats"]);
    for (const c of calls) {
      expect(c.url).toContain(`=eq.${playerId}`);
      expect(c.headers.apikey).toBe("sb_secret_test");
      expect(c.headers.Authorization).toBeUndefined();
    }
  });

  it("adds the player filter to a song's history and bars too", async () => {
    const playerId = syntheticLearner("synthetic-042")!.playerId;
    expect((await get("song=twinkle&as=synthetic-042")).status).toBe(200);
    const urls = fetchMock.mock.calls.map(([url]) => String(url)).filter((u) => !u.includes("/players?"));
    expect(urls).toHaveLength(2);
    for (const u of urls) expect(u).toContain(`player_id=eq.${playerId}`);
  });

  it("ignores a token sent along: the learner is read, not the signed-in player", async () => {
    await get("view=profile&as=synthetic-042", { authorization: "Bearer someone" });
    for (const [, init] of fetchMock.mock.calls) expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it.each(["synthetic-201", "synthetic-000", "673dfc09-aeed-47c9-a293-2d6681e0484b", "synthetic-42", "junk", ""])(
    "rejects as=%s with 400 and no database call",
    async (as) => {
      const res = await get(`view=profile&as=${encodeURIComponent(as)}`);
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("answers 404 when that player isn't one the loader made", async () => {
    handle = "Andres";
    const res = await get("view=profile&as=synthetic-042");
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still asks for sign-in without as=", async () => {
    expect((await get("view=profile")).status).toBe(401);
  });
});
