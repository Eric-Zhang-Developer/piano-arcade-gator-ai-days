// Milestone SFX's voices (spec: milestone-sfx): each moment is a few layers (a body, a shimmer an octave up, a noise
// transient or riser), synthesized here with plain Web Audio, so web/public/sounds/ still holds no files. Levels sit
// under juice-sound's old single-oscillator peaks, since the layers add up.
import type { ClearVoice } from ".";
import { stampImpactMs } from "../rank-stamp";

export type Voice = "stinger" | "sweep" | "fanfare" | "drumroll" | "rankHit" | ClearVoice | "newRecord";

export const voiceSettings = {
  levels: {
    stinger: 0.18,
    sweep: 0.16,
    fanfare: 0.2,
    drumroll: 0.2,
    rankHit: 0.35,
    clear: 0.16,
    fullComboCard: 0.18,
    allPerfect: 0.18,
    newRecord: 0.18,
  } satisfies Record<Voice, number>,
  attackS: 0.005, // fast enough to read as a hit, slow enough not to click
  feverPeakS: 0.2, // fever-moment's edge flash peaks at 200 ms: the riser lands its chord there
};

const C5 = 523.25;
const semis = (n: number) => C5 * 2 ** (n / 12);

// One oscillator with a fast attack and an exponential decay, through an optional low-pass.
function osc(
  ctx: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  hz: number,
  t: number,
  len: number,
  level: number,
  detune = 0,
  lowpass = 0,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + voiceSettings.attackS);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  let head: AudioNode = g;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    g.connect(f);
    head = f;
  }
  o.connect(g);
  head.connect(out);
  o.start(t);
  o.stop(t + len + 0.02);
  return o;
}

// White noise through a filter, from one buffer per context.
const noiseBufs = new WeakMap<AudioContext, AudioBuffer>();
function noise(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  len: number,
  level: number,
  type: BiquadFilterType,
  hz: number,
  rise = false,
) {
  let buf = noiseBufs.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(ctx, buf);
  }
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  src.loop = true;
  f.type = type;
  f.frequency.value = hz;
  g.gain.setValueAtTime(rise ? 0.0001 : level, t);
  if (rise) g.gain.exponentialRampToValueAtTime(level, t + len);
  else g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + len + 0.02);
  return f;
}

// A chord: each note a triangle body and a sine an octave up, slightly detuned so it shimmers.
function chord(ctx: AudioContext, out: AudioNode, notes: number[], t: number, len: number, L: number) {
  const each = L / Math.sqrt(notes.length);
  for (const n of notes) {
    osc(ctx, out, "triangle", semis(n), t, len, each);
    osc(ctx, out, "sine", semis(n + 12), t, len * 0.8, each * 0.35, 6);
  }
}

// A bell: a sine with its inharmonic partials, long decay.
function bell(ctx: AudioContext, out: AudioNode, n: number, t: number, len: number, L: number) {
  osc(ctx, out, "sine", semis(n), t, len, L);
  osc(ctx, out, "sine", semis(n) * 2.76, t, len * 0.5, L * 0.3);
  osc(ctx, out, "sine", semis(n) * 5.4, t, len * 0.25, L * 0.12);
}

// How far up a combo step's arpeggio starts: 25 at the root, then a step higher each milestone, up to a fifth.
export const comboLift = (count: number) =>
  count < 50 ? 0 : count < 100 ? 2 : Math.min(7, 2 + Math.floor(count / 100));

export function playVoice(ctx: AudioContext, out: AudioNode, v: Voice, t: number, gain = 1, count = 0) {
  const L = voiceSettings.levels[v] * gain;
  switch (v) {
    case "stinger": {
      // a rising major arpeggio, its last note ringing, over a bright click
      const k = comboLift(count);
      [0, 4, 7, 12].forEach((s, i) => {
        osc(ctx, out, "triangle", semis(k + s), t + i * 0.045, i === 3 ? 0.45 : 0.18, L);
        osc(ctx, out, "sine", semis(k + s + 12), t + i * 0.045, 0.15, L * 0.3, 7);
      });
      noise(ctx, out, t, 0.03, L * 0.4, "highpass", 5000);
      return;
    }
    case "sweep": {
      // a noise riser and a detuned saw pair climbing to the flash's peak, then the chord lands
      const p = voiceSettings.feverPeakS;
      noise(ctx, out, t, p, L * 0.6, "bandpass", 1500, true).frequency.exponentialRampToValueAtTime(7000, t + p);
      for (const d of [-8, 8])
        osc(ctx, out, "sawtooth", 220, t, p + 0.05, L * 0.5, d, 3000).frequency.exponentialRampToValueAtTime(
          1760,
          t + p,
        );
      chord(ctx, out, [0, 4, 7, 12], t + p, 0.7, L);
      noise(ctx, out, t + p, 0.25, L * 0.5, "highpass", 6000);
      return;
    }
    case "drumroll": // snare taps, crescendo, filling the gap before the rank hit (the stamp's)
      for (let i = 0, n = Math.floor(stampImpactMs() / 40); i < n; i++)
        noise(ctx, out, t + i * 0.04, 0.035, L * (0.25 + (0.75 * i) / n), "bandpass", 1800 + (1200 * i) / n);
      return;
    case "rankHit": {
      // a kick, a crash and a low open fifth under the stamp
      osc(ctx, out, "sine", 150, t, 0.5, L).frequency.exponentialRampToValueAtTime(45, t + 0.4);
      noise(ctx, out, t, 0.7, L * 0.45, "highpass", 3000);
      noise(ctx, out, t, 0.12, L * 0.5, "lowpass", 600);
      osc(ctx, out, "triangle", semis(-24), t, 0.9, L * 0.4);
      osc(ctx, out, "triangle", semis(-17), t, 0.9, L * 0.3);
      return;
    }
    case "fanfare": // brass-ish arpeggio, then the chord held with its shimmer
      [0, 4, 7].forEach((s, i) => osc(ctx, out, "sawtooth", semis(s), t + i * 0.1, 0.14, L * 0.4, 0, 2500));
      chord(ctx, out, [0, 4, 7, 12], t + 0.3, 1.1, L);
      noise(ctx, out, t + 0.3, 0.4, L * 0.3, "highpass", 7000);
      return;
    case "clear": // a plagal cadence: IV, then I
      chord(ctx, out, [5, 9, 12], t, 0.2, L);
      chord(ctx, out, [0, 4, 7], t + 0.16, 0.8, L);
      return;
    case "fullComboCard": // the cadence brighter: a quick arpeggio up into the octave chord
    case "allPerfect":
      [0, 4, 7, 12, 16].forEach((s, i) => osc(ctx, out, "square", semis(s), t + i * 0.04, 0.12, L * 0.25, 0, 3000));
      chord(ctx, out, [0, 4, 7, 12], t + 0.2, 1.0, L);
      noise(ctx, out, t, 0.05, L * 0.4, "highpass", 5000);
      if (v === "allPerfect") [24, 28, 31, 36].forEach((s, i) => bell(ctx, out, s, t + 0.2 + i * 0.07, 1.2, L * 0.35)); // a sparkle on top
      return;
    case "newRecord": // two bell strikes and a sparkle as the stamp hits
      bell(ctx, out, 12, t, 0.9, L);
      bell(ctx, out, 19, t + 0.09, 1.1, L);
      noise(ctx, out, t, 0.35, L * 0.3, "highpass", 8000);
      return;
  }
}
