// Event sounds: short laptop sounds at game events, mixed under the piano (spec: juice-sound). All synthesized, so
// web/public/sounds/ holds no files and needs no licenses yet. The milestone voices, the clear card's and NEW RECORD's
// moments and the loudness rule are milestone-sfx's; this is still the one place that schedules them.
import type { GameEvent, GamePlugin } from "../../contracts";
import { recordingLevelAt } from "../audio-track";
import { CLEAR_VOICE, clearWatch, loudnessGain, newRecordImpactMs } from "../milestone-sfx";
import { playVoice, type Voice } from "../milestone-sfx/voices";
import { stampImpactMs } from "../rank-stamp";
import { showsMoment } from "../record-moment/timing";
import { takeOutcome } from "../records";
import { isWaitMode } from "../wait-mode";
import { ignitionFor } from "../fever-arc";

export type Sound = "stinger" | "sweep" | "fanfare" | "drumroll" | "rankHit" | "miss";

export const soundSettings = {
  fanfareAfterHitMs: 150, // a full combo's fanfare follows the rank hit
  missLevel: 0.05, // the miss cue's: 21.1 dB under the laptop piano's C4 (0.15 was 12.6; miss-moment wants 18 or more). The milestone voices' levels are milestone-sfx's
  missGapMs: 120, // miss-moment: in a run of misses, at most one cue per this
  breakMin: 20, // a miss that ends a combo this long deflates instead of the miss cue (#1396)
  settleAfterHitMs: 600, // the results' settle chord follows the rank hit
};

// The mix under a live DGX (#1396, decision milestone-sfx-mix-pass): every effect goes through one bus and a gentle
// compressor, so stacked layers never spike over the piano in the room.
export const mixSettings = {
  busGain: 0.7, // −3.1 dB on every effect, on top of the player's Effects volume
  compressor: { threshold: -20, knee: 12, ratio: 4, attack: 0.003, release: 0.25 },
};

// The last miss cue's chart time, so a run of misses makes at most one cue per missGapMs (miss-moment). One per take.
export type MissGate = { lastMissMs: number };
export const missGate = (): MissGate => ({ lastMissMs: -Infinity });

export interface Prefs {
  volume: number; // 0–1, master for effects
  muted: boolean;
  missCue: boolean;
}

const KEY = { volume: "pianoArcade.sfxVolume", muted: "pianoArcade.sfxMuted", missCue: "pianoArcade.sfxMissCue" };
export const DEFAULT_PREFS: Prefs = { volume: 0.5, muted: false, missCue: true };

