// Beat track: a drum beat on the piano from the count-in to the end, so players hear the time (spec: beat-track).
import type { Chart, GameEvent, GamePlugin } from "../../contracts";
import { captureOn } from "../capture-mode";
import { msPerBeat } from "../core/settings";
import { beatTiming, countInBeats as countInFor } from "./timing";

// General MIDI drums, channel 10.
const SIDE_STICK = 37;
const KICK = 36;
const HI_HAT = 42;
const SNARE = 38;
const CLAP = 39;

export const beatSettings = {
  lookaheadMs: 300, // beats are queued this far ahead; stopping leaves at most this much queued
  noteLengthMs: 50,
  stickVelocity: 70,
  kickVelocity: 80,
  hatVelocity: 50,
  clickVolume: 0.3, // laptop fallback, 0–1
  clickAccentHz: 1760,
  clickHz: 1320,
  clickLengthS: 0.03,
  lateClickS: 0.01, // laptop clicks later than this are dropped (the audio device can start after the count-in)
};

// ?beat=<style>: one bar of hits at beat offsets, for a bar of `beatsPerBar` (null: any meter, one cycle per bar).
// A chart whose bar isn't a whole number of the pattern's plays the default. Starting points, to be tuned by ear.
type Pattern = { beatsPerBar: number | null; hits: { at: number; note: number; velocity: number }[] };
const eighths = (n: number, velocity: number) => Array.from({ length: n * 2 }, (_, i) => ({ at: i / 2, note: HI_HAT, velocity }));
export const beatPatterns: Record<string, Pattern> = {
  ragtime: {
    beatsPerBar: 2,
    hits: [{ at: 0, note: KICK, velocity: 80 }, { at: 1, note: SNARE, velocity: 70 }, ...eighths(2, 45)],
  },
  waltz: {
    beatsPerBar: 3,
    hits: [
      { at: 0, note: KICK, velocity: 80 },
      { at: 1, note: HI_HAT, velocity: 50 },
      { at: 2, note: HI_HAT, velocity: 50 },
    ],
  },
  trap: {
    beatsPerBar: 4,
    hits: [
      { at: 0, note: KICK, velocity: 85 },
      { at: 2, note: CLAP, velocity: 75 },
      ...Array.from({ length: 16 }, (_, i) => ({ at: i / 4, note: HI_HAT, velocity: i % 4 ? 35 : 50 })),
    ],
  },
  lullaby: { beatsPerBar: null, hits: [{ at: 0, note: SIDE_STICK, velocity: 40 }] },
};

// The pattern a chart plays for ?beat=<style>, or null for the default (no style, an unknown one, or another meter).
export function patternFor(chart: Chart, style: string | null): Pattern | null {
  const p = style ? beatPatterns[style] : undefined;
  return p && (p.beatsPerBar === null || chart.beatsPerBar % p.beatsPerBar === 0) ? p : null;
}

export interface Hit {
  atMs: number;
  note: number;
  velocity: number;
  accent: boolean; // beat 1 of a bar (count-in included)
}

// Ends with the bar after the last note ends: Twinkle's last note ends on beat 48, so the beat stops before 52.
export function endBeat(chart: Chart): number {
  const lastEnd = Math.max(...chart.notes.map((n) => n.beat + n.duration));
  return (Math.floor(lastEnd / chart.beatsPerBar) + 1) * chart.beatsPerBar;
}

// Every drum hit with fromMs <= atMs < toMs, on the chart clock. With a style's pattern, the count-in is unchanged.
export function beatHits(chart: Chart, fromMs: number, toMs: number, countInBeats = countInFor(chart), style: string | null = null): Hit[] {
  const { pulseBeats, pulseMs, pulsesPerBar } = beatTiming(chart);
  const pattern = patternFor(chart, style);
  const hits: Hit[] = [];
  // At reduced tempos a boundary can divide back to -7.999999999999999
  // instead of -8. Use the same rounding on both ends of adjacent windows.
  const ceilPulse = (value: number) => Math.ceil(value - 1e-9);
  const end = endBeat(chart);
  const first = Math.max(ceilPulse(-countInBeats / pulseBeats), ceilPulse(fromMs / pulseMs)) + 0;
  const last = Math.min(ceilPulse(end / pulseBeats), ceilPulse(toMs / pulseMs));
  for (let pulse = first; pulse < last; pulse++) {
    const atMs = pulse * pulseMs;
    const accent = pulse % pulsesPerBar === 0;
    if (pulse < 0) {
      hits.push({ atMs, note: SIDE_STICK, velocity: beatSettings.stickVelocity, accent });
      continue;
    }
    if (pattern) continue; // a style's hits sit on quarter-note beats, below
    if (accent) hits.push({ atMs, note: KICK, velocity: beatSettings.kickVelocity, accent: true });
    hits.push({ atMs, note: HI_HAT, velocity: beatSettings.hatVelocity, accent });
  }
  if (pattern) {
    const mpb = pulseMs / pulseBeats;
    const cycle = pattern.beatsPerBar ?? chart.beatsPerBar;
    for (let start = Math.max(0, Math.floor(fromMs / mpb / cycle)) * cycle; start < end && start * mpb < toMs; start += cycle) {
      for (const h of pattern.hits) {
        const beat = start + h.at;
        const t = beat * mpb + 0; // + 0 turns -0 into 0
        if (beat < end && t >= fromMs && t < toMs)
          hits.push({ atMs: t, note: h.note, velocity: h.velocity, accent: beat % chart.beatsPerBar === 0 });
      }
    }
    hits.sort((x, y) => x.atMs - y.atMs); // stable: same-time hits keep the pattern's order
  }
  return hits;
}

