// First run's cues (spec: first-run): which short line shows at a chart time, from the take's events so far. Pure, so
// it tests without a page.
import type { Chart, GameEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { laptopLetters } from "../note-labels/labels";

export const firstRunSettings = {
  showMs: 2000, // each cue at most this long (visual-direction: moments are short)
  pressLeadMs: 1500, // the press cue starts this long before the first note
  combo: 5,
  fadeMs: 200, // 150–250 per the spec; reduced motion shows and hides at once
};

export type CueId = "fall" | "press" | "perfect" | "early" | "late" | "miss" | "combo5";

export interface Cue {
  id: CueId;
  text: string;
  fromMs: number;
  toMs: number;
}

export const firstRunUrl = "/play?song=twinkle&firstrun=1&labels=keys";
export const isFirstRun = (params: URLSearchParams) => params.get("firstrun") === "1";

// The first note's time and the laptop letter that plays it (its lowest pitch, if it opens on a chord).
export function firstNote(chart: Chart): { atMs: number; letter: string } {
  const beat = Math.min(...chart.notes.map((n) => n.beat));
  const pitch = Math.min(...chart.notes.filter((n) => n.beat === beat).map((n) => n.pitch));
  const lowest = Math.min(...chart.notes.map((n) => n.pitch));
  return { atMs: beat * msPerBeat(chart.bpm), letter: laptopLetters(lowest).get(pitch) ?? "the key" };
}

// Every cue the events so far call for, in the order they start. Only the take since the last songStart counts.
export function cuesFor(chart: Chart, events: GameEvent[]): Cue[] {
  const { showMs, pressLeadMs, combo } = firstRunSettings;
  const start = events.findLastIndex((e) => e.type === "songStart");
  if (start < 0) return [];
  const take = events.slice(start);
  const first = firstNote(chart);
  const judged = take.find((e) => e.type === "noteHit" || e.type === "noteMiss");
  const cues: Cue[] = [];
  const pressAt = first.atMs - pressLeadMs;
  const fallAt = take[0].atMs;
  if (fallAt < pressAt) cues.push({ id: "fall", text: "Notes fall toward the line", fromMs: fallAt, toMs: Math.min(fallAt + showMs, pressAt) });
  cues.push({
    id: "press",
    text: `Press ${first.letter} when it touches the line`,
    fromMs: pressAt,
    toMs: Math.min(pressAt + showMs, judged?.atMs ?? Infinity),
  });
  if (judged?.type === "noteMiss") cues.push({ id: "miss", text: "Missed: press as it touches the line", ...shown(judged.atMs) });
  if (judged?.type === "noteHit") {
    const late = judged.offsetMs >= 0;
    if (judged.judgment === "PERFECT") cues.push({ id: "perfect", text: "That was PERFECT!", ...shown(judged.atMs) });
    else cues.push({ id: late ? "late" : "early", text: `${judged.judgment}, a little ${late ? "late" : "early"}`, ...shown(judged.atMs) });
  }
  const streak = take.find((e) => e.type === "combo" && e.count === combo);
  if (streak) cues.push({ id: "combo5", text: `${combo} in a row. Keep going!`, ...shown(streak.atMs) });
  return cues;
}

const shown = (atMs: number) => ({ fromMs: atMs, toMs: atMs + firstRunSettings.showMs });

// The cue on screen at nowMs: one at a time, the latest started wins.
export const cueAt = (cues: Cue[], nowMs: number): Cue | null =>
  cues.findLast((c) => c.fromMs <= nowMs && nowMs < c.toMs) ?? null;

// The cue's opacity: a fade in over fadeMs, none under reduced motion.
export const cueAlpha = (cue: Cue, nowMs: number, still: boolean): number =>
  still ? 1 : Math.min(1, Math.max(0, (nowMs - cue.fromMs) / firstRunSettings.fadeMs));

// Where cues draw: between the HUD band's bottom and the height where a falling note is still 1 s from the line, so a
// cue never covers a note due within 500 ms (juice-visual's rule).
export function cueBand(hudBottom: number, judgmentLineY: number, lookaheadMs: number): { top: number; bottom: number } {
  return { top: hudBottom, bottom: judgmentLineY * (1 - 1000 / lookaheadMs) };
}
