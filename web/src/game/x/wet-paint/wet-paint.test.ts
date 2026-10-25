import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { metadata } from "../../../app/paint/layout";
import { APP_NAME } from "../../app-name";
import { CLEAR, keyOff, keyOn, type Message } from "../../leds/messages";
import { hexOf, rgbOf, SCRIABIN } from "./colors";
import { caption, focusAfter, frameAnnouncement, FramedPainting, Live, stripLights } from "./framing";
import { createPainter, keyboard, over, pedalCurve, pedalSettings, ranges, type PaintParams, type Splat, type Surface } from "./paint";

const decision = new URL("../../../../../specs/decisions/wet-paint-colors.md", import.meta.url);

describe("Scriabin's colors", () => {
  it("are the decision file's table, pitch class by pitch class", () => {
    const rows = readFileSync(decision, "utf8")
      .split("\n")
      .filter((l) => /^\| [A-G]/.test(l))
      .map((l) => l.split("|").map((c) => c.trim()));
    expect(rows.map((r) => r[1].split("/")[0])).toEqual(["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"]);
    expect(rows.map((r) => r[3])).toEqual(SCRIABIN);
  });

  it("are shared by every octave", () => {
    for (let pc = 0; pc < 12; pc++) for (const p of [21 + pc, 60 + pc, 96 + pc]) expect(hexOf(p)).toBe(SCRIABIN[(p % 12 + 12) % 12]);
    expect(rgbOf(60)).toEqual(rgbOf(72));
    expect(rgbOf(60)).toEqual({ r: 0xe0 / 255, g: 0x20 / 255, b: 0x1b / 255 });
  });
});

describe("the pedal curve", () => {
  it("gives the dry settings at 0 and the wet ones at 127", () => {
    expect(pedalCurve(0)).toEqual(pedalSettings.dry);
    expect(pedalCurve(127)).toEqual(pedalSettings.wet);
  });

  it("is monotonic toward wet: less fading, less damping, more swirl", () => {
    let prev = pedalCurve(0);
    for (let cc = 1; cc <= 127; cc++) {
      const p = pedalCurve(cc);
      expect(p.densityDissipation).toBeLessThanOrEqual(prev.densityDissipation);
      expect(p.velocityDissipation).toBeLessThanOrEqual(prev.velocityDissipation);
      expect(p.curl).toBeGreaterThanOrEqual(prev.curl);
      prev = p;
    }
  });
});

// A CPU model of the two layers: the live one moves and fades every step, the dried one changes only in fix(), by the
// same "over" the fix shader computes.
function cpuSurface(n = 16) {
  const live = Array.from({ length: n }, () => [0, 0, 0] as [number, number, number]);
  let dried = Array.from({ length: n }, () => [0, 0, 0] as [number, number, number]);
  let params: PaintParams | null = null;
  const surface: Surface = {
    splat(s: Splat) {
      const i = Math.min(n - 1, Math.floor(s.x * n));
      live[i] = [live[i][0] + s.color.r, live[i][1] + s.color.g, live[i][2] + s.color.b];
    },
    step() {
      const last = live.pop()!; // the flow: every cell moves one over
      live.unshift(last.map((v) => v * 0.9) as [number, number, number]);
    },
    params(p) {
      params = p;
    },
    fix() {
      dried = dried.map((d, i) => over(live[i], d));
      live.forEach((_, i) => (live[i] = [0, 0, 0]));
    },
    clear() {
      live.forEach((_, i) => (live[i] = [0, 0, 0]));
      dried = dried.map(() => [0, 0, 0]);
    },
  };
  return { surface, live, dried: () => dried.map((d) => [...d]), params: () => params };
}

const painterOn = (m: ReturnType<typeof cpuSurface>) => createPainter(m.surface, { xOf: (p) => (p - 48) / 37, colorOf: rgbOf, still: false });

