// The follow loop (spec: record-follows): each audio block, the stretch ratio is steered so the record's mapped beat
// converges on the player's predicted beat (score-follow's kalmanFollower). The ratio is the player's tempo over the
// record's own, times a phase correction; it changes at most `maxStepPerBeat` per beat of record, stays in 0.5–1.5×,
// and sits at exactly 1.0 when the player is steady with the record, so a steady player hears the record untouched.
// Values: specs/decisions/record-follows-dsp.md.
import type { BeatMap } from "./beatmap";

export const steerSettings = {
  gainPerBeat: 0.6, // a 1-beat lag asks for 60% more speed (before the clamps)
  maxStepPerBeat: 0.03, // the ratio moves at most 3% of itself per beat of record
  minRate: 0.5,
  maxRate: 1.5,
  lockErrBeats: 0.04, // within this of the player...
  lockRate: 0.02, // ...and needing a ratio this close to 1: play at exactly 1.0
  aheadBeats: 0.5, // the record's own tempo is read this far ahead on the map, so the ratio turns before a bend
};

export function steerer(map: BeatMap, start = 1, s = steerSettings) {
  let rate = start;
  return {
    get rate() {
      return rate;
    },
    // playerBeat: the follower's beat for now; playerBps: its tempo in chart beats per second; posSec: the record's
    // position; dtSec: how much record the last block played at the old ratio. Returns the ratio for the next block.
    step(playerBeat: number, playerBps: number, posSec: number, dtSec: number): number {
      const recBeat = map.beatAt(posSec);
      const recBps = map.bpsAt(map.secAt(recBeat + s.aheadBeats));
      const natural = playerBps / recBps;
      const err = playerBeat - recBeat;
      let target = natural * (1 + s.gainPerBeat * err);
      if (Math.abs(err) < s.lockErrBeats && Math.abs(natural - 1) < s.lockRate) target = 1;
      target = Math.min(s.maxRate, Math.max(s.minRate, target));
      // the beat the cap counts is the record's beat here, not the lookahead's
      const room = rate * s.maxStepPerBeat * Math.max(0, map.bpsAt(posSec) * rate * dtSec);
      rate += Math.max(-room, Math.min(room, target - rate));
      if (target === 1 && Math.abs(rate - 1) < 1e-3) rate = 1;
      return rate;
    },
    // The tempo ratio set outright while the follower settles (driver.ts), with no phase term: the driver re-seeks.
    snap(playerBps: number, posSec: number) {
      rate = Math.min(s.maxRate, Math.max(s.minRate, playerBps / map.bpsAt(posSec)));
    },
  };
}
