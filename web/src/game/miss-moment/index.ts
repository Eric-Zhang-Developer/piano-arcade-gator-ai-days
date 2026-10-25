// Miss moment (spec: miss-moment, #1038): a miss shows where, then gets out of the way, and is never louder than a hit.
// The missed note's tail desaturates, thins and fades as it slides through the line; a hairline outline lights its key;
// a wrong key pulses once on its own cap; a combo of 10 or more drops its digits as it breaks. Pure look functions
// first, then the draw plugin, mounted after hud() in layers.ts so it paints over the band.
import type { Chart, Frame, GamePlugin, Hand } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { isBlack } from "../core/highway";
import { msPerBeat, settings } from "../core/settings";
import { noteColorFor } from "../hand-colors";
import { hudLayout, hudSettings } from "../hud";
import { createSynth } from "../laptop-sound/synth";
import { DEFAULT_PIANO_VOLUME } from "../laptop-sound/volume";
import { DEFAULT_PREFS, playMissCue, soundSettings } from "../sound";
import { dip } from "../stage";
import { isWaitMode } from "../wait-mode";
import { miss as missToken, whenDisplayFontReady, wrong as wrongToken } from "../ui-tokens";

export const missSettings = {
  fadeMs: 120, // the missed note desaturates, thins and drops to restAlpha over this
  goneMs: 300, // and is gone by this
  restAlpha: 0.4,
  restWidth: 0.6,
  outlineMs: 400, // the key's hairline outline
  outlineHoldMs: 250, // full strength until here, then it fades
  outlinePerHeight: 540, // the outline's width: round(height / 540) px, 2 at 1080 (1.5 px vanished on the ivory keys)
  outlineFill: 0.18, // and a faint fill of the miss token inside it, so a white key reads as marked
  pulseMs: 180, // the wrong key's one pulse
  pulseAlpha: 0.55,
  breakFrom: 10, // a combo this big drops its digits as it breaks; under it, a plain cut
  breakMs: 200,
  dipFrom: 50, // a break this big also dips the fever stage
  blackKeyFrac: 0.62, // a black key's cap, of the keyboard's height (core/highway.ts's drawBlackKey call)
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - x) ** 2;

export interface MissLook {
  alpha: number; // 0 = gone
  width: number; // of the key's width
  sat: number; // 1 = the hand's color, 0 = grey
  glow: boolean;
}

/** The missed note at t ms after its MISS. Reduced motion: an opacity cut to restAlpha, then gone; no thinning or fade. */
export function missLook(t: number, reduced = false): MissLook {
  const { fadeMs, goneMs, restAlpha, restWidth } = missSettings;
  if (t < 0) return { alpha: 1, width: 1, sat: 1, glow: true };
  if (t >= goneMs) return { alpha: 0, width: reduced ? 1 : restWidth, sat: 0, glow: false };
  if (reduced) return { alpha: restAlpha, width: 1, sat: 0, glow: false };
  const k = easeOut(clamp01(t / fadeMs));
  const alpha = t < fadeMs ? 1 - (1 - restAlpha) * k : restAlpha * (1 - (t - fadeMs) / (goneMs - fadeMs));
  return { alpha, width: 1 - (1 - restWidth) * k, sat: 1 - k, glow: false };
}

/** The key's hairline outline, 0–1: full until outlineHoldMs, then fading out by outlineMs. Reduced motion: full, then cut. */
export function outlineAt(t: number, reduced = false): number {
  const { outlineMs, outlineHoldMs } = missSettings;
  if (t < 0 || t >= outlineMs) return 0;
  if (reduced || t < outlineHoldMs) return 1;
  return 1 - (t - outlineHoldMs) / (outlineMs - outlineHoldMs);
}

/** The wrong key's one pulse, as an alpha: sharp at the press, gone by pulseMs. Reduced motion: held, then cut. */
export function pulseAt(t: number, reduced = false): number {
  const { pulseMs, pulseAlpha } = missSettings;
  if (t < 0 || t >= pulseMs) return 0;
  return reduced ? pulseAlpha : pulseAlpha * (1 - t / pulseMs) ** 2;
}

/**
 * A combo break's old digits at ms since the break: null under breakFrom (a plain cut) or once it's over. They drop by
 * round(height / 180) px (6 at 1080) and fade over breakMs. Reduced motion: no drop, held, then cut.
 */
