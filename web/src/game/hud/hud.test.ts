import { describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { makeLayout } from "../core/highway";
import { Judge } from "../core/judge";
import { GOOD_MS, msPerBeat } from "../core/settings";
import { emptyHud, hud, hudBottom, hudLayout, hudSettings, reduceHud, rollup, tierFlash, tierFor, tierProgress } from ".";

// What the judge sends for a hit: noteHit, then combo, then comboMilestone at 25.
function hits(judgment: "PERFECT" | "GREAT", n: number, comboBefore: number): GameEvent[] {
  return Array.from({ length: n }, (_, i): GameEvent[] => {
    const count = comboBefore + i + 1;
    const ev: GameEvent[] = [
      { type: "noteHit", noteId: `${judgment}${i}`, pitch: 60, judgment, offsetMs: 0, atMs: count },
      { type: "combo", count, atMs: count },
    ];
    return count === 25 ? [...ev, { type: "comboMilestone", count, atMs: count }] : ev;
  }).flat();
}

// x1 for hits 1-10, then x2, x3 (each hit scores at the combo before it).
const EXPECTED = { PERFECT: 10, GREAT: 25, MISS: 1, extra: 0, combo: 25, score: 10 * 100 + 10 * 50 + 10 * 100 + 5 * 150 };

describe("reduceHud", () => {
  it("10 PERFECT, 1 MISS, 25 GREAT: exact counters, combo, multiplier and score", () => {
    const events: GameEvent[] = [
      { type: "songStart", atMs: -4800 },
      ...hits("PERFECT", 10, 0),
      { type: "noteMiss", noteId: "m", pitch: 60, atMs: 100 },
      ...hits("GREAT", 25, 0),
    ];
    const s = events.reduce(reduceHud, emptyHud());
    expect(s).toMatchObject(EXPECTED);
    expect(s.score).toBe(3250);
    expect(tierFor(s.combo).mult).toBe(3);
    expect(tierProgress(s.combo)).toEqual({ filled: 5, of: 10 });
    expect(s.milestone).toEqual({ count: 25, atMs: 25 });
  });

  it("gets the same numbers from the real judge's events", () => {
    const bpm = 120;
    const chart: Chart = {
      id: "t",
      title: "t",
      composer: "t",
      source: "test",
      bpm,
      beatsPerBar: 4,
      notes: Array.from({ length: 36 }, (_, i) => ({ id: `n${i}`, pitch: 60, beat: i, duration: 1, hand: "R" as const })),
    };
    const events: GameEvent[] = [];
    const judge = new Judge(chart, (e) => events.push(e));
    const mpb = msPerBeat(bpm);
    chart.notes.forEach((n, i) => {
      if (i !== 10) judge.press(n.pitch, n.beat * mpb + (i < 10 ? 0 : 40), i); // 0 ms is PERFECT, 40 ms GREAT; 10 is the MISS
      judge.advance(n.beat * mpb + GOOD_MS + 10); // past the judge's window, so each MISS lands before the next hit
    });
    judge.finish(36 * mpb);
    expect(events.reduce(reduceHud, emptyHud())).toMatchObject(EXPECTED);
  });

  it("counts extras without touching the combo, and resets on songStart", () => {
    let s = hits("PERFECT", 7, 0).reduce(reduceHud, emptyHud());
    s = reduceHud(s, { type: "extra", pitch: 61, atMs: 900 });
    expect(s).toMatchObject({ extra: 1, combo: 7, PERFECT: 7 });
    expect(reduceHud(s, { type: "songStart", atMs: 0 })).toEqual(emptyHud());
  });

  it("GOOD keeps the combo and scores 25 x the multiplier; a WRONG note breaks the combo", () => {
    let s = hits("PERFECT", 12, 0).reduce(reduceHud, emptyHud()); // combo 12: x2
    s = reduceHud(s, { type: "noteHit", noteId: "g", pitch: 60, judgment: "GOOD", offsetMs: 80, atMs: 13 });
    s = reduceHud(s, { type: "combo", count: 13, atMs: 13 });
    expect(s).toMatchObject({ GOOD: 1, combo: 13, score: 10 * 100 + 2 * 200 + 25 * 2 });
    s = reduceHud(reduceHud(s, { type: "extra", pitch: 30, atMs: 14 }), { type: "wrongNote", pitch: 30, atMs: 14 });
    expect(s).toMatchObject({ extra: 1, wrong: 1, combo: 0 });
  });

  it("tiers: x1 from 0, x2 from 10, x3 from 20, x4 from 30, each its own color", () => {
    expect([0, 9, 10, 19, 20, 29, 30, 99].map((c) => tierFor(c).mult)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(new Set([0, 10, 20, 30].map((c) => tierFor(c).color)).size).toBe(4);
    expect(tierProgress(30)).toEqual({ filled: 10, of: 10 });
  });
});

describe("hudLayout", () => {
  const chart: Chart = {
    id: "t",
    title: "t",
    composer: "t",
    source: "test",
    bpm: 100,
    beatsPerBar: 4,
    notes: [60, 62, 64, 65, 67, 69, 71, 72].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" as const })),
  };
  it.each([
    [1280, 720],
    [1920, 1080],
    [800, 600],
    [1280, 400],
    [375, 812],
    [2560, 1440],
  ])("stays out of the lowest 40%% of the highway at %ix%i", (w, h) => {
    const line = makeLayout(chart, w, h, 0).judgmentLineY;
    const l = hudLayout(w, line);
    expect(hudBottom(l)).toBeLessThanOrEqual(l.safeY);
    expect(l.safeY).toBeCloseTo(line * 0.6);
  });
});

describe("the HUD panel", () => {
  // Notes and labels draw from y = 0 on the layers below; a see-through panel showed a pill behind the counts (#243).
  it("covers its band with an opaque fill, so nothing below shows through", () => {
    const rects: { style: string; alpha: number; x: number; y: number; w: number; h: number }[] = [];
    const t: Record<string | symbol, unknown> = { globalAlpha: 1 };
    const ctx = new Proxy(t, {
      get: (o, k) =>
        k in o
          ? o[k]
          : k === "fillRect"
            ? (x: number, y: number, w: number, h: number) => rects.push({ style: String(o.fillStyle), alpha: o.globalAlpha as number, x, y, w, h })
            : () => ({ width: 0 }),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const width = 1280;
    const judgmentLineY = 560;
    hud().draw!(ctx, { width, height: 720, judgmentLineY, nowMs: 0 } as never);
    const band = hudLayout(width, judgmentLineY).panel.h;
    const opaque = (s: string) => /^#[0-9a-f]{6}$/i.test(s) || /^rgba?\([^)]*,\s*1\)$/.test(s) || /^rgb\(/.test(s);
    expect(rects.some((r) => r.x <= 0 && r.y <= 0 && r.w >= width && r.h >= band && r.alpha === 1 && opaque(r.style))).toBe(true);
  });
});

describe("the HUD in wait mode", () => {
  const texts = (params: string) => {
    const out: string[] = [];
    const t: Record<string | symbol, unknown> = { globalAlpha: 1 };
    const ctx = new Proxy(t, {
      get: (o, k) => (k in o ? o[k] : k === "fillText" ? (s: string) => out.push(s) : () => ({ width: 10 })),
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    const p = hud();
    const twinkle = { id: "t", title: "Twinkle", composer: "trad", source: "x", bpm: 100, beatsPerBar: 4, notes: [] } as unknown as Chart;
    p.transformChart!(twinkle, new URLSearchParams(params));
    for (let i = 0; i < 30; i++) p.onEvent!({ type: "combo", count: i + 1, atMs: i * 100 });
    p.draw!(ctx, { width: 1280, height: 720, judgmentLineY: 560, nowMs: 3000 } as never);
    return out;
  };

  it("draws the song card only: no counters, score, multiplier or combo", () => {
    expect(texts("")).toEqual(expect.arrayContaining(["PERFECT", "SCORE", "COMBO"]));
    const wait = texts("mode=wait");
    expect(wait).toContain("Twinkle");
    for (const s of ["PERFECT", "SCORE", "COMBO", "x1", "x4", "30"]) expect(wait).not.toContain(s);
  });
});

describe("the combo in the band (combo-hud)", () => {
  const chart: Chart = {
    id: "t",
    title: "Twinkle, Twinkle, Little Star",
    composer: "t",
    source: "test",
    bpm: 100,
    beatsPerBar: 4,
    notes: [60, 62, 64, 65, 67, 69, 71, 72].map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 1, hand: "R" as const })),
  };
  const sizes = [
    [1024, 768],
    [1280, 720],
    [1920, 1080],
  ] as const;

  it.each(sizes)("at %ix%i the slots don't overlap, in order, and the combo's is centered", (w, h) => {
    const l = hudLayout(w, makeLayout(chart, w, h, 0).judgmentLineY);
    const order = [l.slots.card, l.slots.hits, l.slots.combo, l.slots.breaks, l.slots.score];
    order.forEach((s, i) => {
      expect(s.x1).toBeGreaterThan(s.x0);
      if (i > 0) expect(s.x0).toBeGreaterThanOrEqual(order[i - 1].x1);
    });
    expect((l.slots.combo.x0 + l.slots.combo.x1) / 2).toBeCloseTo(w / 2);
    expect(l.combo.cx).toBe(w / 2);
    expect(l.combo.size).toBeGreaterThan(l.panel.h * 0.5); // bigger than the multiplier
  });

  // A fake context that records every fill with where its bottom lands, through translate, save and restore.
  function record() {
    const fills: { kind: string; text?: string; x: number; bottom: number; alpha: number; px: number }[] = [];
    const t: Record<string | symbol, unknown> = { globalAlpha: 1, font: "10px x", textBaseline: "alphabetic" };
    let dy = 0;
    const stack: number[] = [];
    const px = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(t.font))?.[1] ?? 0);
    const ctx = new Proxy(t, {
      get: (o, k) => {
        if (k in o) return o[k];
        if (k === "save") return () => stack.push(dy);
        if (k === "restore") return () => (dy = stack.pop() ?? 0);
        if (k === "translate") return (_x: number, y: number) => (dy += y);
        if (k === "measureText") return (s: string) => ({ width: s.length * px() * 0.6 });
        if (k === "fillRect")
          return (x: number, y: number, _w: number, hh: number) => fills.push({ kind: "rect", x, bottom: dy + y + hh, alpha: o.globalAlpha as number, px: 0 });
        if (k === "fillText")
          return (s: string, x: number, y: number) =>
            fills.push({ kind: "text", text: s, x, bottom: dy + y + (o.textBaseline === "middle" ? px() / 2 : 0), alpha: o.globalAlpha as number, px: px() });
        return () => {};
      },
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, fills };
  }
  const drawAt = (combo: number, milestone: number | null, sinceMs: number, w = 1280, h = 720) => {
    const r = record();
    const p = hud();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "combo", count: combo, atMs: 0 });
    if (milestone !== null) p.onEvent!({ type: "comboMilestone", count: milestone, atMs: 1000 });
    const line = makeLayout(chart, w, h, 0).judgmentLineY;
    p.draw!(r.ctx, { width: w, height: h, judgmentLineY: line, nowMs: 1000 + sinceMs } as never);
    return { ...r, band: hudLayout(w, line).panel.h, w };
  };
  const comboFills = (d: ReturnType<typeof drawAt>, n: number) => d.fills.filter((f) => f.text === String(n) && f.x === d.w / 2);

  it.each(sizes)("at %ix%i, combo 120 just after the 100 milestone: every fill stays in the band, the combo at full strength", (w, h) => {
    const d = drawAt(120, 100, 100, w, h);
    for (const f of d.fills) expect(f.bottom).toBeLessThanOrEqual(d.band + 0.01);
    const n = comboFills(d, 120);
    expect(n).toHaveLength(1);
    expect(n[0].alpha).toBe(1);
    expect(d.fills.some((f) => f.alpha === 0.2)).toBe(false);
    expect(comboFills(d, 100)).toHaveLength(1); // the ghost
  });

  it("a milestone at 25 doesn't swell the combo; one at 50 does", () => {
    const still = comboFills(drawAt(30, null, 100), 30)[0].px;
    expect(comboFills(drawAt(30, 25, 125), 30)[0].px).toBe(still);
    expect(comboFills(drawAt(30, 25, 125), 25)).toHaveLength(0); // no ghost either
    expect(comboFills(drawAt(55, 50, 125), 55)[0].px).toBeGreaterThan(comboFills(drawAt(55, null, 125), 55)[0].px);
  });

  it("under reduced motion: no swell and no ghost", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    try {
      const d = drawAt(120, 100, 125);
      expect(comboFills(d, 120)[0].px).toBe(comboFills(drawAt(120, null, 125), 120)[0].px);
      expect(comboFills(d, 100)).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("Twinkle's title fits its card at 1280x720 and 1920x1080 without shrinking (at 0.6 em per glyph)", () => {
    for (const [w, h] of [sizes[1], sizes[2]]) {
      const d = drawAt(0, null, 0, w, h);
      const title = d.fills.find((f) => f.text === chart.title);
      expect(title?.px).toBe(Math.round(d.band * 0.3));
    }
  });
});

describe("score roll-up and tier flash (score-rollup)", () => {
  it("rollup: from at 0, exactly to at 200 ms and after, whole, never down, never past", () => {
    expect(hudSettings.rollMs).toBe(200);
    for (const [from, to] of [[0, 100], [3450, 3850], [10, 11], [0, 214800]]) {
      expect(rollup(from, to, 0)).toBe(from);
      expect(rollup(from, to, 200)).toBe(to);
      expect(rollup(from, to, 5000)).toBe(to);
      let last = from;
      for (let ms = 0; ms <= 220; ms++) {
        const v = rollup(from, to, ms);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(last);
        expect(v).toBeLessThanOrEqual(to);
        last = v;
      }
    }
  });

  it("a hit mid-roll continues from the shown value, and dense hits never take the shown score down", () => {
    const p = hud();
    const shown: number[] = [];
    const r = record();
    const events: GameEvent[] = [{ type: "songStart", atMs: 0 }];
    // maple-leaf-rag's density: a hit every ~69 ms, so each roll restarts before it ends.
    for (let i = 0; i < 30; i++) {
      events.push({ type: "noteHit", noteId: `n${i}`, pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs: i * 69 }, { type: "combo", count: i + 1, atMs: i * 69 });
    }
    p.onEvent!(events[0]);
    for (let i = 0; i < 30; i++) {
      p.onEvent!(events[1 + 2 * i]);
      p.onEvent!(events[2 + 2 * i]);
      for (const dt of [0, 30, 60]) shown.push(scoreShown(p, r, i * 69 + dt));
    }
    for (let i = 1; i < shown.length; i++) expect(shown[i]).toBeGreaterThanOrEqual(shown[i - 1]);
    const exact = events.reduce(reduceHud, emptyHud()).score;
    expect(scoreShown(p, r, 29 * 69 + 199)).toBeLessThan(exact); // still rolling just before 200 ms…
    expect(scoreShown(p, r, 29 * 69 + 200)).toBe(exact); // …and settled at 200 ms after the last hit
  });

  it("tierFlash is 1 at the tier-up and 0 from 250 ms", () => {
    expect(tierFlash(0)).toBe(1);
    expect(tierFlash(100)).toBeGreaterThan(0);
    expect(tierFlash(250)).toBe(0);
    expect(tierFlash(1000)).toBe(0);
    expect(tierFlash(-1)).toBe(0);
  });

  // A fake context recording fillText with the shadow it was drawn with.
  function record() {
    const texts: { text: string; blur: number }[] = [];
    const t: Record<string | symbol, unknown> = { globalAlpha: 1, shadowBlur: 0 };
    const stack: unknown[] = [];
    const ctx = new Proxy(t, {
      get: (o, k) => {
        if (k in o) return o[k];
        if (k === "save") return () => stack.push(o.shadowBlur);
        if (k === "restore") return () => (o.shadowBlur = stack.pop() ?? 0);
        if (k === "fillText") return (s: string) => texts.push({ text: s, blur: o.shadowBlur as number });
        if (k === "measureText") return (s: string) => ({ width: s.length * 10 });
        return () => {};
      },
      set: (o, k, v) => ((o[k] = v), true),
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, texts };
  }
  const frame = (nowMs: number) => ({ width: 1280, height: 720, judgmentLineY: 560, nowMs }) as never;
  const isScore = (s: string) => /^[\d,]+$/.test(s);
  // The score's text: the last all-digit fill after the counters and the combo (the score draws right after the badge).
  function scoreShown(p: ReturnType<typeof hud>, r: ReturnType<typeof record>, nowMs: number): number {
    r.texts.length = 0;
    p.draw!(r.ctx, frame(nowMs));
    const i = r.texts.findIndex((x) => /^x\d$/.test(x.text));
    return Number(r.texts.slice(i).find((x) => isScore(x.text))!.text.replaceAll(",", ""));
  }
  const badge = (p: ReturnType<typeof hud>, r: ReturnType<typeof record>, nowMs: number) => {
    r.texts.length = 0;
    p.draw!(r.ctx, frame(nowMs));
    return r.texts.find((x) => /^x\d$/.test(x.text))!;
  };
  const hit = (p: ReturnType<typeof hud>, i: number, atMs: number) => {
    p.onEvent!({ type: "noteHit", noteId: `n${i}`, pitch: 60, judgment: "PERFECT", offsetMs: 0, atMs });
    p.onEvent!({ type: "combo", count: i + 1, atMs });
  };

  it("the drawn score: strictly between at 100 ms, exactly the new value at 200 ms", () => {
    const p = hud();
    const r = record();
    p.onEvent!({ type: "songStart", atMs: 0 });
    hit(p, 0, 1000);
    const mid = scoreShown(p, r, 1100);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
    expect(scoreShown(p, r, 1200)).toBe(100);
  });

  it("the badge glows within 250 ms of x1 → x2, not after it, and not after a drop", () => {
    const p = hud();
    const r = record();
    p.onEvent!({ type: "songStart", atMs: 0 });
    for (let i = 0; i < 10; i++) hit(p, i, i * 100); // combo 10 at 900 ms: x2
    expect(badge(p, r, 900 + 100)).toMatchObject({ text: "x2" });
    expect(badge(p, r, 900 + 100).blur).toBeGreaterThan(0);
    expect(badge(p, r, 900 + 250).blur).toBe(0);
    p.onEvent!({ type: "noteMiss", noteId: "m", pitch: 60, atMs: 2000 }); // back to x1
    expect(badge(p, r, 2050)).toEqual({ text: "x1", blur: 0 });
  });

  it("under reduced motion: the target at once and no glow", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    try {
      const p = hud();
      const r = record();
      p.onEvent!({ type: "songStart", atMs: 0 });
      for (let i = 0; i < 10; i++) hit(p, i, i * 100);
      expect(scoreShown(p, r, 900)).toBe(1000);
      expect(badge(p, r, 950).blur).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
