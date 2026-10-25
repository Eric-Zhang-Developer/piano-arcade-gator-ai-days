// Highlight reel's takes (spike: highlight-reel): the one /play saved (?take=last), or a scripted bot's
// (?take=bot:<name>&song=<id>), judged the way /play judges.
import type { Chart, Results, Take } from "../../../contracts";
import { judgeTake } from "../../core/judge";
import { KEYS_VELOCITY } from "../../core/settings";
import { BOTS, botPresses, type BotName } from "../../scenes";

export const LAST_KEY = "pianoArcade.x.highlightReel.last";
export const FALLBACK = { bot: "rank-b" as BotName, song: "twinkle" };

export interface Saved {
  chart: Chart;
  take: Take;
  results: Results;
}

export function botTake(chart: Chart, name: BotName): Saved {
  const events = botPresses(chart, name).map((p) => ({
    pitch: p.pitch,
    velocity: p.velocity ?? KEYS_VELOCITY,
    timeMs: p.timeMs,
    offTimeMs: p.timeMs + p.holdMs,
  }));
  const take: Take = { chartId: chart.id, startedAt: "2026-10-25T00:00:00.000Z", latencyOffsetMs: 0, inputDevice: "test", events };
  return { chart, take, results: judgeTake(chart, take) };
}

export const isBot = (v: string): v is BotName => (BOTS as readonly string[]).includes(v);

export function saveLast(s: Saved): void {
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(s));
  } catch {
    // private window or full: the page falls back to the scripted take
  }
}

export function loadLast(): Saved | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
