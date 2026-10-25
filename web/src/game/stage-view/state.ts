// /stage's state (spec: stage-view): what /play posts on sheet-view's channel, folded into one value. Pure, so a
// scripted list of messages tests it without a page. The look (the lane, the approach, the effects) reads it.
import type { Chart, Judgment } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import type { SheetMessage } from "../sheet-view/plugin";

export interface Moment {
  atMs: number; // the page's own clock (performance.now) when it arrived: effects play out even while Flow's chart
  // clock holds, and after the end, when /play stops sending it
}
export interface Hit extends Moment {
  noteId: string;
  judgment: Judgment;
}

export interface StageState {
  chart: Chart | null; // null: no take yet, the waiting state
  nowMs: number | null; // the chart clock, from /play's frames
  judged: ReadonlyMap<string, Judgment>;
  combo: number;
  hits: readonly Hit[]; // newest last; the look drops the ones whose effect has ended
  milestone: (Moment & { count: number }) | null; // the latest
  fullCombo: Moment | null;
  ended: Moment | null;
}

export const emptyStage: StageState = { chart: null, nowMs: null, judged: new Map(), combo: 0, hits: [], milestone: null, fullCombo: null, ended: null };

// Effects older than this are dropped from `hits`, so a long take doesn't grow the list. Longer than any effect.
const keepMs = 2000;

export function reduceStage(s: StageState, m: SheetMessage, at: number): StageState {
  switch (m.type) {
    case "take":
      return { ...emptyStage, chart: m.chart }; // the latest take wins, as on /sheet
    case "clock":
      return { ...s, nowMs: m.nowMs, hits: s.hits.length && s.hits[0].atMs < at - keepMs ? s.hits.filter((h) => h.atMs >= at - keepMs) : s.hits };
    case "judgment": {
      const judged = new Map(s.judged).set(m.noteId, m.judgment);
      return { ...s, judged, hits: [...s.hits, { noteId: m.noteId, judgment: m.judgment, atMs: at }] };
    }
    case "combo":
      return { ...s, combo: m.count };
    case "milestone":
      return { ...s, milestone: { count: m.count, atMs: at } };
    case "fullCombo":
      return { ...s, fullCombo: { atMs: at } };
    case "end":
      return { ...s, ended: { atMs: at } };
    default:
      return s; // a message this page doesn't read
  }
}

// The notes on the lane at the clock: due within approachMs and not yet judged, earliest first. `t` is how far each is
// along its approach: 0 as it appears at the far end, 1 at the judgment bar.
export function onLane(s: StageState, approachMs: number): { id: string; pitch: number; hand: "L" | "R"; t: number }[] {
  if (!s.chart || s.nowMs === null) return [];
  const now = s.nowMs;
  const out = [];
  for (const n of s.chart.notes) {
    const due = noteTimeMs(s.chart, n);
    if (s.judged.has(n.id) || due < now || due > now + approachMs) continue;
    out.push({ id: n.id, pitch: n.pitch, hand: n.hand, t: 1 - (due - now) / approachMs });
  }
  return out.sort((a, b) => b.t - a.t); // the nearest the bar first
}
