import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, Frame, GameEvent } from "../../../contracts";
import { Judge } from "../../core/judge";
import { botPresses } from "../../scenes";
import { screenShake, shakeAt, shakeSettings } from ".";

const HEIGHT = 1080;
const CAP = Math.round(HEIGHT / 180);
const curve = (seed: number, count: number, until = 300) =>
  Array.from({ length: until / 16 + 1 }, (_, i) => ({ ...shakeAt(i * 16, seed, count, HEIGHT, { x: 0, y: 0 }) }));

// A take's two canvases, as /play has them: the overlay the plugin draws on, the highway just before it.
function stage() {
  const highway = { tagName: "CANVAS", style: { transform: "" } };
  const overlay = { tagName: "CANVAS", style: { transform: "" }, previousElementSibling: highway };
  const ctx = { canvas: overlay } as unknown as CanvasRenderingContext2D;
  const frame = (nowMs: number) => ({ nowMs, height: HEIGHT, width: 1920 }) as Frame;
  return { highway, overlay, ctx, frame };
}
const ev = (e: object) => e as GameEvent;

afterEach(() => vi.unstubAllGlobals());

describe("the curve (screen-shake)", () => {
  it("peaks at most round(height / 180) px, and is exactly 0 from 250 ms on", () => {
    for (const count of [25, 50, 100, 300]) {
      const c = curve(12_345, count);
      expect(Math.max(...c.flatMap((o) => [Math.abs(o.x), Math.abs(o.y)]))).toBeLessThanOrEqual(CAP);
      for (let t = shakeSettings.decayMs; t < 400; t++) expect(shakeAt(t, 12_345, count, HEIGHT, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
    }
    expect(shakeAt(-1, 0, 100, HEIGHT, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
  });

  it("is the same curve for the same atMs, and moves", () => {
    expect(curve(4_000, 50)).toEqual(curve(4_000, 50));
    expect(curve(4_000, 50).some((o) => o.x || o.y)).toBe(true);
  });

  it("shakes a later milestone harder, up to the cap", () => {
    const peak = (count: number) => Math.max(...curve(7, count).flatMap((o) => [Math.abs(o.x), Math.abs(o.y)]));
    expect(peak(25)).toBeLessThanOrEqual(peak(100));
    expect(peak(100)).toBe(CAP);
  });

  it("prints the offset curve, one sample per 60 Hz frame for 300 ms (the design pass's evidence)", () => {
    const rows = curve(12_345, 100).map((o, i) => `${String(i * 16).padStart(3)} ms ${String(o.x).padStart(3)} ${String(o.y).padStart(3)}`);
    process.stdout.write(`screen-shake, combo 100 at 1080 px (t, x, y):\n${rows.join("\n")}\n`);
    expect(rows.length).toBeGreaterThan(15);
  });
});

describe("the plugin (screen-shake)", () => {
  it("moves the highway and the overlay together, then clears to exactly nothing", () => {
    const s = stage();
    const p = screenShake.plugin();
    p.onEvent!(ev({ type: "comboMilestone", count: 100, atMs: 1000 }));
    const seen = new Set<string>();
    for (let t = 1000; t < 1300; t += 4) {
      p.draw!(s.ctx, s.frame(t));
      expect(s.highway.style.transform).toBe(s.overlay.style.transform);
      seen.add(s.overlay.style.transform);
    }
    expect(seen.size).toBeGreaterThan(2);
    expect(s.overlay.style.transform).toBe("");
  });

  it("shakes the second /play's canvases, not the first's (#1326)", () => {
    const [a, b] = [stage(), stage()];
    const p = screenShake.plugin();
    p.onEvent!(ev({ type: "comboMilestone", count: 100, atMs: 1000 }));
    p.draw!(a.ctx, a.frame(1040));
    expect(a.overlay.style.transform).not.toBe("");
    p.onEvent!(ev({ type: "songStart" }));
    p.onEvent!(ev({ type: "comboMilestone", count: 100, atMs: 1000 }));
    for (let t = 1000; t < 1100 && !b.overlay.style.transform; t += 4) p.draw!(b.ctx, b.frame(t));
    expect(b.overlay.style.transform).not.toBe("");
    expect(b.highway.style.transform).toBe(b.overlay.style.transform);
    expect(a.overlay.style.transform).toBe("");
  });

  it.each(["pause", "quit", "songEnd", "songStart"])("%s clears it at once", (type) => {
    const s = stage();
    const p = screenShake.plugin();
    p.onEvent!(ev({ type: "comboMilestone", count: 100, atMs: 0 }));
    let t = 0;
    while (!s.overlay.style.transform) p.draw!(s.ctx, s.frame(++t));
    p.onEvent!(ev({ type, atMs: t }));
    expect([s.highway.style.transform, s.overlay.style.transform]).toEqual(["", ""]);
    p.draw!(s.ctx, s.frame(t + 1));
    expect(s.overlay.style.transform).toBe("");
  });

  it("no other event shakes", () => {
    const s = stage();
    const p = screenShake.plugin();
    for (const type of ["combo", "fullCombo", "feverStart", "noteHit", "noteMiss", "wrongNote", "resume"]) p.onEvent!(ev({ type, count: 25, atMs: 0 }));
    for (let t = 0; t < 300; t += 4) p.draw!(s.ctx, s.frame(t));
    expect(s.overlay.style.transform).toBe("");
  });

  it("reduced motion: no shake at all", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    vi.resetModules();
    return import(".").then(({ screenShake: fresh }) => {
      const s = stage();
      const p = fresh.plugin();
      p.onEvent!(ev({ type: "comboMilestone", count: 100, atMs: 0 }));
      for (let t = 0; t < 300; t += 4) {
        p.draw!(s.ctx, s.frame(t));
        expect(s.overlay.style.transform).toBe("");
      }
    });
  });

  it("a throw mid-shake leaves the screen cleared", () => {
    const s = stage();
    const p = screenShake.plugin();
    p.onEvent!(ev({ type: "comboMilestone", count: 100, atMs: 0 }));
    let t = 0;
    while (!s.overlay.style.transform) p.draw!(s.ctx, s.frame(++t));
    expect(() => p.draw!(s.ctx, { get nowMs(): number { throw new Error("boom"); }, height: HEIGHT } as Frame)).toThrow("boom");
    expect([s.highway.style.transform, s.overlay.style.transform]).toEqual(["", ""]);
  });
});

it("the registry URL's bot reaches combo 25 on its song", () => {
  const minuet: Chart = JSON.parse(readFileSync(new URL("../../../../public/songs/minuet-g/chart.json", import.meta.url), "utf8"));
  const events: GameEvent[] = [];
  const j = new Judge(minuet, (e) => events.push(e));
  botPresses(minuet, "fever").forEach((p, i) => j.press(p.pitch, p.timeMs, i));
  j.finish(1e9);
  const first = events.find((e) => e.type === "comboMilestone");
  expect(first && first.type === "comboMilestone" && first.count).toBe(25);
  process.stdout.write(`screen-shake: minuet-g with bot=fever reaches combo 25 at ${Math.round(first!.atMs / 1000)} s\n`);
});
