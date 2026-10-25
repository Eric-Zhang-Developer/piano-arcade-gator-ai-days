// The bytes the game sends the LED board (spec: led-game; protocol in firmware/README.md, "For the game"). Pure, so
// the tests pin the exact messages: guide-light hints from a chart, a clock time and the judged notes, and key on/off.
import type { Chart, GameEvent, Hand } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { noteColorFor } from "../hand-colors";
import { hudSettings } from "../hud";
import { hype, primary } from "../ui-tokens";

export const ledSettings = {
  leadMs: 1500, // a note's key glows this long before its time: very faint at first, gold when due (the board's ramp)
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
// The board's mode (firmware setting 15): 0 learning, 1 demo (every key pressed on the piano lights with a quick
// ripple, and nothing else; the site sends the presses, see everywhere.tsx). A board older than the setting ignores it.
export type LightMode = 0 | 1;
export const lightMode = (m: LightMode): Message => [0xb0, 15, m, 0];
// Demo's ripple length (setting 6; 0 = the board's own 600 ms). The sustain pedal stretches it (everywhere.tsx):
// held, every new ripple lasts sustainMs and, as the reach grows with the length, travels further.
export const sustainMs = 1200;
export const rippleLength = (ms: number): Message => [0xb0, 6, ms & 127, ms >> 7];
// The board's brightness (setting 1, 0-255) and its save (setting 20: survives power off).
export const boardBrightnessTo = (v: number): Message => [0xb0, 1, v & 127, v >> 7];
export const SAVE: Message = [0xb0, 20, 0, 0];
// A MIDI sustain pedal message (controller 64): true down, false up, null for anything else.
export function pedal(data: ArrayLike<number>): boolean | null {
  return (data[0] & 0xf0) === 0xb0 && data[1] === 64 ? data[2] >= 64 : null;
}
// The board's hint ramp (setting 7) matches leadMs, so a hint reaches its full color, then gold, as its note lands.
export const hintRamp = (ms = ledSettings.leadMs): Message => [0xb0, 7, ms & 127, ms >> 7];
// Demo's two colors on the strip, one per hand ("#rrggbb"). The default is the left hand blue and the right hand pink,
// from the site's palette (primary, hype), so a palette change reaches the strip; the Lights panel can pick others
// (LightColors). The board deepens them for its LEDs (firmware DEMO_GAMMA).
export type HandColors = Record<Hand, string>;
export const ledHandColors: HandColors = { L: primary, R: hype };
// A press with no note to match: the color of its side of middle C.
export const sideColor = (pitch: number, colors: HandColors = ledHandColors): Rgb => rgb7(colors[pitch < 60 ? "L" : "R"]);
// A piano's MIDI message to the board's key on or off, for demo mode on every page (everywhere.tsx): a press lights
// its key in its side's color, a release (or a note on at velocity 0) darkens it.
export function pressKey(data: ArrayLike<number>, colors: HandColors = ledHandColors): Message | null {
  const kind = data[0] & 0xf0;
  const pitch = data[1];
  if (kind === 0x90 && data[2] > 0) return keyOn(pitch, sideColor(pitch, colors));
  if (kind === 0x80 || kind === 0x90) return keyOff(pitch);
  return null;
}

// Demo on /play: a press lights its key in its falling note's hand (the note hintsAt lights for that key: the
// earliest unjudged one within leadMs): its hand's color. A key with no note falling takes its side's color.
export function pressColor(
  chart: Chart,
  nowMs: number,
  judged: ReadonlySet<string>,
  pitch: number,
  colors: HandColors = ledHandColors,
  leadMs = ledSettings.leadMs,
): Rgb {
  for (const n of chart.notes) {
    if (n.pitch !== pitch || judged.has(n.id) || noteTimeMs(chart, n) - leadMs > nowMs) continue;
    return rgb7(colors[n.hand as Hand]);
  }
  return sideColor(pitch, colors);
}
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
