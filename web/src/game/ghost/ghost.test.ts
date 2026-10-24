import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, Frame, GameEvent } from "../../contracts";
import { msPerBeat, settings } from "../core/settings";
import { ghost } from ".";
import { emptyGhost, ghostKey, ghostOff, recordGhost, yAt } from "./ghost";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const mpb = msPerBeat(twinkle.bpm);
const [n0, n1] = twinkle.notes;

// A take: note 0 at +40 ms, note 1 at −10 ms, one extra that was WRONG (sent as extra, then wrongNote), one MISS.
const take: GameEvent[] = [
  { type: "songStart", atMs: -4800 },
  { type: "noteHit", noteId: n0.id, pitch: n0.pitch, judgment: "GREAT", offsetMs: 40, atMs: n0.beat * mpb + 40 },
  { type: "combo", count: 1, atMs: n0.beat * mpb + 40 },
  { type: "noteHit", noteId: n1.id, pitch: n1.pitch, judgment: "PERFECT", offsetMs: -10, atMs: n1.beat * mpb - 10 },
  { type: "extra", pitch: 61, atMs: 900 },
  { type: "wrongNote", pitch: 61, atMs: 900 },
  { type: "noteMiss", noteId: twinkle.notes[2].id, pitch: twinkle.notes[2].pitch, atMs: 1400 },
];

// Every dashed outline the plugin draws in one frame, as [x, y, w, h].
function outlines(plugin: ReturnType<typeof ghost>, nowMs: number): number[][] {
  const rects: number[][] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (k === "strokeRect" ? (...r: number[]) => rects.push(r) : k in t ? t[k as string] : () => {}),
    set: (t, k, v) => ((t[k as string] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  const frame: Frame = { nowMs, lowPitch: 48, highPitch: 84, judgmentLineY: 500, width: 1000, height: 600, keyX: (p) => ({ x: (p - 48) * 20, width: 20 }) };
  plugin.draw!(ctx, frame);
  return rects;
}

describe("ghost", () => {
  it("holds each hit at its note time plus its offset, with the note's length, and each extra once", () => {
    const g = take.reduce((acc, e) => recordGhost(twinkle, acc, e), emptyGhost());
    expect(g.hits).toEqual([
      { pitch: n0.pitch, atMs: n0.beat * mpb + 40, durationMs: n0.duration * mpb },
      { pitch: n1.pitch, atMs: n1.beat * mpb - 10, durationMs: n1.duration * mpb },
    ]);
    expect(g.extras).toEqual([{ pitch: 61, atMs: 900 }]); // the WRONG note is that extra, not a second tick
  });

  it("draws a note at +40 ms 40 ms later: higher on the highway by 40 × line / lookaheadMs px", () => {
    expect(yAt(1040, 0, 500, 2000) - yAt(1000, 0, 500, 2000)).toBe(-10);
    expect(settings.lookaheadMs).toBe(2000); // the scale the plugin uses
  });

  it("shows the last finished take on the next one; a quit keeps the previous ghost", () => {
    const p = ghost();
    p.transformChart!(twinkle, new URLSearchParams("song=twinkle"));
    for (const e of take) p.onEvent!(e);
    p.onEvent!({ type: "songEnd", atMs: 30_000, results: {} as never });
    expect(outlines(p, 0)).toEqual([]); // nothing on the first take's own replay of events until the next take
    p.onEvent!({ type: "songStart", atMs: -4800 });
    const first = outlines(p, 0);
    expect(first).toHaveLength(2);
    // A quit take records nothing new: the take after it still shows the first take's ghost.
    p.onEvent!({ type: "noteHit", noteId: n0.id, pitch: n0.pitch, judgment: "PERFECT", offsetMs: 0, atMs: 0 });
    p.onEvent!({ type: "quit", atMs: 100 });
    p.onEvent!({ type: "songStart", atMs: -4800 });
    expect(outlines(p, 0)).toEqual(first);
  });

  it("doesn't show a ghost on a different `from`, and stays off with ?ghost=off or storage", () => {
    expect(ghostKey("twinkle", new URLSearchParams("from=1&to=2"))).not.toBe(ghostKey("twinkle", new URLSearchParams("from=2&to=2")));
    expect(ghostKey("twinkle", new URLSearchParams("song=twinkle&beat=off"))).toBe(ghostKey("twinkle", new URLSearchParams("song=twinkle")));
    const p = ghost();
    p.transformChart!(twinkle, new URLSearchParams("from=1&to=2"));
    for (const e of take) p.onEvent!(e);
    p.onEvent!({ type: "songEnd", atMs: 30_000, results: {} as never });
    p.transformChart!(twinkle, new URLSearchParams("from=2&to=2"));
    p.onEvent!({ type: "songStart", atMs: -4800 });
    expect(outlines(p, 0)).toEqual([]);
    expect([ghostOff("off", null), ghostOff(null, "off"), ghostOff(null, null)]).toEqual([true, true, false]);
  });
});
