// Laptop octaves (spec: laptop-octaves): Z and X move the laptop keys an octave. The map never moves by itself: the
// keyboard is static for the whole take (spec: static-keyboard), so a map that wandered would move under the
// player's fingers just as a moving keyboard moved under their eyes. A cyan bar along the bottom of the drawn keyboard marks the keys the
// laptop plays. Core's key map doesn't change: laptop-key events are shifted on their way in.
import type { Frame, GamePlugin, InputDevice } from "../../contracts";
import { makeLayout } from "../core/highway";
import { kitSettings } from "../duo-tokens";
import { keyMap } from "../core/input";
import { isBlack } from "../highway-zoom";
import { setLaptopShift } from "../note-labels";

export const octaveSettings = {
  minKeys: 5, // a position needs this many of the map's 10 white keys on screen
};

const PIANO = { lo: 21, hi: 108 }; // A0..C8
const CYAN = "#27e1ff"; // --pa-cyan, when the stylesheet can't be read
const FONT = "system-ui, sans-serif";

// The laptop map at k = 0: every key it plays, and its 10 white keys.
export interface LaptopMap {
  keys: number[];
  whites: number[];
}

export function laptopMap(lowestPitch: number): LaptopMap {
  const keys = [...keyMap(lowestPitch).values()].sort((a, b) => a - b);
  return { keys, whites: keys.filter((p) => !isBlack(p)) };
}

export interface View {
  lo: number; // lowest and highest visible pitch, inclusive (Frame's lowPitch and highPitch)
  hi: number;
}

// n(k): the map's white keys on screen at position k.
export const onScreen = (m: LaptopMap, k: number, v: View): number =>
  m.whites.filter((p) => p + 12 * k >= v.lo && p + 12 * k <= v.hi).length;

export const onPiano = (m: LaptopMap, k: number): boolean => m.keys.every((p) => p + 12 * k >= PIANO.lo && p + 12 * k <= PIANO.hi);

// Z (d = -1) and X (d = +1): only to a position on the piano with enough keys on screen.
export const canMove = (m: LaptopMap, k: number, d: number, v: View): boolean =>
  onPiano(m, k + d) && onScreen(m, k + d, v) >= octaveSettings.minKeys;

// The chart's whole padded range, as /play lays it out before zoom (if any) takes over.
const wholeRange = (chart: Parameters<typeof makeLayout>[0]): View => {
  const l = makeLayout(chart, 1, 1, 0);
  return { lo: l.lowPitch, hi: l.highPitch };
};

const cssVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

