// Wait hint (spec: wait-hint): in wait mode, after 3 s on a note, its key pulses in its hand's color, the note sounds
// once (the DGX, else a laptop tone) and its name shows large above the line. Plugins never see the judge's noteState,
// so this keeps its own from noteHit events.
import type { Chart, Frame, GamePlugin, Hand, Judgment } from "../../contracts";
import { pickOutput, pianoVoice, toneVoice, type Voice } from "../../replay/piano";
import { isBlack } from "../core/highway";
import { noteTimeMs } from "../core/judge";
import { msPerBeat, settings } from "../core/settings";
import { noteColorFor } from "../hand-colors";
import { noteName } from "../note-labels/labels";
import { bg, ink, whenDisplayFontReady } from "../ui-tokens";
import { isWaitMode } from "../wait-mode";
import { hintTimer, waitHintSettings, waitingNotes } from "./hint";

export { hintTimer, waitHintSettings, waitingNotes } from "./hint";

export interface WaitHintHook {
  pitches: number[];
  name: string;
  sounded: boolean;
}

declare global {
  interface Window {
    __pianoArcadeWaitHint?: WaitHintHook | null;
  }
}

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () =>
  (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

// Saira once it has loaded, as the judgment word does; the body face until then.
let family: string | null = null;
function nameFont(): string {
  if (family === null && typeof document !== "undefined") {
    family = "system-ui, sans-serif";
    whenDisplayFontReady().then(() => {
      const f = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (f) family = `${f}, system-ui, sans-serif`;
    });
  }
  return family ?? "system-ui, sans-serif";
}

const setHook = (v: WaitHintHook | null) => {
  if (typeof window !== "undefined") window.__pianoArcadeWaitHint = v;
};

export function waitHint(): GamePlugin {
  let chart: Chart | null = null;
  let wait = false;
  let color: (hand: Hand) => string = () => ink;
  const hits = new Map<string, Judgment>();
  const timer = hintTimer();
  let voice: Voice | null = null;
  let audio: AudioContext | null = null;
  let sounded = false;
  let pausedAt: number | null = null;
  let floor = -Infinity; // a rewind's bar start: notes before it aren't waited for (the clock's own floor)

  const clear = () => {
    hits.clear();
    floor = -Infinity;
    timer.reset();
    sounded = false;
    setHook(null);
  };

  return {
    id: "wait-hint",
    transformChart(c, params) {
      chart = c;
      wait = isWaitMode(params);
      color = noteColorFor(c);
      clear();
      return c;
    },
    onEvent(e) {
      if (!wait) return;
      if (e.type === "noteHit") hits.set(e.noteId, e.judgment);
      if (e.type === "pause") {
        pausedAt = e.atMs;
        timer.pause();
        setHook(null);
      }
      if (e.type === "resume") {
        timer.resume(performance.now());
        sounded = false;
        // A resume somewhere else is a rewind (wait mode's ← →): notes from its bar start on are unjudged again.
        if (chart && e.atMs !== pausedAt) {
          floor = e.atMs;
          for (const n of chart.notes) if (noteTimeMs(chart, n) >= e.atMs - 1e-6) hits.delete(n.id);
        }
      }
      if (e.type === "quit" || e.type === "songEnd") clear();
      if (e.type !== "songStart") return;
      clear();
      try {
        audio ??= new AudioContext(); // inside Start's click, so it may play; unused when the piano answers
        void audio.resume().catch(() => {});
        voice = toneVoice(audio);
      } catch {
        voice = null; // no Web Audio: the piano or nothing
      }
      // MIDI is asked for here, not at load: /play?midi=sim installs its stand-in after transformChart (hand-mode).
      void navigator.requestMIDIAccess?.().then(
        (access) => {
          const out = pickOutput(access);
          if (out) voice = pianoVoice(out);
        },
        () => {},
      );
    },
    draw(ctx, frame) {
      if (!wait || !chart) return;
      const notes = waitingNotes(chart, hits, frame.nowMs, floor);
      const now = performance.now();
      const r = timer.frame(notes.length ? String(noteTimeMs(chart, notes[0])) : "", now);
      if (!r.show) return setHook(null);
      if (r.sound) {
        sounded = true;
        const mpb = msPerBeat(chart.bpm);
        for (const n of notes) voice?.note(n.pitch, Math.min(n.duration * mpb, waitHintSettings.maxSoundMs));
      }
      const name = notes.map((n) => noteName(n.pitch)).join(" ");
      drawHint(ctx, frame, notes.map((n) => ({ pitch: n.pitch, color: color(n.hand) })), name, now - r.shownAt);
      setHook({ pitches: notes.map((n) => n.pitch), name, sounded });
    },
  };
}

// The lit keys over the drawn keyboard, and the name above the line, its bottom dueGapMs of highway up.
function drawHint(ctx: CanvasRenderingContext2D, f: Frame, keys: { pitch: number; color: string }[], name: string, shownMs: number) {
  const s = waitHintSettings;
  const still = reducedMotion();
  const line = f.judgmentLineY;
  const kbH = f.height - line;
  const pulse = still ? s.highAlpha : s.lowAlpha + ((s.highAlpha - s.lowAlpha) * (1 - Math.cos((2 * Math.PI * shownMs) / s.pulseMs))) / 2;
  ctx.save();
  for (const { pitch, color } of keys) {
    const k = f.keyX(pitch);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    if (isBlack(pitch)) {
      ctx.fillRect(k.x, line, k.width, kbH * 0.62); // core's black key height
      continue;
    }
    // A white key: its front below the black keys, and its back between its black neighbours, so they aren't tinted.
    const left = isBlack(pitch - 1) ? f.keyX(pitch - 1) : null;
    const right = isBlack(pitch + 1) ? f.keyX(pitch + 1) : null;
    const x0 = left ? left.x + left.width : k.x;
    const x1 = right ? right.x : k.x + k.width;
    ctx.fillRect(x0, line, x1 - x0, kbH * 0.62);
    ctx.fillRect(k.x, line + kbH * 0.62, k.width, kbH * 0.38);
  }
  const xs = keys.map((k) => f.keyX(k.pitch));
  const cx = (Math.min(...xs.map((k) => k.x)) + Math.max(...xs.map((k) => k.x + k.width))) / 2;
  const px = Math.round(0.089 * f.height);
  ctx.globalAlpha = still ? 1 : Math.min(1, shownMs / s.nameFadeMs);
  ctx.fillStyle = ink;
  ctx.font = `italic 900 ${px}px ${nameFont()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const half = ctx.measureText(name).width / 2;
  const x = Math.max(half + 8, Math.min(f.width - half - 8, cx));
  const y = line * (1 - s.dueGapMs / settings.lookaheadMs);
  // A black outline first, so the name reads over a pill further up (it may lie over notes due after dueGapMs).
  ctx.lineJoin = "round";
  ctx.lineWidth = px * 0.16;
  ctx.strokeStyle = bg;
  ctx.strokeText(name, x, y);
  ctx.fillText(name, x, y);
  ctx.restore();
}
