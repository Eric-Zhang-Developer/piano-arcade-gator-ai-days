// Event sounds: short laptop sounds at game events, mixed under the piano (spec: juice-sound). All synthesized here,
// so web/public/sounds/ holds no files and needs no licenses yet.
import type { GameEvent, GamePlugin } from "../../contracts";

export type Sound = "stinger" | "sweep" | "fanfare" | "drumroll" | "rankHit" | "miss";

export const soundSettings = {
  rankHitMs: 900, // after songEnd: the drumroll fills this, then the rank hit lands (decision juice-sound-rank-timing)
  fanfareAfterHitMs: 150, // a full combo's fanfare follows the rank hit
  levels: { stinger: 0.25, sweep: 0.2, fanfare: 0.25, drumroll: 0.2, rankHit: 0.4, miss: 0.15 } satisfies Record<Sound, number>,
};

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
// chart time 0.
export function soundsFor(events: GameEvent[], audioAtZero: number, missCue = true): { sound: Sound; startTime: number }[] {
  const at = (ms: number) => audioAtZero + ms / 1000;
  const { rankHitMs, fanfareAfterHitMs } = soundSettings;
  return events.flatMap((e): { sound: Sound; startTime: number }[] => {
    switch (e.type) {
      case "comboMilestone":
        return [{ sound: "stinger", startTime: at(e.atMs) }];
      case "feverStart":
        return [{ sound: "sweep", startTime: at(e.atMs) }];
      case "noteMiss":
        return missCue ? [{ sound: "miss", startTime: at(e.atMs) }] : [];
      case "fullCombo":
        return [{ sound: "fanfare", startTime: at(e.atMs + rankHitMs + fanfareAfterHitMs) }];
      case "songEnd":
        return [
          { sound: "drumroll", startTime: at(e.atMs) },
          { sound: "rankHit", startTime: at(e.atMs + rankHitMs) },
        ];
      default:
        return [];
    }
  });
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, hz: number, t: number, len: number, level: number) {
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

function noise(ctx: AudioContext, out: AudioNode, t: number, len: number, level: number) {
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

const C5 = 523.25;
const semis = (n: number) => C5 * 2 ** (n / 12);

function play(ctx: AudioContext, out: AudioNode, sound: Sound, t: number) {
  const L = soundSettings.levels[sound];
  switch (sound) {
    case "stinger": // a quick rising major arpeggio
      [0, 4, 7, 12].forEach((s, i) => tone(ctx, out, "triangle", semis(s), t + i * 0.05, 0.18, L));
      return;
    case "sweep": {
      const osc = tone(ctx, out, "sawtooth", 200, t, 0.7, L);
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(1600, t + 0.6);
      return;
    }
    case "fanfare": // arpeggio, then the chord held
      [0, 4, 7].forEach((s, i) => tone(ctx, out, "square", semis(s), t + i * 0.1, 0.12, L * 0.5));
      [0, 4, 7, 12].forEach((s) => tone(ctx, out, "triangle", semis(s), t + 0.3, 0.9, L));
      return;
    case "drumroll": // noise taps, crescendo, filling the gap before the rank hit
      for (let i = 0, n = Math.floor(soundSettings.rankHitMs / 40); i < n; i++) noise(ctx, out, t + i * 0.04, 0.03, L * (0.3 + (0.7 * i) / n));
      return;
    case "rankHit": {
      const osc = tone(ctx, out, "sine", 150, t, 0.5, L);
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.4);
      noise(ctx, out, t, 0.6, L * 0.5);
      return;
    }
    case "miss": // low and short, so it's heard but never mistaken for the piano
      tone(ctx, out, "sine", 98, t, 0.12, L);
      return;
  }
}

export function eventSounds(): GamePlugin {
  let audio: AudioContext | null = null;
  let zeroPerf = 0; // performance.now() at chart time 0

  return {
    id: "juice-sound",
    onEvent(e) {
      if (e.type === "songStart") {
        zeroPerf = performance.now() - e.atMs;
        try {
          audio ??= new AudioContext(); // songStart comes from the Start press, so Chrome lets audio start
          void audio.resume().catch(() => {});
          master ??= audio.createGain();
          master.connect(audio.destination);
          master.gain.value = gainFor(getPrefs());
        } catch {
          audio = null;
        }
        return;
      }
      if (!audio || !master) return;
      // Map the chart clock to the audio clock with a matched pair of readings, as beat-track does.
      const stamp = audio.getOutputTimestamp?.();
      const [ctxT, perfT] = stamp?.performanceTime ? [stamp.contextTime ?? 0, stamp.performanceTime] : [audio.currentTime, performance.now()];
      const audioAtZero = ctxT + (zeroPerf - perfT) / 1000;
      for (const s of soundsFor([e], audioAtZero, getPrefs().missCue)) play(audio, master, s.sound, Math.max(s.startTime, audio.currentTime));
    },
  };
}
