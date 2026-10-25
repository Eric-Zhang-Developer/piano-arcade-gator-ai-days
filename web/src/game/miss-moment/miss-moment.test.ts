import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart, Frame, GameEvent } from "../../contracts";
import { soundsFor } from "../sound";

const dip = vi.fn();
vi.mock("../stage", () => ({ dip: (atMs: number) => dip(atMs) }));
const { comboBreakAt, dipsStage, keyCap, lateT, missLook, missMoment, missSettings, outlineAt, pulseAt } = await import(".");

const near = (a: number, b: number, tol = 0.02) => Math.abs(a - b) <= tol;

describe("the missed note's look (miss-moment)", () => {
  it("drops to about 40% and 60% width by the end of its fade, and is gone by 300 ms", () => {
    const at = missLook(missSettings.fadeMs);
    expect(near(at.alpha, 0.4) && near(at.width, 0.6) && at.sat === 0 && !at.glow).toBe(true);
    expect(missLook(0).alpha).toBe(1);
    expect(missLook(60).alpha).toBeLessThan(1);
    expect(missLook(299).alpha).toBeGreaterThan(0);
    expect(missLook(300).alpha).toBe(0);
    for (let t = 0; t < 300; t += 10) expect(missLook(t + 10).alpha).toBeLessThanOrEqual(missLook(t).alpha);
  });

  it("a miss the game learns of 130 ms late still starts at full and is gone by the same 300 ms", () => {
    const t = (late: number) => lateT(1000 + late, 1000, 1130, missSettings.goneMs);
    expect(missLook(t(130)).alpha).toBe(1);
    expect(missLook(t(299)).alpha).toBeGreaterThan(0);
    expect(missLook(t(300)).alpha).toBe(0);
    expect(lateT(1150, 1000, 1000, 300)).toBe(150); // known on time: plain elapsed time
  });

  it("lights the key's outline until about 400 ms", () => {
    expect(outlineAt(0)).toBe(1);
    expect(outlineAt(300)).toBeGreaterThan(0);
    expect(outlineAt(399)).toBeGreaterThan(0);
    expect(outlineAt(400)).toBe(0);
  });

  it("pulses a wrong key once, sharp at the press and gone by its end", () => {
    expect(pulseAt(0)).toBe(missSettings.pulseAlpha);
    expect(pulseAt(90)).toBeLessThan(pulseAt(0));
    expect(pulseAt(missSettings.pulseMs)).toBe(0);
  });
});

describe("the combo break (miss-moment)", () => {
  it("at 10 or more the old digits drop about 6 px at 1080 and fade over about 200 ms; under 10 it's a plain cut", () => {
    expect(comboBreakAt(0, 9, 1080)).toBeNull();
    expect(comboBreakAt(0, 10, 1080)).toEqual({ dy: 0, alpha: 1 });
    const mid = comboBreakAt(100, 30, 1080)!;
    expect(mid.dy).toBeGreaterThan(0);
    expect(mid.alpha).toBeCloseTo(0.5);
    expect(comboBreakAt(199, 30, 1080)!.dy).toBeLessThanOrEqual(6);
    expect(comboBreakAt(200, 30, 1080)).toBeNull();
  });

  it("50 or more calls the stage's dip once; under 50, or under reduced motion, never", () => {
    expect([dipsStage(49), dipsStage(50), dipsStage(120, true)]).toEqual([false, true, false]);
  });
});

describe("reduced motion (miss-moment)", () => {
  it("gives opacity steps only: no thinning, desaturating fade, drop or fade-out", () => {
    for (let t = 0; t < 300; t += 5) {
      const l = missLook(t, true);
      expect(l.width).toBe(1);
      expect(l.alpha).toBe(missSettings.restAlpha);
    }
    expect(missLook(300, true).alpha).toBe(0);
    for (let t = 0; t < 400; t += 5) expect(outlineAt(t, true)).toBe(1);
    for (let t = 0; t < missSettings.pulseMs; t += 5) expect(pulseAt(t, true)).toBe(missSettings.pulseAlpha);
    for (let t = 0; t < 200; t += 5) expect(comboBreakAt(t, 60, 1080, true)).toEqual({ dy: 0, alpha: 1 });
  });
});

// A frame with C4 (60) to C5 (72) as 13 equal 20 px columns, the line at 600 of 720; black keys 12 px wide.
const black = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);
const frame = (nowMs: number): Frame => ({
  nowMs,
  lowPitch: 60,
  highPitch: 72,
  judgmentLineY: 600,
  keyX: (p) => (black(p) ? { x: (p - 60) * 20 + 4, width: 12 } : { x: (p - 60) * 20, width: 20 }),
  width: 260,
  height: 720,
});

