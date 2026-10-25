import { describe, expect, it } from "vitest";
import type { GameEvent } from "../../contracts";
import { cyan } from "../ui-tokens";
import { noteOn, reduceWaitHud, waitHud } from ".";

const hit = (i: number): GameEvent => ({ type: "noteHit", noteId: `n${i}`, pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: i * 600 });
const run = (events: GameEvent[], N = 42) => noteOn(events.reduce(reduceWaitHud, { N, hits: 0 }));

describe("the note you're on", () => {
  it("is 1 / 42 at the start and 42 / 42 after 42 hits", () => {
    expect(run([{ type: "songStart", atMs: -4800 }])).toBe(1);
    expect(run(Array.from({ length: 42 }, (_, i) => hit(i)))).toBe(42);
    expect(run(Array.from({ length: 41 }, (_, i) => hit(i)))).toBe(42); // on the last note
  });

  it("counts a chord's notes one each; a WRONG changes nothing; songStart resets", () => {
    expect(run([hit(0), hit(1), { type: "wrongNote", pitch: 30, atMs: 700 }, { type: "extra", pitch: 30, atMs: 700 }])).toBe(3);
    expect(run([hit(0), hit(1), { type: "songStart", atMs: 0 }])).toBe(1);
  });
});

describe("a rewind (rewind)", () => {
  const times = [0, 600, 1200, 1800, 2400, 3000, 3600, 4800]; // Twinkle's first eight notes
  const hit = (i: number): GameEvent => ({ type: "noteHit", noteId: String(i), pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: times[i] });
  const at = (events: GameEvent[]) => noteOn(events.reduce(reduceWaitHud, { N: 42, hits: 0, times }));
  const five = [0, 1, 2, 3, 4].map(hit);
  it("recounts on a resume at a bar start that isn't its pause's", () => {
    expect(at([...five, { type: "pause", atMs: 3000 }, { type: "resume", atMs: 0 }])).toBe(1);
    expect(at([...five, { type: "pause", atMs: 2400 }, { type: "resume", atMs: 4800 }])).toBe(8);
  });
  it("doesn't recount on a plain pause and resume", () => {
    expect(at([...five, { type: "pause", atMs: 3000 }, { type: "resume", atMs: 3000 }])).toBe(6);
  });
});

describe("the plugin", () => {
  const texts = (params: string) => {
    const out: { text: string; font: string; fill: string }[] = [];
    const t: Record<string | symbol, unknown> = {};
    const ctx = new Proxy(t, {
      get: (o, k) => (k in o ? o[k] : k === "fillText" ? (s: string) => out.push({ text: s, font: String(o.font), fill: String(o.fillStyle) }) : () => ({ width: 0 })),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const p = waitHud();
    p.transformChart!({ notes: Array(42).fill({}) } as never, new URLSearchParams(params));
    p.onEvent!({ type: "songStart", atMs: 0 });
    for (let i = 0; i < 5; i++) p.onEvent!(hit(i));
    p.draw!(ctx, { width: 1920, height: 1080, judgmentLineY: 842, nowMs: 0 } as never);
    return out;
  };

  it("draws LEARN in cyan and the note count in wait mode, both at least 24 px at 1920×1080", () => {
    const out = texts("mode=wait");
    expect(out.map((o) => o.text)).toEqual(["6 / 42", "NOTE", "LEARN"]);
    const learn = out.find((o) => o.text === "LEARN")!;
    expect(learn.fill).toBe(cyan); // the token, which Duo repaints (duo-tokens)
    expect(learn.font).toMatch(/^italic 900 /);
    for (const o of [learn, out[0]]) expect(Number(/(\d+)px/.exec(o.font)![1])).toBeGreaterThanOrEqual(24);
  });

  it("draws nothing in plain mode", () => {
    expect(texts("")).toEqual([]);
  });
});
