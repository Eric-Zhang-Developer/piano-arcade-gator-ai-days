import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent, Results } from "../../contracts";
import { records } from "../records";
import { LAST_PLAYED_KEY } from ".";

// The one lastPlayed write sits beside the records write (records/index.ts): every finished take, practice included,
// keyed by the song's id so Easy and Normal share it; bots and demos don't count.
describe("a finished take marks its song played", () => {
  afterEach(() => vi.unstubAllGlobals());

  function finish(query: string) {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const p = records();
    p.transformChart!({ id: "twinkle" } as Chart, new URLSearchParams(query));
    const events: GameEvent[] = [
      { type: "songStart", atMs: 0 },
      { type: "songEnd", atMs: 2000, results: { accuracy: 1, rank: "S", maxCombo: 0 } as Results },
    ];
    events.forEach((e) => p.onEvent!(e));
    return Object.keys(JSON.parse(store.get(LAST_PLAYED_KEY) ?? "{}"));
  }

  it("a take, an Easy take or a practice take marks the song by its id", () => {
    expect(finish("song=twinkle")).toEqual(["twinkle"]);
    expect(finish("song=twinkle&level=easy")).toEqual(["twinkle"]);
    expect(finish("song=twinkle&mode=flow&from=1&to=4")).toEqual(["twinkle"]);
  });

  it("a bot or a demo marks nothing", () => {
    expect(finish("song=twinkle&bot=perfect")).toEqual([]);
    expect(finish("song=twinkle&bot=perfect&audible=1&demo=1")).toEqual([]);
  });
});