export function beatTrack(): GamePlugin {
  let chart: Chart | null = null;
  let off = false;
  let output: MIDIOutput | null = null;
  let audio: AudioContext | null = null;
  let bus: GainNode | null = null; // this run's clicks; disconnecting it silences clicks already queued
  let zero = 0; // performance.now() at chart time 0
  let scheduledUntil = 0;
  let active = false;
  let where = "Beat: off";
  let style: string | null = null; // ?beat=<style>, on the piano only: the laptop clicks the beats

  const play = (h: Hit) => {
    const perf = zero + h.atMs;
    if (output) {
      output.send([0x99, h.note, h.velocity], perf);
      output.send([0x89, h.note, 0], perf + beatSettings.noteLengthMs);
      return;
    }
    if (!audio || h.note === KICK) return; // the click marks beats; one click per beat
    // Map performance time to the audio clock with a matched pair of readings, so the audio clock's late start
    // doesn't shift the clicks; until the context runs, fall back to "now".
    const stamp = audio.getOutputTimestamp?.();
    const [ctxT, perfT] = stamp?.performanceTime ? [stamp.contextTime ?? 0, stamp.performanceTime] : [audio.currentTime, performance.now()];
    const due = ctxT + (perf - perfT) / 1000;
    if (due < audio.currentTime - beatSettings.lateClickS) return; // a late click breaks the pulse; skip it
    // A click due a few ms ago plays now: Web Audio throws on a past time, and before the context runs "now" is 0.
    const t = Math.max(due, audio.currentTime);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = h.accent ? beatSettings.clickAccentHz : beatSettings.clickHz;
    gain.gain.setValueAtTime(beatSettings.clickVolume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + beatSettings.clickLengthS);
    osc.connect(gain).connect(bus ?? audio.destination);
    osc.start(t);
    osc.stop(t + beatSettings.clickLengthS);
  };

  const schedule = (nowMs: number) => {
    if (!active || !chart) return;
    const until = nowMs + beatSettings.lookaheadMs;
    for (const h of beatHits(chart, scheduledUntil, until, countInFor(chart), output ? style : null)) play(h);
    scheduledUntil = until;
    if (scheduledUntil >= endBeat(chart) * msPerBeat(chart.bpm)) stop();
  };

  const stop = () => {
    if (!active) return;
    active = false;
    // All Notes Off on channel 10, again once anything already queued has gone out.
    output?.send([0xb9, 123, 0]);
    output?.send([0xb9, 123, 0], performance.now() + beatSettings.lookaheadMs + beatSettings.noteLengthMs);
  };

  // Pause and quit (play-slots): silent now, including what's already queued.
  const silence = () => {
    stop();
    bus?.disconnect();
    bus = null;
    // Web MIDI's clear() drops queued sends. Not every browser has it, and TypeScript's types leave it out.
    (output as (MIDIOutput & { clear?(): void }) | null)?.clear?.();
  };

  // From chart time atMs on: songStart, or resume after a pause (the clock stood still, so atMs maps to now).
  const begin = (atMs: number, eventPerf: number) => {
    zero = eventPerf - atMs;
    if (audio) {
      bus = audio.createGain();
      bus.connect(audio.destination);
    }
    scheduledUntil = atMs;
    active = true;
    schedule(atMs);
  };

  return {
    id: "beat-track",
    transformChart(c, params) {
      chart = c;
      off = params.get("beat") === "off" || params.get("mode") === "wait"; // wait mode stops the clock at every note
      style = params.get("beat") && params.get("beat") !== "off" ? params.get("beat") : null;
      if (!off && typeof navigator !== "undefined" && navigator.requestMIDIAccess) {
        navigator
          .requestMIDIAccess()
          .then((access) => {
            output = [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
          })
          .catch(() => {
            output = null; // no permission or no MIDI: the laptop click takes over
          });
      }
      return c;
    },
    onEvent(e: GameEvent) {
      // Initialization can take time. Keep the event's mapping instead of
      // moving the song's entire pulse to the end of AudioContext startup.
      const eventPerf = performance.now();
      if (e.type === "songEnd") return stop();
      if (e.type === "pause" || e.type === "quit") return silence();
      if (off || !chart) return;
      if (e.type === "resume") return begin(e.atMs, eventPerf);
      if (e.type !== "songStart") return;
      silence();
      if (!output) {
        try {
          audio ??= new AudioContext();
          void audio.resume().catch(() => {});
        } catch {
          audio = null;
        }
      }
      where = output ? "Beat: piano" : audio ? "Beat: laptop" : "Beat: unavailable";
      if (style && output)
        where += patternFor(chart, style)
          ? ` · ${style}`
          : ` · default (${beatPatterns[style] ? `${style} doesn't fit ${chart.beatsPerBar} beats a bar` : `no ${style} pattern`})`;
      begin(e.atMs, eventPerf);
    },
    draw(ctx, frame) {
      schedule(frame.nowMs);
      if (captureOn()) return; // ?capture=1: the beat plays, its status text stays out of the video (capture-mode)
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(off ? "Beat: off" : where, frame.width - 12, 20);
    },
  };
}
