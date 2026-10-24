// take-store: rows, the progress math, the outbox and the save plugin, against the real Twinkle chart.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent, InputDevice, InputEvent, Take } from "../contracts";
import { judgeTake, noteTimeMs } from "../game/core/judge";
import { barOf, takeRows } from "./mapping";
import { enqueue, flush, readOutbox } from "./outbox";
import { barTrends, takeHistory, weakestBars } from "./progress";
import { createSavePlugin, report, sameChart, unsavableReason, type LoadChart } from "./save-plugin";

const chart: Chart = JSON.parse(readFileSync(new URL("../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const N = chart.notes.length;

function play(shift: (i: number) => number | null, velocity = 90): Take {
  const events = chart.notes.flatMap((n, i) => {
    const s = shift(i);
    return s === null ? [] : [{ pitch: n.pitch, velocity, timeMs: noteTimeMs(chart, n) + s, offTimeMs: null }];
  });
  return { chartId: chart.id, startedAt: "2026-10-24T05:00:00.000Z", latencyOffsetMs: 0, inputDevice: "keys", events };
}
const ids = (n: number) => ({ takeId: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`, playerId: "p", chartSha256: "sha" });

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe("mapping", () => {
  it("Perfect player: one PERFECT row per chart note, counts and bars right", () => {
    const take = play(() => 0);
    const { take: t, notes } = takeRows(ids(1), chart, take, judgeTake(chart, take));
    expect(notes).toHaveLength(N);
    expect(notes.every((n) => n.judgment === "PERFECT" && n.offset_ms === 0 && n.velocity === 90)).toBe(true);
    expect([t.perfect, t.great, t.miss, t.extras, t.accuracy, t.rank]).toEqual([N, 0, 0, 0, 1, "S"]);
    expect(notes[0].bar).toBe(1);
    expect(notes.at(-1)!.bar).toBe(barOf(chart.notes.at(-1)!.beat, chart.beatsPerBar));
    expect(t.take).toBe(take);
  });

  it("a MISS has no offset and no velocity", () => {
    const take = play((i) => (i === 2 ? null : 0));
    const { notes } = takeRows(ids(1), chart, take, judgeTake(chart, take));
    expect(notes[2]).toMatchObject({ judgment: "MISS", offset_ms: null, velocity: null });
  });

  it("passes through a judgment the contract adds later (GOOD is next)", () => {
    const take = play(() => 0);
    const results = judgeTake(chart, take);
    const widened = { ...results, judgments: results.judgments.map((j, i) => (i === 0 ? { ...j, judgment: "GOOD" as never, offsetMs: 70 } : j)) };
    const { notes } = takeRows(ids(1), chart, take, widened);
    expect(notes[0]).toMatchObject({ judgment: "GOOD", offset_ms: 70 });
  });

  it("refuses test takes", () => {
    const take = { ...play(() => 0), inputDevice: "test" as const };
    expect(() => takeRows(ids(1), chart, take, judgeTake(chart, take))).toThrow();
  });
});

describe("progress", () => {
  const rows = (n: number, take: Take, at: string) => {
    const r = takeRows(ids(n), chart, take, judgeTake(chart, take));
    return { take: { ...r.take, created_at: at }, notes: r.notes };
  };
  const late40 = rows(1, play(() => 40), "2026-10-24T05:00:00Z");
  const missNote3 = rows(2, play((i) => (i === 2 ? null : 10)), "2026-10-24T05:05:00Z");

  it("history is oldest first, with mean |offset| and spread from real notes", () => {
    const h = takeHistory([missNote3, late40]);
    expect(h.map((r) => r.take_id)).toEqual([late40.take.id, missNote3.take.id]);
    expect(h[0]).toMatchObject({ mean_abs_offset_ms: 40, spread_ms: 0, miss: 0 });
    expect(h[1]).toMatchObject({ mean_abs_offset_ms: 10, miss: 1 });
  });

  it("bar trends count misses per bar over recent takes and point at the bar with the miss", () => {
    const bars = barTrends([late40, missNote3]);
    const bar1 = bars.find((b) => b.bar === barOf(chart.notes[2].beat, chart.beatsPerBar))!;
    expect(bar1.misses).toBe(1);
    expect(bars.reduce((a, b) => a + b.notes, 0)).toBe(2 * N);
    expect(weakestBars(bars)[0].bar).toBe(bar1.bar);
  });

  it("only the newest 5 takes count", () => {
    const many = [0, 1, 2, 3, 4, 5].map((k) => rows(k + 10, play(() => 0), `2026-10-24T06:0${k}:00Z`));
    const old = rows(99, play(() => null), "2026-10-24T04:00:00Z");
    expect(barTrends([old, ...many]).every((b) => b.misses === 0)).toBe(true);
  });

  it("no takes means no weak bars, never invented ones", () => {
    expect(weakestBars(barTrends([]))).toEqual([]);
  });
});

describe("outbox", () => {
  it("keeps a take after a failed send and sends it exactly once after a success", async () => {
    const s = new MemStorage();
    enqueue(s, "a", play(() => 0));
    enqueue(s, "a", play(() => 0)); // same id twice: one item
    const send = vi.fn().mockResolvedValueOnce("retry").mockResolvedValue("ok");
    expect(await flush(s, send)).toBe(0);
    expect(readOutbox(s)[0].sent).toBe(false);
    expect(await flush(s, send)).toBe(1);
    expect(await flush(s, send)).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(readOutbox(s)).toHaveLength(1);
  });

  it("a take the database can't hold yet stays queued and doesn't block the next one", async () => {
    const s = new MemStorage();
    enqueue(s, "new-judgment", play(() => 0));
    enqueue(s, "plain", play(() => 0));
    const send = vi.fn(async (item: { id: string }) => (item.id === "new-judgment" ? "later" : "ok") as "later" | "ok");
    expect(await flush(s, send)).toBe(1);
    expect(readOutbox(s).map((i) => [i.id, i.sent])).toEqual([["new-judgment", false], ["plain", true]]);
    send.mockResolvedValue("ok"); // after the migration
    expect(await flush(s, send)).toBe(1);
    expect(readOutbox(s).every((i) => i.sent)).toBe(true);
  });

  it("a thrown send (offline) counts as retry", async () => {
    const s = new MemStorage();
    enqueue(s, "a", play(() => 0));
    expect(await flush(s, () => Promise.reject(new Error("offline")))).toBe(0);
    expect(readOutbox(s)[0].sent).toBe(false);
  });
});

describe("save plugin", () => {
  function fakeDevice(kind: InputDevice["kind"]) {
    let emit: (e: InputEvent) => void = () => {};
    return { kind, start: (on: (e: InputEvent) => void) => void (emit = on), stop() {}, fire: (e: InputEvent) => emit(e) };
  }

  const committed: LoadChart = async () => chart; // the chart file as committed

  it("rebuilds the Take on the chart clock and hands it over at songEnd", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const sink = vi.fn();
    const p = createSavePlugin(sink, committed);
    p.transformChart!(chart, new URLSearchParams());
    const dev = fakeDevice("midi");
    const wrapped = p.wrapInput!(dev);
    const seen: InputEvent[] = [];
    void wrapped.start((e) => seen.push(e));
    p.onEvent!({ type: "songStart", atMs: -2400 } as GameEvent); // chart 0 is perf 3400
    dev.fire({ type: "on", pitch: 60, velocity: 100, timeMs: 3410 });
    dev.fire({ type: "off", pitch: 60, velocity: 0, timeMs: 3700 });
    p.onEvent!({ type: "songEnd", atMs: 5000 } as GameEvent);
    expect(seen).toHaveLength(2); // the game still gets every event
    await vi.waitFor(() => expect(sink).toHaveBeenCalledTimes(1));
    const take = sink.mock.calls[0][1] as Take;
    expect(take).toMatchObject({ chartId: chart.id, inputDevice: "midi", latencyOffsetMs: 0 });
    expect(take.events).toEqual([{ pitch: 60, velocity: 100, timeMs: 10, offTimeMs: 300 }]);
    now.mockRestore();
  });

  it("never saves test takes, empty takes or drills", async () => {
    const sink = vi.fn();
    const p = createSavePlugin(sink, committed);
    p.transformChart!(chart, new URLSearchParams());
    const dev = fakeDevice("test");
    void p.wrapInput!(dev).start(() => {});
    p.onEvent!({ type: "songStart", atMs: 0 } as GameEvent);
    dev.fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1 });
    p.onEvent!({ type: "songEnd", atMs: 1 } as GameEvent);
    p.onEvent!({ type: "songStart", atMs: 0 } as GameEvent);
    p.onEvent!({ type: "songEnd", atMs: 1 } as GameEvent);
    const looped = { ...chart, notes: chart.notes.slice(4, 12) }; // what bar-loop hands on for ?from=2&to=3
    p.transformChart!(looped, new URLSearchParams("from=2&to=3"));
    const keys = fakeDevice("keys");
    void p.wrapInput!(keys).start(() => {});
    p.onEvent!({ type: "songStart", atMs: 0 } as GameEvent);
    keys.fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1 });
    p.onEvent!({ type: "songEnd", atMs: 1 } as GameEvent);
    await new Promise((r) => setTimeout(r, 0));
    expect(sink).not.toHaveBeenCalled();
  });

  async function playOnce(params: string, played: Chart = chart, load = committed) {
    const sink = vi.fn();
    const p = createSavePlugin(sink, load);
    p.transformChart!(played, new URLSearchParams(params));
    const keys = fakeDevice("keys");
    void p.wrapInput!(keys).start(() => {});
    p.onEvent!({ type: "songStart", atMs: 0 } as GameEvent);
    keys.fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1 });
    p.onEvent!({ type: "songEnd", atMs: 1 } as GameEvent);
    await new Promise((r) => setTimeout(r, 0));
    return sink.mock.calls.length;
  }

  it("saves a plain take, and one with options that don't change the play (zoom, labels, ghost)", async () => {
    expect(await playOnce("song=twinkle")).toBe(1);
    expect(await playOnce("song=twinkle&zoom=on&labels=1&ghost=1&stage=2")).toBe(1);
  });

  it("never saves a take played on a changed chart: one hand, a chunk, another tempo", async () => {
    const leftOnly = { ...chart, notes: chart.notes.filter((n) => n.hand === "L") };
    const slower = { ...chart, bpm: chart.bpm * 0.75 };
    const shifted = { ...chart, notes: chart.notes.map((n, i) => (i === 3 ? { ...n, beat: n.beat + 0.5 } : n)) };
    for (const played of [leftOnly, slower, shifted]) expect(await playOnce("", played)).toBe(0);
  });

  it("never saves bots, the fake piano, versus, wait mode or local songs", async () => {
    for (const q of ["bot=s", "midi=sim", "versus=1", "mode=wait", "song=local/my-song"]) {
      expect(unsavableReason(new URLSearchParams(q))).not.toBeNull();
      expect(await playOnce(q)).toBe(0);
    }
    expect(unsavableReason(new URLSearchParams("song=fur-elise&mode=play"))).toBeNull();
  });

  it("doesn't save when the committed chart can't be loaded (offline, unknown song)", async () => {
    expect(await playOnce("", chart, async () => null)).toBe(0);
  });

  async function statusAfter(params: string, opts: { kind?: InputDevice["kind"]; played?: Chart; send?: "ok" | "later" | "done" } = {}) {
    let sentId = "";
    const p = createSavePlugin((id) => void (sentId = id), committed);
    p.transformChart!(opts.played ?? chart, new URLSearchParams(params));
    const dev = fakeDevice(opts.kind ?? "keys");
    void p.wrapInput!(dev).start(() => {});
    p.onEvent!({ type: "songStart", atMs: 0 } as GameEvent);
    dev.fire({ type: "on", pitch: 60, velocity: 80, timeMs: 1 });
    p.onEvent!({ type: "songEnd", atMs: 1 } as GameEvent);
    await new Promise((r) => setTimeout(r, 0));
    if (opts.send === "done") report({ id: sentId, done: true });
    else if (opts.send) report({ id: sentId, result: opts.send });
    return p.status.get();
  }

  it("tells the results screen what happened to the take", async () => {
    expect(await statusAfter("")).toEqual({ state: "sending" });
    expect(await statusAfter("", { send: "ok" })).toEqual({ state: "saved" });
    expect((await statusAfter("", { send: "later" }))?.state).toBe("waiting");
    expect((await statusAfter("", { send: "done" }))?.state).toBe("waiting"); // offline: flush ended, nothing sent
    expect(await statusAfter("level=easy")).toEqual({ state: "skipped", why: "Easy level: only the full chart counts" });
    expect(await statusAfter("", { kind: "test" })).toEqual({ state: "skipped", why: "test input" });
    const looped = { ...chart, notes: chart.notes.slice(0, 5) };
    expect((await statusAfter("", { played: looped }))?.state).toBe("skipped");
  });

  it("sameChart compares notes, tempo and meter", () => {
    expect(sameChart(chart, structuredClone(chart))).toBe(true);
    expect(sameChart(chart, { ...chart, beatsPerBar: chart.beatsPerBar + 1 })).toBe(false);
  });
});
