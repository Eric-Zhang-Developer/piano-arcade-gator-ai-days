// The bytes the game sends the LED board (spec: led-game; protocol in firmware/README.md, "For the game"). Pure, so
// the tests pin the exact messages: guide-light hints from a chart, a clock time and the judged notes, and key on/off.
import type { Chart, GameEvent, Hand } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { noteColorFor } from "../hand-colors";
import { hudSettings } from "../hud";

export const ledSettings = {
  leadMs: 600, // a note's key glows this long before its time
  hintLevel: 0.5, // hints at half the hand color, so a hit's full color reads over them
  missFlashMs: 150, // a miss lights red this long, then the board's fade (180 ms) takes it out
  heartbeatMs: 1000, // the board releases every key after 2.5 s of silence
  readyTimeoutMs: 4000, // opening the port resets the board (1-2 s); no PAL1 line by then means no board
};

export type Rgb = [number, number, number]; // 0-127 each
export type Message = number[];

const c7 = (v: number) => Math.max(0, Math.min(127, Math.round(v)));

// "#rrggbb" to the board's 7-bit color, times k.
export function rgb7(hex: string, k = 1): Rgb {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c7((v / 255) * 127 * k)) as Rgb;
}

export const keyOn = (pitch: number, [r, g, b]: Rgb): Message => [0x90, pitch, r, g, b];
export const keyOff = (pitch: number): Message => [0x80, pitch];
export const hint = (pitch: number, [r, g, b]: Rgb): Message => [0xa0, pitch, r, g, b];
// The board's show style (firmware setting 15): demo, where hits ripple out both ways and the moments get sparks in
// the UI colors, or the calm default. A board older than the setting ignores it.
export const demoMode = (on: boolean): Message => [0xb0, 15, on ? 1 : 0, 0];
export const CLEAR: Message = [0xf0];
export const HELLO: Message = [0xf1];
export const HEARTBEAT: Message = [0xfe];

// The hints that should be lit at nowMs: every unjudged note within leadMs of its time, earliest note per key.
export function hintsAt(chart: Chart, nowMs: number, judged: ReadonlySet<string>, leadMs = ledSettings.leadMs): Map<number, Rgb> {
  const color = noteColorFor(chart);
  const on = new Map<number, Rgb>();
  const seen = new Set<number>();
  for (const n of chart.notes) {
    if (judged.has(n.id) || seen.has(n.pitch)) continue;
    if (noteTimeMs(chart, n) - leadMs > nowMs) continue;
    seen.add(n.pitch);
    on.set(n.pitch, rgb7(color(n.hand as Hand), ledSettings.hintLevel));
  }
  return on;
}

// From the hints lit now to the ones wanted: a hint for each new or recolored key, a clear (0, 0, 0) for each gone.
export function hintDiff(lit: ReadonlyMap<number, Rgb>, want: ReadonlyMap<number, Rgb>): Message[] {
  const out: Message[] = [];
  for (const [p, rgb] of want) if (lit.get(p)?.join() !== rgb.join()) out.push(hint(p, rgb));
  for (const p of lit.keys()) if (!want.has(p)) out.push(hint(p, [0, 0, 0]));
  return out;
}

// A judged note lights its key: a hit in its judgment's HUD color, a miss red (the HUD's wrong-note red: its MISS pink
// reads as a hint on the strip). The miss's key off comes missFlashMs later, from the plugin.
export function judgedKey(e: GameEvent): Message | null {
  const c = hudSettings.judgmentColors;
  if (e.type === "noteHit") return keyOn(e.pitch, rgb7(c[e.judgment]));
  if (e.type === "noteMiss") return keyOn(e.pitch, rgb7(c.wrong));
  return null;
}
