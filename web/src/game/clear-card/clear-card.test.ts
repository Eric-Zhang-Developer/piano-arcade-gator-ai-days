import { describe, expect, it, vi } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { Judge } from "../core/judge";
import { GOOD_MS, msPerBeat } from "../core/settings";
import { gold, ink } from "../ui-tokens";
import { clearCard, clearKind } from ".";

vi.stubGlobal("window", {}); // the card publishes window.__pianoArcadeClearCard for the headless check

describe("clearKind", () => {
  it("names the three endings; an extra that isn't WRONG changes nothing", () => {
    expect(clearKind({ PERFECT: 42, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 })).toBe("ALL PERFECT");
    expect(clearKind({ PERFECT: 40, GREAT: 2, GOOD: 0, MISS: 0, wrong: 0 })).toBe("FULL COMBO");
    expect(clearKind({ PERFECT: 40, GREAT: 0, GOOD: 1, MISS: 0 })).toBe("FULL COMBO");
    expect(clearKind({ PERFECT: 41, GREAT: 0, GOOD: 0, MISS: 1, wrong: 0 })).toBe("CLEAR");
    expect(clearKind({ PERFECT: 42, GREAT: 0, GOOD: 0, MISS: 0, wrong: 1 })).toBe("CLEAR");
    expect(clearKind({ PERFECT: 42, GREAT: 0, MISS: 0 } as never)).toBe("ALL PERFECT"); // extras aren't in it
  });
});

const bpm = 120;
const mpb = msPerBeat(bpm);
const chart: Chart = {
  id: "t",
  title: "t",
  composer: "t",
  source: "test",
  bpm,
  beatsPerBar: 4,
  notes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, pitch: 60 + (i % 2) * 2, beat: i, duration: 1, hand: "R" as const })),
};

// Play the chart through the real judge into a fresh clear card; offsets[i] is note i's press offset, null for none.
function take(offsets: (number | null)[], extra?: { pitch: number; atMs: number }, params = "") {
  const card = clearCard();
  card.transformChart!(chart, new URLSearchParams(params));
  const events: GameEvent[] = [];
  const kinds: (string | null)[] = [];
  const judge = new Judge(chart, (e) => {
    events.push(e);
    card.onEvent!(e);
    kinds.push(window.__pianoArcadeClearCard?.kind ?? null);
  });
  card.onEvent!({ type: "songStart", atMs: 0 });
  chart.notes.forEach((n, i) => {
    const o = offsets[i];
    if (o !== null) judge.press(n.pitch, n.beat * mpb + o, i);
    judge.advance(n.beat * mpb + GOOD_MS + 10);
  });
  if (extra) judge.press(extra.pitch, extra.atMs, 99);
  const last = window.__pianoArcadeClearCard ?? null;
  judge.finish(chart.notes.length * mpb + 1000);
  return { events, last, kinds, card };
}

describe("against the real judge", () => {
  it("FULL COMBO or ALL PERFECT exactly when the judge sends fullCombo", () => {
    const cases: [(number | null)[], string][] = [
      [Array(8).fill(0), "ALL PERFECT"],
      [[0, 0, 0, 60, 0, 0, 0, 0], "FULL COMBO"],
      [[0, 0, null, 0, 0, 0, 0, 0], "CLEAR"],
    ];
    for (const [offsets, kind] of cases) {
      const { events, last } = take(offsets);
      expect(last?.kind).toBe(kind);
      expect(events.some((e) => e.type === "fullCombo")).toBe(kind !== "CLEAR");
    }
  });

  it("shows at the last judged note, and a WRONG after it turns the card to CLEAR", () => {
    const lastNoteMs = 7 * mpb;
    const { last, events } = take(Array(8).fill(0), { pitch: 61, atMs: lastNoteMs + 50 });
    expect(last).toEqual({ kind: "CLEAR", shownAtMs: lastNoteMs });
    expect(events.some((e) => e.type === "fullCombo")).toBe(false);
  });

  it("is gone at songEnd, and never shows in wait mode", () => {
    expect(take(Array(8).fill(0)).kinds.at(-1)).toBeNull(); // after songEnd
    expect(take(Array(8).fill(0), undefined, "mode=wait").last).toBeNull();
  });
});

// A fake 2D context that records fills and the transform, as hud.test.ts does.
function recorder() {
  const texts: { text: string; style: string; alpha: number; x: number; y: number; align: string }[] = [];
  const moves: [number, number][] = [];
  const o: Record<string | symbol, unknown> = { globalAlpha: 1, canvas: { width: 1280, height: 720 } };
  const ctx = new Proxy(o, {
    get: (t, k) =>
      k in t
        ? t[k]
        : k === "fillText"
          ? (s: string, x: number, y: number) => texts.push({ text: s, style: String(t.fillStyle), alpha: t.globalAlpha as number, x, y, align: String(t.textAlign) })
          : k === "translate"
            ? (x: number, y: number) => moves.push([x, y])
            : k === "measureText"
              ? (s: string) => ({ width: s.length * 40 })
              : () => {},
    set: (t, k, v) => ((t[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, moves };
}

describe("the draw", () => {
  const frame = (nowMs: number) => ({ width: 1280, height: 720, judgmentLineY: 560, nowMs }) as never;
  const shown = (offsets: (number | null)[], params = "") => {
    const card = clearCard();
    card.transformChart!(chart, new URLSearchParams(params));
    const judge = new Judge(chart, (e) => card.onEvent!(e));
    chart.notes.forEach((n, i) => offsets[i] !== null && judge.press(n.pitch, n.beat * mpb + offsets[i]!, i));
    judge.advance(chart.notes.length * mpb);
    return card;
  };
  const t0 = 7 * mpb;

  it("at t0 + 300 ms: the kind's text in its color, full alpha, centered", () => {
    for (const [offsets, kind, color] of [
      [Array(8).fill(0), "ALL PERFECT", gold],
      [[0, 0, null, 0, 0, 0, 0, 0], "CLEAR", ink],
    ] as const) {
      const r = recorder();
      shown([...offsets]).draw!(r.ctx, frame(t0 + 300));
      expect(r.texts).toEqual([{ text: kind, style: color, alpha: 1, x: 0, y: 0, align: "center" }]);
      expect(r.moves[0][0]).toBe(640); // the canvas's middle
    }
  });

  it("draws nothing before t0, after songEnd, or in wait mode", () => {
    const before = recorder();
    shown(Array(8).fill(0)).draw!(before.ctx, frame(t0 - 1));
    expect(before.texts).toEqual([]);
    const after = recorder();
    const card = shown(Array(8).fill(0));
    card.onEvent!({ type: "songEnd", results: {} as never, atMs: t0 + 1200 });
    card.draw!(after.ctx, frame(t0 + 1300));
    expect(after.texts).toEqual([]);
    const wait = recorder();
    shown(Array(8).fill(0), "mode=wait").draw!(wait.ctx, frame(t0 + 300));
    expect(wait.texts).toEqual([]);
  });
});
