// Beat track: a drum beat on the piano from the count-in to the end, so players hear the time (spec: beat-track).
import type { Chart, GameEvent, GamePlugin } from "../../contracts";
import { msPerBeat, settings as core } from "../core/settings";

// General MIDI drums, channel 10.
const SIDE_STICK = 37;
const KICK = 36;
const HI_HAT = 42;

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

// Every drum hit with fromMs <= atMs < toMs, on the chart clock.
export function beatHits(chart: Chart, fromMs: number, toMs: number, countInBeats = core.countInBeats): Hit[] {
  const mpb = msPerBeat(chart.bpm);
  const hits: Hit[] = [];
  const first = Math.max(-countInBeats, Math.ceil(fromMs / mpb)) + 0; // + 0 turns -0 into 0
  const last = Math.min(endBeat(chart), Math.ceil(toMs / mpb)); // exclusive
  for (let b = first; b < last; b++) {
    const atMs = b * mpb;
    const accent = (((b + countInBeats) % chart.beatsPerBar) + chart.beatsPerBar) % chart.beatsPerBar === 0;
    if (b < 0) {
      hits.push({ atMs, note: SIDE_STICK, velocity: beatSettings.stickVelocity, accent });
      continue;
    }
    if (b % chart.beatsPerBar === 0) hits.push({ atMs, note: KICK, velocity: beatSettings.kickVelocity, accent: true });
    hits.push({ atMs, note: HI_HAT, velocity: beatSettings.hatVelocity, accent: b % chart.beatsPerBar === 0 });
  }
  return hits;
}

export function beatTrack(): GamePlugin {
  let chart: Chart | null = null;
  let off = false;
  let output: MIDIOutput | null = null;
  let audio: AudioContext | null = null;
  let zero = 0; // performance.now() at chart time 0
  let scheduledUntil = 0;
  let active = false;
  let where = "Beat: off";

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
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + beatSettings.clickLengthS);
  };

  const schedule = (nowMs: number) => {
    if (!active || !chart) return;
    const until = nowMs + beatSettings.lookaheadMs;
    for (const h of beatHits(chart, scheduledUntil, until)) play(h);
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

  return {
    id: "beat-track",
    transformChart(c, params) {
      chart = c;
      off = params.get("beat") === "off";
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
      if (e.type === "songEnd") return stop();
      if (e.type !== "songStart" || off || !chart) return;
      stop();
      zero = performance.now() - e.atMs;
      if (!output) {
        try {
          audio ??= new AudioContext();
          void audio.resume().catch(() => {});
        } catch {
          audio = null;
        }
      }
      where = output ? "Beat: piano" : audio ? "Beat: laptop" : "Beat: unavailable";
      scheduledUntil = e.atMs;
      active = true;
      schedule(e.atMs);
    },
    draw(ctx, frame) {
      schedule(frame.nowMs);
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(off ? "Beat: off" : where, frame.width - 12, 20);
    },
  };
}
