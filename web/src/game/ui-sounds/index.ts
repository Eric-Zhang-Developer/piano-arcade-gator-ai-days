// UI sounds (spec: ui-sounds): short synthesized menu sounds, mixed under the music. Built from juice-sound's tone,
// on this module's own AudioContext and gain, which follow juice-sound's effects volume and mute.
import { beatSettings } from "../beat";
import { getPrefs, subscribePrefs, tone } from "../sound";
import { previewSettings } from "../song-preview/opening";

export type UiSound = "move" | "confirm" | "back" | "sting" | "tick" | "tickAccent";

// song-preview's laptop-tone peak (about 0.05): every UI node peaks at or under it, before the effects volume.
export const UI_PEAK = (previewSettings.toneVolume * previewSettings.velocity) / 127;

export const uiSoundSettings = {
  levels: { move: UI_PEAK, confirm: UI_PEAK, back: UI_PEAK, sting: UI_PEAK, tick: UI_PEAK, tickAccent: UI_PEAK } satisfies Record<UiSound, number>,
};

const C5 = 523.25;
const semis = (n: number) => C5 * 2 ** (n / 12);

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const level = () => {
  const p = getPrefs();
  return p.muted ? 0 : p.volume;
};

// One context for the page's life. Mute takes the gain to 0 at once, so sounds already scheduled go silent too.
function audio(): { ctx: AudioContext; out: GainNode } {
  if (!ctx || !out) {
    ctx = new AudioContext();
    out = ctx.createGain();
    out.gain.value = level();
    out.connect(ctx.destination);
    subscribePrefs(() => {
      if (out) out.gain.value = level();
    });
  }
  return { ctx, out };
}

// Made in idle time after load, not in the first key handler: the constructor blocks for 0.3–1.6 s in Chromium on
// a busy Mac, which froze the first ↓ (specs/decisions/ui-sounds-warm-context.md). It starts suspended and silent.
if (typeof window !== "undefined" && typeof AudioContext !== "undefined") window.requestIdleCallback?.(() => audio());

// Plays a UI sound delayMs from now. Dropped, never queued, before the page's first key press or click (Chrome
// starts audio only after one), and when muted.
export function uiSound(name: UiSound, delayMs = 0): void {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  if (getPrefs().muted) return;
  const { ctx: c, out: o } = audio();
  if (c.state === "suspended") void c.resume(); // allowed now: there has been a gesture
  const t = c.currentTime + delayMs / 1000;
  const L = uiSoundSettings.levels[name];
  switch (name) {
    case "move": // a short blip
      tone(c, o, "triangle", semis(7), t, 0.03, L);
      return;
    case "confirm": // two rising notes
      tone(c, o, "triangle", semis(7), t, 0.08, L);
      tone(c, o, "triangle", semis(12), t + 0.07, 0.12, L);
      return;
    case "back": // two falling notes
      tone(c, o, "triangle", semis(12), t, 0.08, L);
      tone(c, o, "triangle", semis(7), t + 0.07, 0.12, L);
      return;
    case "sting": // a rising arpeggio, the last note held: about 0.8 s in all
      [0, 4, 7, 12].forEach((s, i) => tone(c, o, "square", semis(s - 12), t + i * 0.07, i === 3 ? 0.55 : 0.1, L));
      return;
    case "tick": // beat-track's laptop click
    case "tickAccent":
      tone(c, o, "sine", name === "tick" ? beatSettings.clickHz : beatSettings.clickAccentHz, t, beatSettings.clickLengthS, L);
      return;
  }
}