export function loadPrefs(): Prefs {
  try {
    const v = Number(localStorage.getItem(KEY.volume));
    return {
      volume: localStorage.getItem(KEY.volume) !== null && v >= 0 && v <= 1 ? v : DEFAULT_PREFS.volume,
      muted: localStorage.getItem(KEY.muted) === "true",
      missCue: localStorage.getItem(KEY.missCue) !== "false",
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

let prefs: Prefs | null = null; // read from localStorage on first use, in the browser
let master: GainNode | null = null;
const gainFor = (p: Prefs) => (p.muted ? 0 : p.volume);
const listeners = new Set<() => void>();

// For useSyncExternalStore: the same object until it changes.
export const getPrefs = (): Prefs => (prefs ??= loadPrefs());
export function subscribePrefs(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

export function savePrefs(p: Prefs): void {
  prefs = p;
  listeners.forEach((f) => f());
  if (master) master.gain.value = gainFor(p);
  try {
    localStorage.setItem(KEY.volume, String(p.volume));
    localStorage.setItem(KEY.muted, String(p.muted));
    localStorage.setItem(KEY.missCue, String(p.missCue));
  } catch {
    // private window: the setting lasts this page only
  }
}

// Pure: which sounds a list of events makes, and when on the audio clock. audioAtZero is the audio time (s) of
// chart time 0. The rank hit lands when rank-stamp's stamp hits.
export function soundsFor(events: GameEvent[], audioAtZero: number, missCue = true, gate = missGate()): { sound: Sound; startTime: number }[] {
  const at = (ms: number) => audioAtZero + ms / 1000;
  const { fanfareAfterHitMs } = soundSettings;
  return events.flatMap((e): { sound: Sound; startTime: number }[] => {
    switch (e.type) {
      case "comboMilestone":
        return [{ sound: "stinger", startTime: at(e.atMs) }];
      case "feverStart":
        return [{ sound: "sweep", startTime: at(ignitionFor(e.atMs)) }]; // on fever-arc's ignition beat, with the flash
      case "noteMiss": {
        const since = e.atMs - gate.lastMissMs;
        if (!missCue || (since >= 0 && since < soundSettings.missGapMs)) return []; // a rewind moves time back: a new run
        gate.lastMissMs = e.atMs;
        return [{ sound: "miss", startTime: at(e.atMs) }];
      }
      case "fullCombo":
        return [{ sound: "fanfare", startTime: at(e.atMs + stampImpactMs() + fanfareAfterHitMs) }];
      case "songEnd":
        return [
          { sound: "drumroll", startTime: at(e.atMs) },
          { sound: "rankHit", startTime: at(e.atMs + stampImpactMs()) },
        ];
      default:
        return [];
    }
  });
}

export function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, hz: number, t: number, len: number, level: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + len);
  return osc;
}

export function noise(ctx: AudioContext, out: AudioNode, t: number, len: number, level: number) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(g).connect(out);
  src.start(t);
}

export interface Scheduled {
  sound: Voice | "miss";
  startTime: number; // on the audio clock
  gain: number; // the loudness rule's, 1 off a recording's loud stretches
  count?: number; // a combo step's count
}

export interface SchedulerOptions {
  notes: number; // the chart's, for the clear card's moment
  wait: boolean; // wait mode isn't scored: no clear card and nothing at songEnd
  missCue: () => boolean;
  newRecord: () => boolean; // read at songEnd, after records has set the take's outcome
  levelAt: (chartMs: number) => number | null; // the recording's level, null when none plays
}

// One event's sounds (spec: milestone-sfx): soundsFor's, the clear card's when the last note is judged, and NEW
// RECORD's at its stamp. Every milestone sound passes the loudness rule; the miss cue stays as juice-sound has it.
export function scheduler(o: SchedulerOptions): (e: GameEvent, audioAtZero: number) => Scheduled[] {
  const clear = clearWatch(o.notes);
  const gate = missGate();
  let clearMs: number | null = null; // the clear card's moment: a combo step on the same note gives way to it
  let fullCombo = false; // the clear card said FULL COMBO or ALL PERFECT: its sequence owns the end, so no drumroll
  let combo = 0;
  return (e, audioAtZero) => {
    if (o.wait && (e.type === "songEnd" || e.type === "fullCombo")) return []; // the judge sends no fullCombo in wait mode today
    if (e.type === "songStart") fullCombo = false;
    const kind = clear(e);
    if (kind) clearMs = e.atMs;
    if (kind && kind !== "CLEAR") fullCombo = true;
    if (e.type === "comboMilestone" && e.atMs === clearMs) return [];
    const broke = (e.type === "noteMiss" || e.type === "wrongNote") && combo >= soundSettings.breakMin && o.missCue();
    if (e.type === "combo") combo = e.count;
    else if (e.type === "noteMiss" || e.type === "wrongNote") combo = 0;
    let atMs: { sound: Voice | "miss"; ms: number }[] = soundsFor([e], 0, o.missCue(), gate).map((s) => ({ sound: s.sound, ms: s.startTime * 1000 }));
    // NOSTALGIA's FULL COMBO sequence replaces the fanfare, and the room stays quiet under it: no drumroll.
    atMs = atMs.filter((s) => s.sound !== "fanfare" && !(s.sound === "drumroll" && fullCombo));
    if (broke) atMs = [...atMs.filter((s) => s.sound !== "miss"), { sound: "comboBreak", ms: e.atMs }];
    if (e.type === "songStart") atMs.push({ sound: "start", ms: e.atMs });
    if (kind && !o.wait) atMs.push({ sound: CLEAR_VOICE[kind], ms: e.atMs });
    if (e.type === "songEnd") atMs.push({ sound: "settle", ms: e.atMs + stampImpactMs() + soundSettings.settleAfterHitMs });
    if (e.type === "songEnd" && o.newRecord()) atMs.push({ sound: "newRecord", ms: e.atMs + newRecordImpactMs() });
    return atMs.map(({ sound, ms }) => ({
      sound,
      startTime: audioAtZero + ms / 1000,
      gain: sound === "miss" ? 1 : loudnessGain(ms, o.levelAt),
      ...(e.type === "comboMilestone" && { count: e.count }),
    }));
  };
}

// The miss cue: low and short, so it's heard but never mistaken for the piano. miss-moment measures it against the piano.
export const playMissCue = (ctx: BaseAudioContext, out: AudioNode, t: number, level = soundSettings.missLevel) =>
  tone(ctx as AudioContext, out, "sine", 98, t, 0.12, level);

function play(ctx: AudioContext, out: AudioNode, s: Scheduled, t: number) {
  if (s.sound === "miss") playMissCue(ctx, out, t);
  else playVoice(ctx, out, s.sound, t, s.gain, s.count);
}

export function eventSounds(): GamePlugin {
  let audio: AudioContext | null = null;
  let zeroPerf = 0; // performance.now() at chart time 0
  let wait = false; // wait mode isn't scored: no drumroll or rank hit at the end (the judge sends no other moments)
  let next: ReturnType<typeof scheduler> = () => [];

  return {
    id: "juice-sound",
    transformChart(chart, params) {
      wait = isWaitMode(params);
      next = scheduler({
        notes: chart.notes?.length ?? Infinity,
        wait,
        missCue: () => getPrefs().missCue,
        newRecord: () => showsMoment(takeOutcome()),
        levelAt: recordingLevelAt,
      });
      return chart;
    },
    onEvent(e) {
      if (wait && e.type === "songEnd") return;
      if (e.type === "songStart") {
        zeroPerf = performance.now() - e.atMs;
        try {
          audio ??= new AudioContext(); // songStart comes from the Start press, so Chrome lets audio start
          void audio.resume().catch(() => {});
          if (!master) {
            const c = mixSettings.compressor;
            const comp = audio.createDynamicsCompressor();
            comp.threshold.value = c.threshold;
            comp.knee.value = c.knee;
            comp.ratio.value = c.ratio;
            comp.attack.value = c.attack;
            comp.release.value = c.release;
            const bus = audio.createGain();
            bus.gain.value = mixSettings.busGain;
            master = audio.createGain();
            master.connect(bus).connect(comp).connect(audio.destination);
          }
          master.gain.value = gainFor(getPrefs());
        } catch {
          audio = null;
        }
      }
      if (!audio || !master) {
        next(e, 0); // keeps the clear card's count
        return;
      }
      // Map the chart clock to the audio clock with a matched pair of readings, as beat-track does.
      const stamp = audio.getOutputTimestamp?.();
      const [ctxT, perfT] = stamp?.performanceTime ? [stamp.contextTime ?? 0, stamp.performanceTime] : [audio.currentTime, performance.now()];
      const audioAtZero = ctxT + (zeroPerf - perfT) / 1000;
      for (const s of next(e, audioAtZero)) play(audio, master, s, Math.max(s.startTime, audio.currentTime));
    },
  };
}
