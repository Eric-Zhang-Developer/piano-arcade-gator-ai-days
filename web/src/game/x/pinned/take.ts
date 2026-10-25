// Pinned's takes (spec: pinned): the one /play saved with ?x=pinned (?take=last), or a scripted perfect take on
// Twinkle. highlight-reel's saveLast and loadLast are the pattern, copied, not imported: experiments are pruned one
// folder at a time.
import type { Chart, Take } from "../../../contracts";
import { KEYS_VELOCITY } from "../../core/settings";
import { botPresses } from "../../scenes";

export const LAST_KEY = "pianoArcade.x.pinned.last";
export const DEMO_SONG = "twinkle";

export interface Saved {
  chart: Chart; // as played: after every transformChart
  take: Take;
  scripted?: boolean;
}

export function demoTake(chart: Chart): Saved {
  const events = botPresses(chart, "perfect").map((p) => ({ pitch: p.pitch, velocity: p.velocity ?? KEYS_VELOCITY, timeMs: p.timeMs, offTimeMs: p.timeMs + p.holdMs }));
  return { chart, take: { chartId: chart.id, startedAt: "2026-10-25T00:00:00.000Z", latencyOffsetMs: 0, inputDevice: "test", events }, scripted: true };
}

export function saveLast(s: Saved): void {
  try {
    sessionStorage.setItem(LAST_KEY, JSON.stringify(s));
  } catch {
    // private window or full: /musicbox falls back to the scripted take
  }
}

export function loadLast(): Saved | null {
  try {
    const raw = sessionStorage.getItem(LAST_KEY);
    const s = raw ? (JSON.parse(raw) as Saved) : null;
    return s?.take?.events?.length ? s : null;
  } catch {
    return null;
  }
}
