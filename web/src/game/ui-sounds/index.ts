// UI sounds (spec: ui-sounds, then ui-sound-family): short menu sounds, mixed under the music. One soft celesta family
// in the song's key, rendered by timbre.ts and played as AudioBuffers on this module's own AudioContext and gain,
// which follow juice-sound's effects volume and mute.
import { getPrefs, subscribePrefs } from "../sound";
import { previewSettings } from "../song-preview/opening";
import { admit, C_MAJOR, LENGTH_S, pileSettings, render, strikes, type Key, type Voice } from "./timbre";

export type { Key } from "./timbre";
export { keyOf } from "./timbre";

export type UiSound = "move" | "confirm" | "back" | "sting" | "tick" | "tickAccent";

// song-preview's laptop-tone peak (about 0.05), the reference the family sits under.
export const UI_PEAK = (previewSettings.toneVolume * previewSettings.velocity) / 127;

export const uiSoundSettings = {
  underPreviewDb: 18, // every sound peaks this far under the preview, before the effects volume. Not 12: RMS binds (decision timbre)
  restartS: 1, // after this long without a move, move's scale walk starts again on the tonic
};

export const UI_LEVEL = UI_PEAK * 10 ** (-uiSoundSettings.underPreviewDb / 20);

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

// The page's own first key or pointer press. Not navigator.userActivation: Chromium can report it on a load nobody
// touched (headless Linux in CI, and next dev), which played the stage card's sting on a direct /play load (#465).
// A select-to-stage move is a client navigation, so the Enter that chose the song still counts on /play.
let pressed = false;
if (typeof window !== "undefined")
  for (const type of ["keydown", "pointerdown"])
    window.addEventListener?.(type, (e) => void (pressed ||= e.isTrusted), { capture: true, passive: true });

// "Now" for every sound asked for in one synchronous run: the audio clock read once, at the run's first call. Each
// sound renders its samples before it starts, and the clock moves on meanwhile, so a countdown's four ticks read
// one by one landed up to 5 ms off their beats (full-run-reds, #1284).
let runNowS: number | null = null;
const nowS = (c: AudioContext): number => {
  if (runNowS === null) {
    runNowS = c.currentTime;
    queueMicrotask(() => (runNowS = null));
  }
  return runNowS;
};

type Playing = Voice & { src: AudioBufferSourceNode; gain: GainNode };
let voices: Playing[] = [];
let last = { atS: -Infinity, velocity: 1 };
let step = 0;

// Plays a UI sound delayMs from now, in the given key (C major without one). Dropped, never queued, before that first
// press (Chrome starts audio only after one), and when muted.
export function uiSound(name: UiSound, delayMs = 0, opts: { key?: Key } = {}): void {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
  if (!pressed) return;
  if (getPrefs().muted) return;
  const { ctx: c, out: o } = audio();
  if (c.state === "suspended") void c.resume(); // allowed now: there has been a gesture
  const t = nowS(c) + delayMs / 1000;
  if (name === "move") step = t - last.atS > uiSoundSettings.restartS ? 0 : step + 1;
  const { live, steal, velocity } = admit(voices, last, t);
  for (const v of steal) {
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + pileSettings.fadeS);
    v.src.stop(t + pileSettings.fadeS);
  }
  const samples = render(strikes(name, opts.key ?? C_MAJOR, step), LENGTH_S[name], c.sampleRate, UI_LEVEL);
  const buf = c.createBuffer(1, samples.length, c.sampleRate);
  buf.copyToChannel(samples, 0);
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  gain.gain.value = velocity;
  src.connect(gain).connect(o);
  src.start(t);
  voices = [...live, { src, gain, startS: t, endS: t + LENGTH_S[name] }];
  last = { atS: t, velocity };
}

// The module's context and gain, for the Lab A/B's old sounds.
export const uiAudio = () => audio();
