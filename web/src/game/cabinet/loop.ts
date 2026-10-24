// The cabinet's kiosk loop (spec: cabinet): title, attract, demo, title. Pure, so it tests without a page.
import type { Chart } from "../../contracts";
import { noteTimeMs } from "../core/judge";

export const cabinetSettings = {
  song: "twinkle", // a piano key on the title starts this
  demoSong: "twinkle",
  titleSeconds: 30, // idle on the title before attract
  attractSeconds: 60,
  resultsSeconds: 10, // the demo's results show this long
  demoSlackSeconds: 15, // the demo never runs past the chart's length plus this
  returnSeconds: 30, // a finished ?cabinet=1 game goes back to /cabinet after this long with no input
  echoMs: 50, // a piano note-on this close to a demo note of the same pitch is the piano's echo
};

export type Phase = "title" | "attract" | "demo";
export interface Loop {
  phase: Phase;
  since: number; // ms, when this phase began
  resultsAt: number | null; // the demo's results showed at this time
}
export interface Timers {
  titleMs: number;
  attractMs: number;
  demoMaxMs: number;
}

export const start = (now: number): Loop => ({ phase: "title", since: now, resultsAt: null });

export function tick(s: Loop, now: number, t: Timers): Loop {
  if (s.phase === "title" && now - s.since >= t.titleMs) return { phase: "attract", since: now, resultsAt: null };
  if (s.phase === "attract" && now - s.since >= t.attractMs) return { phase: "demo", since: now, resultsAt: null };
  if (s.phase === "demo") {
    const resultsDone = s.resultsAt !== null && now - s.resultsAt >= cabinetSettings.resultsSeconds * 1000;
    if (resultsDone || now - s.since >= t.demoMaxMs) return start(now);
  }
  return s;
}

export const demoResults = (s: Loop, now: number): Loop => (s.phase === "demo" && s.resultsAt === null ? { ...s, resultsAt: now } : s);

// A full page load, not client routing: the kiosk starts clean, with no game state or MIDI listeners left over.
export const CABINET_URL = "/cabinet";

// Any key, in any phase: a laptop key opens song select, a piano key starts a game that comes back here.
export const keyUrl = (kind: "laptop" | "piano", song = cabinetSettings.song) => (kind === "laptop" ? "/" : `/play?song=${song}&cabinet=1`);

// cabinet=demo lets the cabinet plugin start the take and report it to this page (specs/decisions/cabinet-demo.md).
export const demoUrl = (song = cabinetSettings.demoSong) => `/play?song=${song}&bot=perfect&audible=1&cabinet=demo`;

export const chartLengthMs = (chart: Chart) => Math.max(...chart.notes.map((n) => noteTimeMs(chart, n) + n.duration * (60000 / chart.bpm)));

// ?title=3&attract=5 shortens the loop for a check; anything else keeps the settings.
export function timers(params: URLSearchParams, chart: Chart | null): Timers {
  const secs = (k: string, d: number) => (Number(params.get(k)) > 0 ? Number(params.get(k)) : d) * 1000;
  return {
    titleMs: secs("title", cabinetSettings.titleSeconds),
    attractMs: secs("attract", cabinetSettings.attractSeconds),
    demoMaxMs: (chart ? chartLengthMs(chart) : 0) + cabinetSettings.demoSlackSeconds * 1000,
  };
}
