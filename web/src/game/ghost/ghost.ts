// The ghost's logic (spec: ghost): what a take leaves behind, and where it draws. Pure, from GameEvents only.
import type { Chart, GameEvent } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { pillRect } from "../note-pills";

export const ghostSettings = {
  alpha: 0.4, // lower this first if the ghost gets in the way
  dashPx: [4, 4],
  lineWidthPx: 1.5,
  tickPx: 10, // an extra's tick: this tall, centered on its press
};

export const GHOST_KEY = "pianoArcade.ghost";
const CHART_PARAMS = ["song", "from", "to", "tempo", "hands", "level"]; // the URL params that change the chart

export interface Ghost {
  hits: { pitch: number; atMs: number; durationMs: number }[]; // atMs: when it was played (note time + offset)
  extras: { pitch: number; atMs: number }[]; // every press that matched no note, WRONG ones included
}

export const emptyGhost = (): Ghost => ({ hits: [], extras: [] });

// A ghost shows only on a take of the same chart: same id, same params that change the chart.
export function ghostKey(chartId: string, params: URLSearchParams): string {
  return [chartId, ...CHART_PARAMS.map((p) => `${p}=${params.get(p) ?? ""}`)].join("&");
}

// One take's ghost, built up event by event. A WRONG note is sent after its own extra, so the extra is enough.
export function recordGhost(chart: Chart, g: Ghost, e: GameEvent): Ghost {
  if (e.type === "noteHit") {
    const n = chart.notes.find((x) => x.id === e.noteId);
    const durationMs = n ? n.duration * msPerBeat(chart.bpm) : 0;
    return { ...g, hits: [...g.hits, { pitch: e.pitch, atMs: e.atMs, durationMs }] };
  }
  if (e.type === "extra") return { ...g, extras: [...g.extras, { pitch: e.pitch, atMs: e.atMs }] };
  return g;
}

// Screen y of chart time atMs on the flat highway: the judgment line at nowMs, lookaheadMs above it at the top.
export const yAt = (atMs: number, nowMs: number, judgmentLineY: number, lookaheadMs: number) =>
  judgmentLineY - (atMs - nowMs) * (judgmentLineY / lookaheadMs);

export const ghostOff = (param: string | null, stored: string | null) => param === "off" || stored === "off";

// A hit's outline: the pill the highway draws for that key (note-pills), with the highway's corner rule (`bar` in
// core/highway.ts: the pill's radius, at most a third of the width and half the height). Top and bottom are the
// caller's: when you played it.
export function ghostOutline(key: { x: number; width: number }, isBlack: boolean, top: number, bottom: number) {
  const pill = pillRect(key, isBlack);
  return { x: pill.x, width: pill.width, radius: Math.min(pill.radius, pill.width / 3, (bottom - top) / 2) };
}