describe("the dried layer", () => {
  it("never changes after the pedal lifts: steps, splats and pedal changes leave it as it was", () => {
    const m = cpuSurface();
    const p = painterOn(m);
    p.pedal(127);
    p.noteOn(60, 100);
    for (let i = 0; i < 5; i++) p.frame(1 / 60);
    p.pedal(0); // the lift: the paint dries
    const dried = m.dried();
    expect(dried.some((d) => d.some((v) => v > 0))).toBe(true);
    p.pedal(127); // down again
    p.noteOn(64, 90);
    p.noteOn(67, 80);
    for (let i = 0; i < 30; i++) p.frame(1 / 60);
    p.pedal(70); // half and over: still down
    p.pedal(100);
    p.noteOff(64); // a key lifting with the pedal down dries nothing
    p.noteOff(60);
    expect(m.dried()).toEqual(dried);
    expect(p.fixes).toBe(1);
  });

  it("keeps every dried pixel where the next lift lays no paint", () => {
    const m = cpuSurface();
    const p = painterOn(m);
    p.noteOn(50, 100);
    p.noteOff(50); // pedal up: the key's lift dries it
    const first = m.dried();
    p.pedal(127);
    p.noteOn(80, 100);
    p.pedal(0);
    const second = m.dried();
    second.forEach((d, i) => {
      if (m.live[i].every((v) => v === 0) && first[i].some((v) => v > 0) && i < 8) expect(d).toEqual(first[i]);
    });
    expect(p.fixes).toBe(2);
  });

  it("is laid under the live paint with 'over': no live paint shows the dried as it is", () => {
    expect(over([0, 0, 0], [0.2, 0.4, 0.6])).toEqual([0.2, 0.4, 0.6]);
    expect(over([1, 0, 0], [0.2, 0.4, 0.6])).toEqual([1, 0, 0]);
  });
});

describe("x from pitch", () => {
  it("is the drawn keyboard's key centers", () => {
    const keys = keyboard(ranges.piano.lo, ranges.piano.hi);
    expect(keys).toHaveLength(88);
    expect(keys.filter((k) => !k.black)).toHaveLength(52);
    const a0 = keys[0];
    const c8 = keys[87];
    expect(a0.x).toBeCloseTo(0.5 / 52);
    expect(c8.x).toBeCloseTo(51.5 / 52);
    const bb0 = keys[1]; // A♯0 sits on the line between A0 and B0
    expect(bb0.black).toBe(true);
    expect(bb0.x).toBeCloseTo(1 / 52);
    for (let i = 1; i < keys.length; i++) expect(keys[i].x).toBeGreaterThan(keys[i - 1].x);
  });

  it("puts a laptop C4 on the laptop keyboard's own key", () => {
    const keys = keyboard(ranges.laptop.lo, ranges.laptop.hi);
    const c4 = keys.find((k) => k.pitch === 60)!;
    expect(c4.x).toBeCloseTo(7.5 / keys.filter((k) => !k.black).length);
  });
});

// wet-paint-polish: the tab title (#1195), the strip (#1196) and the framed painting (#1197).
describe("wet-paint-polish", () => {
  it("/paint names its tab", () => {
    expect(metadata.title).toBe(`Wet Paint · ${APP_NAME}`);
  });

  it("framing turns off the keys still held, since play() drops their key-offs once framed", () => {
    const sent: Message[] = [];
    const strip = stripLights((m) => sent.push(m));
    strip.on(60, [1, 2, 3]);
    strip.on(64, [4, 5, 6]);
    strip.off(64);
    strip.frame();
    expect(sent).toEqual([keyOn(60, [1, 2, 3]), keyOn(64, [4, 5, 6]), keyOff(64), keyOff(60)]);
  });

  it("Again, unmount and pagehide (one clear()) send CLEAR, even with nothing lit", () => {
    const sent: Message[] = [];
    const strip = stripLights((m) => sent.push(m));
    strip.on(60, [1, 2, 3]);
    strip.clear();
    strip.clear();
    expect(sent.slice(1)).toEqual([CLEAR, CLEAR]);
  });

  it("Save PNG takes focus when framed, the page gets it back on Again, and nothing moves otherwise", () => {
    expect(focusAfter(false, true)).toBe("save");
    expect(focusAfter(true, false)).toBe("page");
    expect(focusAfter(false, false)).toBeNull();
    expect(focusAfter(true, true)).toBeNull();
  });

  it("the framed painting is a modal dialog, and a polite region announces it", () => {
    const f = { url: "data:image/png;base64,", ms: 61_000, notes: 42 };
    const dialog = renderToStaticMarkup(createElement(FramedPainting, { framed: f, onSave: () => {}, onAgain: () => {} }));
    expect(dialog).toMatch(/role="dialog" aria-modal="true"/);
    expect(dialog).toContain('data-testid="save-png"');
    const live = renderToStaticMarkup(createElement(Live, { text: frameAnnouncement(f) }));
    expect(live).toMatch(/role="status" aria-live="polite"/);
    expect(live).toContain(`Framed. ${caption(f)}`);
    expect(caption(f)).toBe("Free play · 1:01 · 42 notes · after Scriabin");
  });
});
