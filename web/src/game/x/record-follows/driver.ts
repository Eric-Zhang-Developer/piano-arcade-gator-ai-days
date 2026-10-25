// The record's conductor (spec: record-follows): where the recording is and how fast it plays, from the player's
// notes. Pure, so the plugin (index.tsx) and the offline measurement run the same steps:
// - silent until the first correct note, which starts the record at that note's mapped position;
// - through the first `settleBeats` of the take, each note sets the ratio straight from the follower's tempo, and
//   re-seeks to the note when the record is more than `settleSnapMs` off it, as a resume does (the start isn't
//   steering: a 3%-per-beat slew would spend the piece undoing a first guess off by a press's jitter); from then on
//   it's steered every block (steer.ts), with no more jumps;
// - hold() freezes it (Learn's clock holding at a note); the next correct note resumes from that note's position.
import type { Chart } from "../../../contracts";
import { kalmanFollower } from "../../score-follow/follow";
import type { BeatMap } from "./beatmap";
import { steerer } from "./steer";

export const driverSettings = {
  settleBeats: 1, // the ratio is set, not steered, on the notes of the take's first beat
  settleSnapMs: 30, // ...and the record re-seeks to such a note when it's further off than this
};

export type Command = { seek: number } | null; // a jump the audio must make, in recording seconds

export function recordDriver(chart: Chart, map: BeatMap, onsetBeats: readonly number[], s = driverSettings) {
  const f = kalmanFollower(chart, onsetBeats);
  const st = steerer(map);
  const bps = chart.bpm / 60;
  let pos = map.secAt(onsetBeats[0] ?? 0);
  let firstBeat: number | null = null;
  let frozen = true; // silent, or held
  let pending: Command = null;
  const jump = (k: number) => {
    pos = map.secAt(onsetBeats[k]);
    frozen = false;
    pending = { seek: pos };
  };
  return {
    // a correct note's onset index and the wall ms of its press
    played(k: number, wall: number) {
      if (k < f.next) return;
      f.played(k, wall);
      firstBeat ??= onsetBeats[k];
      if (frozen) jump(k);
      else if (onsetBeats[k] - firstBeat <= s.settleBeats) {
        if (Math.abs(map.beatAt(pos) - onsetBeats[k]) * (1000 / bps) > s.settleSnapMs) jump(k);
        st.snap(f.rate * bps, pos);
      }
    },
    hold() {
      if (frozen) return;
      frozen = true;
      f.halt();
    },
    // One step of dtSec at wall ms: the ratio for it, and any jump to make first.
    block(wall: number, dtSec: number): { rate: number; frozen: boolean; cmd: Command } {
      const cmd = pending;
      pending = null;
      if (frozen) return { rate: st.rate, frozen, cmd };
      const last = onsetBeats[onsetBeats.length - 1] ?? 0;
      const rate = st.step(Math.min(f.beatAt(wall), last + 1), f.rate * bps, pos, dtSec);
      pos += rate * dtSec;
      return { rate, frozen, cmd };
    },
    get pos() {
      return pos;
    },
    get rate() {
      return st.rate;
    },
    get frozen() {
      return frozen;
    },
  };
}
