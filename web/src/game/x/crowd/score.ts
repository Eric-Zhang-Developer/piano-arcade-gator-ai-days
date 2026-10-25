// The room's timing (spec: crowd): each clap placed on the chart's beat grid. It's the room's score alone: nothing here
// reaches the judge, the HUD's score or a take (#506: AI around the playing loop, never in it).
export const scoreSettings = {
  onBeatMs: 60, // within this of the grid is on the beat
  backbeatShare: 2 / 3, // the grid is the backbeat when this share of the on-beat claps land on it (decision crowd-grid)
  minForGrid: 4, // on-beat claps before the backbeat can be called; until then, every beat
};

export type Grid = "every" | "backbeat";

export interface RoomScore {
  claps: number;
  onBeat: number;
  share: number; // 0–1, of claps on the chosen grid's beats
  grid: Grid;
  errors: number[]; // each clap's signed error in ms against the chosen grid: negative early, positive late
}

// A beat's place in its bar, counted from 0, for a chart that starts on a downbeat.
const inBar = (beat: number, beatsPerBar: number) => ((beat % beatsPerBar) + beatsPerBar) % beatsPerBar;
const hasBackbeat = (beatsPerBar: number) => beatsPerBar === 2 || beatsPerBar === 4;
const isBackbeat = (beat: number, beatsPerBar: number) => inBar(beat, beatsPerBar) % 2 === 1; // 2 and 4 (2 in 2/4)

// The nearest beat of a grid to a clap at chart ms `t`, and the signed error to it.
function nearest(t: number, msPerBeat: number, beatsPerBar: number, grid: Grid): { beat: number; err: number } {
  const b = Math.round(t / msPerBeat);
  const cands = grid === "every" ? [b] : [b - 1, b, b + 1].filter((x) => isBackbeat(x, beatsPerBar));
  let best = { beat: cands[0], err: t - cands[0] * msPerBeat };
  for (const c of cands) {
    const err = t - c * msPerBeat;
    if (Math.abs(err) < Math.abs(best.err)) best = { beat: c, err };
  }
  return best;
}

// The grid: every beat, unless the claps that land on beats land mostly on the backbeat. Comparing the two grids'
// on-beat shares alone can't pick the backbeat: every clap on 2 and 4 is also on a beat (decision crowd-grid).
export function pickGrid(clapsMs: readonly number[], bpm: number, beatsPerBar: number, s = scoreSettings): Grid {
  if (!hasBackbeat(beatsPerBar)) return "every";
  const msPerBeat = 60000 / bpm;
  const on = clapsMs.map((t) => nearest(t, msPerBeat, beatsPerBar, "every")).filter((n) => Math.abs(n.err) <= s.onBeatMs);
  if (on.length < s.minForGrid) return "every";
  return on.filter((n) => isBackbeat(n.beat, beatsPerBar)).length / on.length >= s.backbeatShare ? "backbeat" : "every";
}

export function scoreRoom(clapsMs: readonly number[], bpm: number, beatsPerBar: number, s = scoreSettings): RoomScore {
  const grid = pickGrid(clapsMs, bpm, beatsPerBar, s);
  const msPerBeat = 60000 / bpm;
  const errors = clapsMs.map((t) => nearest(t, msPerBeat, beatsPerBar, grid).err);
  const onBeat = errors.filter((e) => Math.abs(e) <= s.onBeatMs).length;
  return { claps: clapsMs.length, onBeat, share: clapsMs.length ? onBeat / clapsMs.length : 0, grid, errors };
}

// The results line.
export const roomLine = (r: RoomScore) => `ROOM ${Math.round(r.share * 100)}% ON BEAT · ${r.claps} clap${r.claps === 1 ? "" : "s"}`;
