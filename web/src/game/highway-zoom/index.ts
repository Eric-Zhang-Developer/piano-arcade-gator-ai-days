// Highway zoom (spec: highway-zoom): the visible key range follows the music. Pure; /play asks it for the range each
// frame. Ranges are in white-key units, [lo, hi): white key k spans k..k+1, so a range can sit between keys while it
// eases, and a black key sits on the boundary between its two white neighbours.
import type { Chart } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { GOOD_MS, settings } from "../core/settings";

export const zoomSettings = {
  easeMs: 400, // time constant of the pan and zoom
  minWhiteKeys: 22, // charts wider than this (about three octaves) zoom by default
  minWidth: 15, // white keys: never narrower
  padKeys: 2, // white keys of room each side of the notes
  aheadMs: 1000, // look this far past the top of the highway, so the range moves before notes arrive
};

export interface Range {
  lo: number;
  hi: number;
}

const WHITE_IN_OCTAVE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // a black key maps to the white key below it
export const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(((p % 12) + 12) % 12);
export const whiteIndex = (p: number) => Math.floor(p / 12) * 7 + WHITE_IN_OCTAVE[((p % 12) + 12) % 12];

// The white-key span a pitch needs: its own key, or both neighbours for a black key (it straddles them).
const span = (p: number): Range => (isBlack(p) ? { lo: whiteIndex(p), hi: whiteIndex(p) + 2 } : { lo: whiteIndex(p), hi: whiteIndex(p) + 1 });

// Today's whole-chart range, as makeLayout pads it: one white key past each end.
export function fullRange(chart: Chart): Range {
  const pitches = chart.notes.map((n) => n.pitch);
  return { lo: span(Math.min(...pitches)).lo - 1, hi: span(Math.max(...pitches)).hi + 1 };
}

export const zoomOn = (chart: Chart, params: URLSearchParams): boolean => {
  const z = params.get("zoom");
  if (z === "on" || z === "off") return z === "on";
  const r = fullRange(chart);
  return r.hi - r.lo > zoomSettings.minWhiteKeys;
};

// Each frame's range for one take. Notes are walked in time order with a cursor, so a frame costs the notes in its
// window. Time going backwards (a new take) starts over.
export function createZoom(chart: Chart): (nowMs: number) => Range {
  const s = zoomSettings;
  const full = fullRange(chart);
  const notes = chart.notes.map((n) => ({ t: noteTimeMs(chart, n), pitch: n.pitch })).sort((a, b) => a.t - b.t);
  let first = 0;
  let current: Range | null = null;
  let lastNow = -Infinity;

  // The tightest range holding every note with from <= time <= to; null when there are none.
  const notesIn = (from: number, to: number, start: number): Range | null => {
    let r: Range | null = null;
    for (let i = start; i < notes.length && notes[i].t <= to; i++) {
      if (notes[i].t < from) continue;
      const k = span(notes[i].pitch);
      r = r ? { lo: Math.min(r.lo, k.lo), hi: Math.max(r.hi, k.hi) } : k;
    }
    return r;
  };

  return (nowMs) => {
    if (nowMs < lastNow) [first, current] = [0, null];
    const dt = current ? nowMs - lastNow : 0;
    lastNow = nowMs;
    const from = nowMs - GOOD_MS;
    while (first < notes.length && notes[first].t < from) first++;
    const onScreen = notesIn(from, nowMs + settings.lookaheadMs, first);
    const coming = notesIn(from, nowMs + settings.lookaheadMs + s.aheadMs, first);

    // Target: the coming notes padded, at least minWidth wide, inside today's full range.
    let target = coming ? { lo: coming.lo - s.padKeys, hi: coming.hi + s.padKeys } : current ?? full;
    const grow = Math.max(0, s.minWidth - (target.hi - target.lo)) / 2;
    target = { lo: target.lo - grow, hi: target.hi + grow };
    const shift = Math.max(0, full.lo - target.lo) - Math.max(0, target.hi - full.hi);
    target = { lo: Math.max(full.lo, target.lo + shift), hi: Math.min(full.hi, target.hi + shift) };

    // Ease toward it, then never leave a note on screen outside.
    const k = current ? 1 - Math.exp(-dt / s.easeMs) : 1;
    const eased = current ? { lo: current.lo + (target.lo - current.lo) * k, hi: current.hi + (target.hi - current.hi) * k } : target;
    current = onScreen ? { lo: Math.min(eased.lo, onScreen.lo), hi: Math.max(eased.hi, onScreen.hi) } : eased;
    return current;
  };
}
