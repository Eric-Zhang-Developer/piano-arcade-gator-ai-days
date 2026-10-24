import { describe, expect, it } from "vitest";
import type { Frame } from "../../contracts";
import { settings } from "../core/settings";
import { hudLayout } from "../hud";
import { feverMoment, moment } from ".";

describe("moment", () => {
  it("is 0 before the start, from 2 s on, and after feverEnd", () => {
    expect(moment(999, 1000, null)).toBe(0);
    expect(moment(1000, 1000, null)).toBe(1);
    expect(moment(1999 + 1000, 1000, null)).toBeGreaterThan(0);
    expect(moment(2000 + 1000, 1000, null)).toBe(0);
    expect(moment(1500, 1000, 1400)).toBe(0); // fever ended 400 ms in
    expect(moment(1300, 1000, 1400)).toBeGreaterThan(0);
    expect(moment(500, null, null)).toBe(0);
  });
});

// A context that records every fill (rects and text) with the composite mode it was drawn in.
function recorder() {
  type Fill = { kind: "rect" | "text"; top: number; bottom: number; op: string };
  const fills: Fill[] = [];
  const t: Record<string | symbol, unknown> = { globalCompositeOperation: "source-over", font: "10px x" };
  const gradient = { addColorStop: () => {} };
  const px = () => Number(/(\d+)px/.exec(String(t.font))?.[1] ?? 0);
  const ctx = new Proxy(t, {
    get: (o, k) =>
      k in o
        ? o[k]
        : k === "createLinearGradient" || k === "createRadialGradient"
          ? () => gradient
          : k === "fillRect"
            ? (_x: number, y: number, _w: number, h: number) => fills.push({ kind: "rect", top: y, bottom: y + h, op: String(o.globalCompositeOperation) })
            : k === "fillText"
              ? (_s: string, _x: number, y: number) => fills.push({ kind: "text", top: y - px() / 2, bottom: y + px() / 2, op: String(o.globalCompositeOperation) })
              : k === "measureText"
                ? () => ({ width: px() * 3 })
                : () => {},
    set: (o, k, v) => ((o[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

describe("the draw", () => {
  const sizes = [
    [1024, 768, 590],
    [1280, 720, 560],
    [1920, 1080, 842],
  ];
  const frame = (w: number, h: number, line: number, nowMs: number) =>
    ({ width: w, height: h, judgmentLineY: line, nowMs, keyX: () => ({ x: 0, width: 20 }) }) as unknown as Frame;

  it.each(sizes)("at %i×%i: the banner stays in the HUD band, everything else above 0.75 of the line", (w, h, line) => {
    const band = hudLayout(w, line).panel.h;
    const cut = line * (1 - 500 / settings.lookaheadMs);
    for (const at of [0, 200, 1000, 1999]) {
      const p = feverMoment();
      p.onEvent!({ type: "feverStart", atMs: 5000 });
      const { ctx, fills } = recorder();
      p.draw!(ctx, frame(w, h, line, 5000 + at));
      const painted = fills.filter((f) => f.op !== "destination-out");
      expect(painted.length, `+${at} ms draws`).toBeGreaterThan(0);
      for (const f of painted) {
        if (f.kind === "text") expect(f.bottom, `+${at} banner`).toBeLessThanOrEqual(band);
        else expect(f.bottom, `+${at} fill`).toBeLessThanOrEqual(cut + 1e-9);
      }
    }
  });

  it("draws nothing at +2000 ms or after feverEnd", () => {
    for (const ended of [false, true]) {
      const p = feverMoment();
      p.onEvent!({ type: "feverStart", atMs: 5000 });
      if (ended) p.onEvent!({ type: "feverEnd", atMs: 5600 });
      const { ctx, fills } = recorder();
      p.draw!(ctx, frame(1920, 1080, 842, ended ? 5700 : 7000));
      expect(fills).toEqual([]);
    }
  });

  it("plays again on a later feverStart; songStart clears it", () => {
    const p = feverMoment();
    p.onEvent!({ type: "feverStart", atMs: 0 });
    p.onEvent!({ type: "feverEnd", atMs: 500 });
    p.onEvent!({ type: "feverStart", atMs: 9000 });
    let r = recorder();
    p.draw!(r.ctx, frame(1920, 1080, 842, 9100));
    expect(r.fills.length).toBeGreaterThan(0);
    p.onEvent!({ type: "songStart", atMs: 0 });
    r = recorder();
    p.draw!(r.ctx, frame(1920, 1080, 842, 9200));
    expect(r.fills).toEqual([]);
  });
});
