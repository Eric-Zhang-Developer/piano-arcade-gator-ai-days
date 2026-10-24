// Key preview (spec: key-preview): a key glows faintly in its note's hand color for 500 ms before the note reaches the
// line, brightening linearly, and drops out once the note is hit or its time passes. Its own layer above key-skin's
// keyboard; a flat fill inside the key's face, no glow, so it never reads as a press. ?keypreview=0 turns it off.
import type { Chart, Frame, GamePlugin, Hand } from "../../contracts";
import { isBlack } from "../core/highway";
import { msPerBeat } from "../core/settings";
import { handL, handR } from "../ui-tokens";

export const keyPreviewSettings = {
  leadMs: 500, // starting values: Eric tunes them on the piano
  peakAlpha: 0.35,
  blackKeyHeight: 0.62, // × the keyboard's height, as drawHighway draws black keys
};

export interface PreviewNote {
  id: string;
  pitch: number;
  hand: Hand;
  timeMs: number;
}

export interface PreviewKey {
  pitch: number;
  hand: Hand;
  alpha: number;
}

// 0 from leadMs out, rising linearly to peakAlpha at the line, and 0 once the note's time has passed.
export function previewAlpha(msToHit: number): number {
  const { leadMs, peakAlpha } = keyPreviewSettings;
  if (msToHit < 0 || msToHit >= leadMs) return 0;
  return peakAlpha * (1 - msToHit / leadMs);
}

// The keys to light now: one per pitch, from its nearest unhit note in the window. A chord lights each of its keys.
export function previewKeys(notes: PreviewNote[], nowMs: number, hitIds: ReadonlySet<string>): PreviewKey[] {
  const nearest = new Map<number, { note: PreviewNote; ms: number }>();
  for (const n of notes) {
    if (hitIds.has(n.id)) continue;
    const ms = n.timeMs - nowMs;
    if (previewAlpha(ms) === 0) continue;
    const had = nearest.get(n.pitch);
    if (!had || ms < had.ms) nearest.set(n.pitch, { note: n, ms });
  }
  return [...nearest.values()].map(({ note, ms }) => ({ pitch: note.pitch, hand: note.hand, alpha: previewAlpha(ms) }));
}

declare global {
  interface Window {
    __pianoArcadeKeyPreview?: { lit: { pitch: number; alpha: number; x: number; y: number; w: number; h: number }[] }; // verify-key-preview.mjs
  }
}

const blackRect = (f: Frame, p: number) => {
  const k = f.keyX(p);
  return { x: k.x, y: f.judgmentLineY, w: k.width, h: (f.height - f.judgmentLineY) * keyPreviewSettings.blackKeyHeight };
};

export function keyPreview(): GamePlugin {
  let notes: PreviewNote[] = [];
  let on = true;
  let hits = new Set<string>();
  return {
    id: "key-preview",
    transformChart(chart: Chart, params) {
      const mpb = msPerBeat(chart.bpm);
      notes = chart.notes.map((n) => ({ id: n.id, pitch: n.pitch, hand: n.hand, timeMs: n.beat * mpb }));
      on = params.get("keypreview") !== "0";
      return chart;
    },
    onEvent(e) {
      if (e.type === "songStart") hits = new Set();
      if (e.type === "noteHit") hits.add(e.noteId);
    },
    draw(ctx, f) {
      const lit: NonNullable<Window["__pianoArcadeKeyPreview"]>["lit"] = [];
      if (on)
        for (const k of previewKeys(notes, f.nowMs, hits)) {
          if (k.pitch < f.lowPitch || k.pitch > f.highPitch) continue;
          const key = f.keyX(k.pitch);
          const r = isBlack(k.pitch) ? blackRect(f, k.pitch) : { x: key.x + 0.5, y: f.judgmentLineY, w: key.width - 1, h: f.height - f.judgmentLineY };
          ctx.save();
          if (!isBlack(k.pitch)) {
            // A white key's face only: its black neighbours' rects cut out (even-odd), so the fill never covers them.
            ctx.beginPath();
            ctx.rect(r.x, r.y, r.w, r.h);
            for (const n of [k.pitch - 1, k.pitch + 1])
              if (isBlack(n) && n >= f.lowPitch && n <= f.highPitch) {
                const b = blackRect(f, n);
                ctx.rect(b.x, b.y, b.w, b.h);
              }
            ctx.clip("evenodd");
          }
          ctx.globalAlpha = k.alpha;
          ctx.fillStyle = k.hand === "L" ? handL : handR;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.restore();
          lit.push({ pitch: k.pitch, alpha: k.alpha, ...r });
        }
      if (typeof window !== "undefined") window.__pianoArcadeKeyPreview = { lit };
    },
  };
}