export function comboBreakAt(ms: number, oldCombo: number, height: number, reduced = false): { dy: number; alpha: number } | null {
  const { breakFrom, breakMs } = missSettings;
  if (oldCombo < breakFrom || ms < 0 || ms >= breakMs) return null;
  if (reduced) return { dy: 0, alpha: 1 };
  const k = ms / breakMs;
  return { dy: Math.round(height / 180) * easeOut(k), alpha: 1 - k };
}

/** A break that dips the fever stage: 50 or more, and not under reduced motion. */
export const dipsStage = (oldCombo: number, reduced = false) => !reduced && oldCombo >= missSettings.dipFrom;

/**
 * A curve's time for an event the game learned of late. The judge calls a miss INPUT_GRACE_MS (50) plus the latency
 * offset after its window closes, about 130 ms at the default offset, so measured from atMs the fade would be over
 * before its first frame. The whole curve plays instead between the first frame that knows (seenMs) and the same
 * deadline, atMs + spanMs. Decision miss-moment-curves.
 */
export const lateT = (now: number, atMs: number, seenMs: number, spanMs: number) =>
  seenMs <= atMs ? now - atMs : ((now - seenMs) * spanMs) / Math.max(1, atMs + spanMs - seenMs);

/**
 * A key's pulse or a combo break, which belong to the moment, not to the chart: at least the wall time since its first
 * drawn frame, so it still ends in its own duration while the chart clock holds (Learn, Flow's wait, the pause; #1331).
 * While the clock runs, the chart's time is the same or ahead, so nothing changes there.
 */
export const heldT = (chartT: number, wallNow: number, seenWall: number) => Math.max(chartT, wallNow - seenWall);

type Rect = { x: number; y: number; w: number; h: number };

/** A key's cap, the part of the drawn keyboard that's that key's (core/highway.ts's keyboard): a black key's short cap,
 * or a white key's whole cap with its black neighbours to cut out of it. */
export function keyCap(f: Pick<Frame, "keyX" | "judgmentLineY" | "height" | "lowPitch" | "highPitch">, pitch: number): { cap: Rect; cut: Rect[] } {
  const kbH = f.height - f.judgmentLineY;
  const k = f.keyX(pitch);
  if (isBlack(pitch)) return { cap: { x: k.x, y: f.judgmentLineY, w: k.width, h: kbH * missSettings.blackKeyFrac }, cut: [] };
  const cut = [pitch - 1, pitch + 1]
    .filter((p) => p >= f.lowPitch && p <= f.highPitch && isBlack(p))
    .map((p) => {
      const b = f.keyX(p);
      return { x: b.x, y: f.judgmentLineY, w: b.width, h: kbH * missSettings.blackKeyFrac };
    });
  return { cap: { x: k.x + 0.5, y: f.judgmentLineY, w: k.width - 1, h: kbH }, cut };
}

// "#rrggbb" toward its own grey by (1 − sat). Anything else comes back unchanged.
export function desaturate(color: string, sat: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const mix = (c: number) => Math.round(y + (c - y) * clamp01(sat));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// ---------- the miss cue against the piano (spec Validation d) ----------

const rmsDb = (b: AudioBuffer) => {
  const d = b.getChannelData(0);
  let s = 0;
  for (const x of d) s += x * x;
  return 20 * Math.log10(Math.sqrt(s / d.length) || 1e-12);
};

/**
 * Renders, through their real code, laptop-sound's voice playing C4 at velocity 80 at the default piano volume, and
 * juice-sound's miss cue at the default effects volume, each over the cue's 120 ms. Returns both RMS levels in dB and
 * the cue's distance under the piano. Needs a browser (OfflineAudioContext).
 */
export async function measureCue(level = soundSettings.missLevel): Promise<{ pianoDb: number; cueDb: number; underDb: number; level: number }> {
  const rate = 48000;
  const len = Math.round(rate * 0.12);
  const piano = new OfflineAudioContext(1, len, rate);
  const out = piano.createGain();
  out.gain.value = DEFAULT_PIANO_VOLUME;
  out.connect(piano.destination);
  createSynth(() => ({ ctx: piano as unknown as AudioContext, out })).message([0x90, 60, 80], 0);
  const cue = new OfflineAudioContext(1, len, rate);
  const master = cue.createGain();
  master.gain.value = DEFAULT_PREFS.muted ? 0 : DEFAULT_PREFS.volume;
  master.connect(cue.destination);
  playMissCue(cue, master, 0, level);
  const [pianoDb, cueDb] = [rmsDb(await piano.startRendering()), rmsDb(await cue.startRendering())];
  return { pianoDb, cueDb, underDb: pianoDb - cueDb, level };
}

// ---------- the plugin ----------

declare global {
  interface Window {
    // The luminance probe (spec Validation c), off unless a harness creates it before the take: each frame, the mean
    // luminance of the playfield above the keyboard, read from the highway and overlay canvases; and the take's misses
    // and hits with their chart times.
    __pianoArcadeMiss?: {
      frames: { nowMs: number; luma: number; tails: { t: number; width: number; alpha: number }[]; pulse?: number; digits?: boolean }[];
      events?: { type: string; judgment?: string; atMs: number }[];
    };
    __pianoArcadeMissCue?: typeof measureCue; // verify-miss.mjs and the PR's measurement
  }
}

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

// The probe's sampler: both canvases scaled into 64×36, the playfield's rows only.
let probe: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
function playfieldLuma(overlay: HTMLCanvasElement, line: number, height: number): number {
  if (!probe) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    probe = { canvas, ctx: canvas.getContext("2d", { willReadFrequently: true })! };
  }
  const { ctx } = probe;
  const rows = Math.max(1, Math.round((36 * line) / height));
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 64, 36);
  const highway = overlay.previousElementSibling;
  for (const c of [highway?.tagName === "CANVAS" ? (highway as HTMLCanvasElement) : null, overlay]) if (c) ctx.drawImage(c, 0, 0, 64, 36);
  const px = ctx.getImageData(0, 0, 64, rows).data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
  return sum / (px.length / 4) / 255;
}