// A canvas context that records what's filled and stroked, with the style and alpha at the time.
function recorder() {
  const calls: { op: string; args: number[]; style: string; alpha: number }[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    canvas: { previousElementSibling: null },
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    measureText: () => ({ width: 10 }),
    fillRect(...args: number[]) {
      calls.push({ op: "fillRect", args, style: this.fillStyle, alpha: this.globalAlpha });
    },
    strokeRect(...args: number[]) {
      calls.push({ op: "strokeRect", args, style: this.strokeStyle, alpha: this.globalAlpha });
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ op: `fillText ${text}`, args: [x, y], style: this.fillStyle, alpha: this.globalAlpha });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const chart = {
  id: "c",
  title: "C",
  composer: "-",
  source: "-",
  bpm: 120,
  beatsPerBar: 4,
  notes: [{ id: "n1", pitch: 64, beat: 2, duration: 1, hand: "R" }],
} as unknown as Chart;

describe("the plugin (miss-moment)", () => {
  beforeEach(() => dip.mockClear());

  it("a wrong key's pulse touches only that key's cap", () => {
    const p = missMoment();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "wrongNote", pitch: 61, atMs: 1000 } as GameEvent);
    const { ctx, calls } = recorder();
    p.draw!(ctx, frame(1010));
    const pulses = calls.filter((c) => c.op === "fillRect" && c.style === "#ff4d5e");
    const { cap } = keyCap(frame(0), 61);
    expect(pulses).toEqual([{ op: "fillRect", args: [cap.x, cap.y, cap.w, cap.h], style: "#ff4d5e", alpha: pulseAt(10) }]);
    expect(cap).toEqual({ x: 24, y: 600, w: 12, h: 120 * missSettings.blackKeyFrac });
    // A white key's cap leaves its black neighbours out.
    expect(keyCap(frame(0), 62).cut.map((r) => r.x)).toEqual([24, 64]);
  });

  it("a miss lights its key's outline and draws its tail thin and grey; both are gone by 400 ms", () => {
    const p = missMoment();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "noteMiss", noteId: "n1", pitch: 64, atMs: 1120 } as GameEvent);
    const at = (t: number) => {
      const { ctx, calls } = recorder();
      p.draw!(ctx, frame(1120 + t));
      return calls;
    };
    at(0); // the first frame that knows the miss
    const first = at(150);
    expect(first.some((c) => c.op === "strokeRect" && c.style === "#8a8f98")).toBe(true);
    const tail = first.find((c) => c.op === "fillRect")!;
    expect(tail.args[2]).toBeCloseTo(20 * missLook(150).width);
    expect(tail.style).toMatch(/^rgb\((\d+),\1,\1\)$/); // grey: r = g = b
    expect(at(400)).toEqual([]);
  });

  it("a break at 50 or more drops the old digits and calls the stage's dip once; under 10 draws nothing", () => {
    const p = missMoment();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "combo", count: 52, atMs: 900 } as GameEvent);
    p.onEvent!({ type: "noteMiss", noteId: "n1", pitch: 64, atMs: 1000 } as GameEvent);
    p.onEvent!({ type: "noteMiss", noteId: "n1", pitch: 64, atMs: 1050 } as GameEvent); // the combo is already 0
    expect(dip).toHaveBeenCalledTimes(1);
    expect(dip).toHaveBeenCalledWith(1000);
    const { ctx, calls } = recorder();
    p.draw!(ctx, frame(1100));
    expect(calls.filter((c) => c.op === "fillText 52")).toHaveLength(1);

    const q = missMoment();
    q.transformChart!(chart, new URLSearchParams());
    q.onEvent!({ type: "combo", count: 9, atMs: 900 } as GameEvent);
    q.onEvent!({ type: "wrongNote", pitch: 61, atMs: 1000 } as GameEvent);
    const r = recorder();
    q.draw!(r.ctx, frame(1050));
    expect(r.calls.some((c) => c.op.startsWith("fillText"))).toBe(false);
  });
});

describe("the miss cue (miss-moment's gate in juice-sound)", () => {
  const misses = (n: number, gapMs: number) => Array.from({ length: n }, (_, i) => ({ type: "noteMiss", noteId: `n${i}`, pitch: 60, atMs: 1000 + i * gapMs }) as GameEvent);

  it("a run of misses 50 ms apart gives at most one cue per 120 ms", () => {
    const cues = soundsFor(misses(12, 50), 0).map((s) => s.startTime * 1000);
    expect(cues.length).toBeGreaterThan(1);
    for (let i = 1; i < cues.length; i++) expect(cues[i] - cues[i - 1]).toBeGreaterThanOrEqual(120);
  });

  it("the miss-cue setting still gates it", () => {
    expect(soundsFor(misses(3, 500), 0, false)).toEqual([]);
    expect(soundsFor(misses(3, 500), 0)).toHaveLength(3);
  });
});