export function laptopOctaves(): GamePlugin {
  let map = laptopMap(60);
  let k = 0;
  let view: View = { lo: 0, hi: 127 }; // the last frame's range; the chart's whole range before the first
  let paused = false;
  let midiPlayed = false;
  let colors: { cyan: string; font: string } | null = null;

  const moveTo = (next: number) => {
    if (next === k) return;
    k = next;
    setLaptopShift(12 * k);
  };

  // Z and X while the keys device runs, so the results screen (records' initials) never sees them.
  const onKey = (e: KeyboardEvent) => {
    const d = e.code === "KeyZ" ? -1 : e.code === "KeyX" ? 1 : 0;
    if (!d || e.repeat || e.metaKey || e.ctrlKey || paused) return;
    e.preventDefault();
    if (canMove(map, k, d, view)) moveTo(k + d);
  };

  function drawBar(ctx: CanvasRenderingContext2D, f: Frame): void {
    colors ??= { cyan: cssVar("--pa-cyan", CYAN), font: `${cssVar("--pa-font-display", "")}, ${FONT}`.replace(/^, /, "") };
    const first = f.keyX(map.whites[0] + 12 * k);
    const last = f.keyX(map.whites[map.whites.length - 1] + 12 * k);
    const x0 = first.x;
    const x1 = last.x + last.width;
    const barH = Math.max(5, Math.round(f.width / 240)); // 5 px at 1280, 8 at 1920
    const px = Math.max(16, Math.round(f.width / 80)); // the readable floor: 16 px at 1280, 24 at 1920
    const chipW = px * 1.5;
    const chipH = px * 1.5;
    const y = f.height - barH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, f.judgmentLineY, f.width, f.height - f.judgmentLineY);
    ctx.clip();
    // A wash rising from the bottom of the mapped keys, so the span reads as "your keys", not as a page edge.
    const washTop = f.height - (f.height - f.judgmentLineY) * 0.45;
    const wash = ctx.createLinearGradient(0, f.height, 0, washTop);
    wash.addColorStop(0, colors.cyan);
    wash.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = wash;
    ctx.fillRect(x0, washTop, x1 - x0, f.height - washTop);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.cyan;
    ctx.shadowColor = colors.cyan;
    ctx.shadowBlur = barH * 2;
    ctx.fillRect(x0, y, x1 - x0, barH);
    ctx.shadowBlur = 0;

    // "Z" and "X" just outside the bar's ends, kept on screen, when that move is allowed.
    ctx.font = `700 ${px}px ${colors.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chipY = y - chipH - barH;
    const chip = (letter: string, cx: number) => {
      const x = Math.max(2, Math.min(f.width - chipW - 2, cx - chipW / 2));
      ctx.fillStyle = "rgba(8, 10, 16, 0.85)";
      ctx.strokeStyle = colors!.cyan;
      ctx.lineWidth = kitSettings.hairline; // Duo: a square hairline chip, like every interface element
      ctx.beginPath();
      ctx.rect(x, chipY, chipW, chipH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors!.cyan;
      ctx.fillText(letter, x + chipW / 2, chipY + chipH / 2 + 1);
    };
    if (canMove(map, k, -1, view)) chip("Z", x0 - chipW / 2 - px * 0.25);
    if (canMove(map, k, 1, view)) chip("X", x1 + chipW / 2 + px * 0.25);
    ctx.restore();
  }

  return {
    id: "laptop-octaves",
    transformChart(c) {
      map = laptopMap(Math.min(...c.notes.map((n) => n.pitch))); // the same lowest pitch /play gives keysDevice
      view = wholeRange(c);
      k = 0;
      setLaptopShift(0);
      return c;
    },
    wrapInput(device): InputDevice {
      if (device.kind === "midi")
        return {
          ...device,
          start: (onEvent) =>
            device.start((e) => {
              if (e.type === "on") midiPlayed = true;
              onEvent(e);
            }),
        };
      if (device.kind !== "keys") return device;
      const played = new Map<number, number>(); // the pitch each held key's press played
      return {
        ...device,
        start(onEvent) {
          window.addEventListener("keydown", onKey);
          return device.start((e) => {
            const pitch = e.type === "on" ? e.pitch + 12 * k : (played.get(e.pitch) ?? e.pitch + 12 * k);
            if (e.type === "on") played.set(e.pitch, pitch);
            else played.delete(e.pitch);
            onEvent({ ...e, pitch });
          });
        },
        stop() {
          window.removeEventListener("keydown", onKey);
          device.stop();
        },
      };
    },
    onEvent(e) {
      if (e.type === "pause") paused = true;
      if (e.type === "resume" || e.type === "songStart") paused = false;
    },
    draw(ctx, frame) {
      view = { lo: frame.lowPitch, hi: frame.highPitch }; // for Z and X's rule; k itself stays where the player put it
      if (!midiPlayed) drawBar(ctx, frame);
    },
    // The hint only when the laptop can't play the whole chart from where it starts (k = 0).
    startPanel: ({ chart }) => {
      const m = laptopMap(Math.min(...chart.notes.map((n) => n.pitch)));
      if (chart.notes.every((n) => m.keys.includes(n.pitch))) return null;
      return (
        <p data-capture-hide style={{ opacity: 0.7, margin: 0 }}>
          <b style={{ color: "var(--pa-cyan)" }}>Z</b> / <b style={{ color: "var(--pa-cyan)" }}>X</b>: octave down / up
        </p>
      );
    },
  };
}
