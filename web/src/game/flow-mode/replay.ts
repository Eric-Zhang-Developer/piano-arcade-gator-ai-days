// A saved Flow take, judged again the way Flow judged it (#869). Pure, so the server can run it too.
// The save plugin stores each press at its time on an unpaused wall clock from chart zero, latency taken off: the time
// Flow judges steadiness in (the page's pause clock). Core's judgeTake reads those times as chart times, but Flow's
// chart clock waits and follows the player, so a Flow take re-judged by it comes out nearly all MISS. This replays
// /play's loop instead: frames update the clock and advance the judge, and each press gets its chart time from the
// clock, as app/play/page.tsx does.
import type { Chart, Results, Take } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { onsetsOf } from "./clock";
import { FlowJudge } from "./judge";

const FRAME_MS = 16; // the page's frames; the clock steps in 4 ms inside each, so their phase doesn't change judgments

// For a take of the song's own chart (the save plugin stores no other): no ?tempo, both hands.
export function judgeFlowTake(chart: Chart, take: Take): Results {
  const live = FlowJudge.live;
  const judge = new FlowJudge(chart);
  FlowJudge.live = live; // the constructor makes a judge the live one; a replay mustn't take over a page's
  const lat = take.latencyOffsetMs;
  const mpb = msPerBeat(chart.bpm);
  const order = take.events.map((_, i) => i).sort((a, b) => take.events[a].timeMs - take.events[b].timeMs);
  const wall = (i: number) => take.events[i].timeMs + lat; // the press's own time, as the page read it
  const firstNote = onsetsOf(chart)[0]?.ms ?? 0;
  const start = Math.min(firstNote, order.length ? wall(order[0]) : firstNote) - 4 * mpb;
  const end = (order.length ? Math.max(firstNote, wall(order[order.length - 1])) : firstNote) + 2 * mpb;
  let k = 0;
  for (let t = start; t <= end; t += FRAME_MS) {
    for (; k < order.length && wall(order[k]) <= t; k++) {
      const i = order[k];
      const chartMs = judge.clock.holding ? judge.clock.now(wall(i)) : judge.clock.now(wall(i)) - lat;
      judge.press(take.events[i].pitch, chartMs, i, take.events[i].timeMs);
    }
    judge.clock.update(t);
    judge.advance(judge.clock.now(t));
  }
  return judge.finish(judge.clock.now(end));
}
