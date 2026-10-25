// Conductor's clock (spike: conductor): a phase-locked loop on chart beats. Each conducted beat pulls the rate toward
// the conductor's interval and corrects the phase over about half a beat. The position never jumps and never goes
// back: its rate, corrections included, stays within 0.5–1.6× the chart's tempo, and a correction that needs more
// is spread over more time. Pure: wall times in ms come in, chart beats come out.
export const clockSettings = {
  minRate: 0.5, // × the chart's tempo
  maxRate: 1.6,
  ratePull: 0.9, // the share of the gap to the conductor's tempo closed on each beat; 0.85 misses the 30 ms bar (decisions)
  phaseBeats: 0.5, // a phase error is corrected over this many beats
  prepBeats: 2, // preparatory beats before the song starts on the next one
  holdBeats: 2, // a hand still this many beats holds a fermata (the page decides stillness; see holdAfterMs)
};

export type ClockState = "prep" | "running" | "held";

export function conductorClock(chartBpm: number, startBeat = 0, beatUnit = 1, s = clockSettings) {
  const chartRate = chartBpm / 60000; // chart beats per ms
  const [lo, hi] = [chartRate * s.minRate, chartRate * s.maxRate];
  let state: ClockState = "prep";
  let pos = startBeat - beatUnit; // the song starts at startBeat, one conducted beat after the last prep beat
  let t: number | null = null; // wall time of pos; null before the clock runs
  let rate = chartRate;
  let corr = 0; // beats of phase correction still to apply
  let corrRate = 0; // beats per ms it's applied at
  const prep: number[] = [];
  let lastBeat: number | null = null;

  // Advance to wall time now (never backward), applying the correction within the clamp.
  const step = (now: number) => {
    if (t === null || now <= t || state !== "running") {
      if (t !== null && now > t) t = now;
      return;
    }
    const dt = now - t;
    const want = rate * dt + Math.sign(corr) * Math.min(Math.abs(corr), corrRate * dt);
    const moved = Math.min(hi * dt, Math.max(lo * dt, want));
    const before = corr;
    corr -= moved - rate * dt; // the share of the correction applied; rate is within the clamp, so it never overshoots
    if (Math.sign(corr) !== Math.sign(before)) corr = 0;
    pos += moved;
    t = now;
  };

  return {
    // The chart beat at wall time now; advances the clock.
    at(now: number): number {
      step(now);
      return pos;
    },
    // The chart beat at a later wall time, without advancing (the scheduler's lookahead).
    peek(later: number): number {
      if (t === null || state !== "running" || later <= t) return pos;
      const dt = later - t;
      const want = rate * dt + Math.sign(corr) * Math.min(Math.abs(corr), corrRate * dt);
      return pos + Math.min(hi * dt, Math.max(lo * dt, want));
    },
    // The current rate in chart beats per ms (0 unless running).
    get rate() {
      return state === "running" ? Math.min(hi, Math.max(lo, rate)) : 0;
    },
    get tempoRatio() {
      return rate / chartRate;
    },
    get state() {
      return state;
    },
    // A conducted beat at wall time bt.
    beat(bt: number) {
      if (state === "prep") {
        prep.push(bt);
        if (prep.length < s.prepBeats) return;
        const interval = bt - prep[prep.length - 2];
        rate = Math.min(hi, Math.max(lo, beatUnit / interval));
        corr = 0;
        t = bt; // pos is one conducted beat before the start, so the song starts on the next beat
        state = "running";
        lastBeat = bt;
        prep.length = 0;
        return;
      }
      if (state === "held") {
        // the next downbeat resumes from where it held, at the tempo it had; a beat reported late moves nothing back
        t = Math.max(t ?? bt, bt);
        corr = 0;
        state = "running";
        lastBeat = bt;
        return;
      }
      step(bt);
      if (lastBeat !== null && bt > lastBeat) {
        const target = Math.min(hi, Math.max(lo, beatUnit / (bt - lastBeat)));
        rate += s.ratePull * (target - rate);
      }
      lastBeat = bt;
      // the beat lands on the nearest conducted beat; the gap is corrected over phaseBeats. The detector reports a
      // beat once the wrist rises again, after its low point: the error is measured where the clock was at bt.
      const then = t !== null && bt < t ? pos - rate * (t - bt) : pos;
      const nearest = startBeat + Math.round((then - startBeat) / beatUnit) * beatUnit;
      corr = nearest - then;
      corrRate = Math.abs(corr) / ((s.phaseBeats * beatUnit) / rate);
    },
    // A fermata: the position stops where it is.
    hold(now: number) {
      step(now);
      if (state === "running") state = "held";
      corr = 0;
    },
    // A cutoff: hold, and two preparatory beats restart from the next conducted beat.
    cut(now: number) {
      step(now);
      state = "prep";
      corr = 0;
      lastBeat = null;
      prep.length = 0;
      pos = startBeat + Math.ceil((pos - startBeat) / beatUnit - 1e-9) * beatUnit - beatUnit;
    },
  };
}

export type ConductorClock = ReturnType<typeof conductorClock>;