type Miss = { pitch: number; atMs: number; seenMs?: number; endMs: number; hand: Hand };

export function missMoment(): GamePlugin {
  if (typeof window !== "undefined") window.__pianoArcadeMissCue = measureCue;
  let chart: Chart | null = null;
  let color: (hand: Hand) => string = () => settings.noteColor;
  let notes = new Map<string, { endMs: number; hand: Hand }>();
  let misses: Miss[] = [];
  let pulses: { pitch: number; atMs: number; seenWall?: number }[] = [];
  let combo = 0;
  let broken: { atMs: number; seenMs?: number; seenWall?: number; combo: number } | null = null;
  let wait = false; // Learn has no combo to break (#1331)
  let display = hudSettings.font;
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) display = `${family}, ${hudSettings.font}`;
    });
  const reset = () => {
    misses = [];
    pulses = [];
    combo = 0;
    broken = null;
  };
  const breakAt = (atMs: number) => {
    if (!wait && combo >= missSettings.breakFrom) broken = { atMs, combo };
    if (!wait && dipsStage(combo, reducedMotion())) dip(atMs);
    combo = 0;
  };
  const log = (e: { type: string; judgment?: string; atMs: number }) => {
    if (typeof window !== "undefined" && window.__pianoArcadeMiss) (window.__pianoArcadeMiss.events ??= []).push(e);
  };

  return {
    id: "miss-moment",
    transformChart(c, params) {
      chart = c;
      wait = params ? isWaitMode(params) : false;
      color = noteColorFor(c);
      const beatMs = msPerBeat(c.bpm);
      notes = new Map(c.notes.map((n) => [n.id, { endMs: noteTimeMs(c, n) + n.duration * beatMs, hand: n.hand }]));
      reset();
      return c;
    },
    onEvent(e) {
      switch (e.type) {
        case "songStart":
          reset();
          break;
        case "resume": // a rewind lands the clock before them: they'd pulse again for keys not pressed yet
          pulses = pulses.filter((p) => p.atMs <= e.atMs);
          if (broken && broken.atMs > e.atMs) broken = null;
          break;
        case "combo":
          combo = e.count;
          break;
        case "noteHit":
          log({ type: e.type, judgment: e.judgment, atMs: e.atMs });
          break;
        case "noteMiss": {
          const n = notes.get(e.noteId);
          misses.push({ pitch: e.pitch, atMs: e.atMs, endMs: n?.endMs ?? e.atMs, hand: n?.hand ?? "R" });
          log({ type: e.type, atMs: e.atMs });
          breakAt(e.atMs);
          break;
        }
        case "wrongNote":
          pulses.push({ pitch: e.pitch, atMs: e.atMs });
          log({ type: e.type, atMs: e.atMs });
          breakAt(e.atMs);
          break;
      }
    },
    draw(ctx, f) {
      if (!chart) return;
      const probeLog = typeof window !== "undefined" ? window.__pianoArcadeMiss : undefined;
      const tails: { t: number; width: number; alpha: number }[] = [];
      let pulseMax = 0;
      let digits = false;
      const reduced = reducedMotion();
      const now = f.nowMs;
      const wall = performance.now();
      const line = f.judgmentLineY;
      misses = misses.filter((m) => now - m.atMs < missSettings.outlineMs);
      const pulseT = (p: (typeof pulses)[number]) => heldT(now - p.atMs, wall, (p.seenWall ??= wall));
      pulses = pulses.filter((p) => pulseT(p) < missSettings.pulseMs);

      // The missed notes' tails, clipped to the highway: still moving at the highway's speed, now thin, grey and fading.
      const pxPerMs = line / settings.lookaheadMs;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, f.width, line);
      ctx.clip();
      for (const m of misses) {
        m.seenMs ??= now;
        const look = missLook(lateT(now, m.atMs, m.seenMs, missSettings.goneMs), reduced);
        const top = line - (m.endMs - now) * pxPerMs + settings.noteGapPx;
        if (look.alpha <= 0 || top >= line) continue;
        const k = f.keyX(m.pitch);
        const w = k.width * look.width;
        ctx.globalAlpha = look.alpha;
        ctx.fillStyle = desaturate(color(m.hand), look.sat);
        ctx.fillRect(k.x + (k.width - w) / 2, top, w, line - top);
        if (probeLog) tails.push({ t: now - m.atMs, width: look.width, alpha: look.alpha });
      }
      ctx.restore();

      // The keys: a hairline outline on a missed note's key, one pulse on a wrong key's cap.
      const shape = (pitch: number) => {
        const { cap, cut } = keyCap(f, pitch);
        ctx.beginPath();
        ctx.rect(0, line, f.width, f.height - line);
        for (const r of cut) ctx.rect(r.x, r.y, r.w, r.h);
        ctx.save();
        ctx.clip("evenodd"); // the white key minus its black neighbours
        return cap;
      };
      for (const m of misses) {
        const a = outlineAt(lateT(now, m.atMs, m.seenMs ?? now, missSettings.outlineMs), reduced);
        if (a <= 0) continue;
        const cap = shape(m.pitch);
        const px = Math.max(1, Math.round(f.height / missSettings.outlinePerHeight));
        ctx.globalAlpha = a * missSettings.outlineFill;
        ctx.fillStyle = missToken;
        ctx.fillRect(cap.x, cap.y, cap.w, cap.h);
        ctx.globalAlpha = a;
        ctx.strokeStyle = missToken;
        ctx.lineWidth = px;
        ctx.strokeRect(cap.x + px / 2, cap.y + px / 2, cap.w - px, cap.h - px);
        ctx.restore();
      }
      for (const p of pulses) {
        const a = pulseAt(pulseT(p), reduced);
        if (a <= 0) continue;
        pulseMax = Math.max(pulseMax, a);
        const cap = shape(p.pitch);
        ctx.globalAlpha = a;
        ctx.fillStyle = wrongToken;
        ctx.fillRect(cap.x, cap.y, cap.w, cap.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // The broken combo's old digits, dropping and fading in the HUD's combo slot (the HUD has already cut to blank).
      if (broken) {
        broken.seenMs ??= now;
        const t = heldT(lateT(now, broken.atMs, broken.seenMs, missSettings.breakMs), wall, (broken.seenWall ??= wall));
        const b = comboBreakAt(t, broken.combo, f.height, reduced);
        if (!b) broken = null;
        else {
          const l = hudLayout(f.width, line);
          const text = String(broken.combo);
          let px = l.combo.size;
          ctx.font = `900 ${Math.round(px)}px ${display}`;
          const room = l.combo.room;
          const w = ctx.measureText(text.length < 3 ? "888" : text).width; // the HUD's own sizing, so it doesn't jump
          if (w > room) px *= room / w;
          ctx.font = `900 ${Math.round(px)}px ${display}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.globalAlpha = b.alpha;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, l.combo.cx, l.combo.cy + b.dy);
          digits = true;
          ctx.globalAlpha = 1;
        }
      }

      if (probeLog) probeLog.frames.push({ nowMs: now, luma: playfieldLuma(ctx.canvas, line, f.height), tails, pulse: pulseMax, digits });
    },
  };
}
