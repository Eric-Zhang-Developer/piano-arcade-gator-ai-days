import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent, Results } from "../../contracts";
import { records } from ".";
import { addTake, betterGrade, loadRecords, NO_INITIALS, practiceReason, RECORDS_KEY, setInitials, type Records } from "./store";

const take = (score: number, accuracy = 0.9, rank: "S" | "A" | "B" | "C" | "D" = "A", date = `2026-10-24T00:00:0${score % 10}Z`) => ({ score, accuracy, rank, maxCombo: 10, date });

describe("the store", () => {
  it("six scores keep the top 5 in order and drop the lowest", () => {
    let r: Records = {};
    for (const [i, s] of [500, 900, 100, 700, 300, 800].entries()) r = addTake(r, "t", take(s, 0.9, "A", `2026-10-24T00:00:0${i}Z`)).records;
    expect(r.t.top.map((t) => t.score)).toEqual([900, 800, 700, 500, 300]);
  });

  it("a tie on score breaks on accuracy, then the earlier date", () => {
    let r: Records = {};
    r = addTake(r, "t", take(500, 0.8, "A", "2026-10-24T00:00:01Z")).records;
    r = addTake(r, "t", take(500, 0.9, "A", "2026-10-24T00:00:02Z")).records;
    r = addTake(r, "t", take(500, 0.8, "A", "2026-10-24T00:00:00Z")).records;
    expect(r.t.top.map((t) => [t.accuracy, t.date.slice(-3)])).toEqual([[0.9, "02Z"], [0.8, "00Z"], [0.8, "01Z"]]);
  });

  it("the best grade updates only on a better rank, or the same rank with better accuracy", () => {
    let r = addTake({}, "t", take(500, 0.9, "A")).records;
    r = addTake(r, "t", take(900, 0.85, "A")).records; // higher score, worse accuracy: same best
    expect(r.t.best).toMatchObject({ rank: "A", accuracy: 0.9 });
    r = addTake(r, "t", take(100, 0.95, "A")).records;
    expect(r.t.best).toMatchObject({ rank: "A", accuracy: 0.95 });
    r = addTake(r, "t", take(200, 0.5, "S")).records;
    expect(r.t.best.rank).toBe("S");
    expect(betterGrade({ rank: "B", accuracy: 1 }, { rank: "A", accuracy: 0 })).toBe(false);
  });

  it("NEW RECORD on the first take and on a higher score only; in the top 5 or not", () => {
    const first = addTake({}, "t", take(500));
    expect(first).toMatchObject({ newRecord: true, inTop: true });
    expect(addTake(first.records, "t", take(400)).newRecord).toBe(false);
    expect(addTake(first.records, "t", take(600)).newRecord).toBe(true);
    let r: Records = {};
    for (const s of [900, 800, 700, 600, 500]) r = addTake(r, "t", take(s)).records;
    expect(addTake(r, "t", take(100))).toMatchObject({ newRecord: false, inTop: false });
  });

  it("initials default to --- and are set on the take's own entry", () => {
    const { records: r } = addTake({}, "t", take(500, 0.9, "A", "2026-10-24T01:00:00Z"));
    expect(r.t.top[0].initials).toBe(NO_INITIALS);
    expect(setInitials(r, "t", "2026-10-24T01:00:00Z", "ABC").t.top[0].initials).toBe("ABC");
  });

  it("each practice param keeps a take out", () => {
    for (const q of ["from=1", "to=4", "tempo=70", "mode=wait", "bot=perfect", "versus=1", "hands=left"]) {
      expect(practiceReason(new URLSearchParams(q)), q).not.toBeNull();
    }
    expect(practiceReason(new URLSearchParams("hands=both&song=twinkle&input=test"))).toBeNull();
  });

  it("corrupt JSON reads as empty with one console line; blocked storage reads as null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(loadRecords({ getItem: () => "{not json" })).toEqual({});
    expect(loadRecords({ getItem: () => "[1,2]" })).toEqual({});
    expect(warn).toHaveBeenCalledTimes(2);
    expect(loadRecords({ getItem: () => { throw new Error("SecurityError"); } })).toBeNull();
    expect(loadRecords(null)).toBeNull();
    warn.mockRestore();
  });
});

describe("the plugin", () => {
  afterEach(() => vi.unstubAllGlobals());
  const chart = { id: "twinkle" } as Chart;
  const results = { accuracy: 1, rank: "S", maxCombo: 3 } as Results;

  function play(query: string) {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const p = records();
    p.transformChart!(chart, new URLSearchParams(query));
    const events: GameEvent[] = [
      { type: "songStart", atMs: 0 },
      ...[0, 1, 2].flatMap((i): GameEvent[] => [
        { type: "noteHit", noteId: `n${i}`, pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: i * 500 },
        { type: "combo", count: i + 1, atMs: i * 500 },
      ]),
      { type: "songEnd", atMs: 2000, results },
    ];
    events.forEach((e) => p.onEvent!(e));
    return { p, store };
  }

  it("records the take at songEnd with the HUD's score and initials ---", () => {
    const { store } = play("song=twinkle");
    const saved = JSON.parse(store.get(RECORDS_KEY)!);
    expect(saved.twinkle.top).toHaveLength(1);
    expect(saved.twinkle.top[0]).toMatchObject({ score: 300, rank: "S", initials: NO_INITIALS }); // 3 PERFECT at x1
  });

  it("records nothing for a practice take", () => {
    const { p, store } = play("bot=perfect");
    expect(store.has(RECORDS_KEY)).toBe(false);
    expect(p.resultsPanel!({} as never)).not.toBeNull(); // the panel says why
  });
});
