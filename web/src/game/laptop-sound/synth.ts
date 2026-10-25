// Laptop sound's synth (spec: laptop-sound): MIDI messages in, Web Audio out. Piano-like voices on channels 1–16
// with the pedal (CC64) and All Notes Off (CC123), and four drum hits on channel 10 for beat-track.
// The bookkeeping (which notes sound) runs with or without audio, so the test hook counts voices before the first
// gesture lets the AudioContext start; the audio parts are skipped until then. Once sampled-piano's bank has
// decoded, piano notes play its samples instead of the oscillators.
import { playSample, type Bank } from "../sampled-piano";

export const synthSettings = {
  maxVoices: 32, // a 33rd steals the oldest
  attackS: 0.004,
  releaseS: 0.08, // time constant of a released note's fade
  peak: 0.35, // a velocity-127 note's level, before the piano volume
};

export interface Audio {
  ctx: AudioContext;
  out: GainNode; // the piano volume
  bank?: Bank; // set once every sample has decoded (sampled-piano)
}

interface Voice {
  ch: number;
  pitch: number;
  held: boolean; // the key is still down
  stop: (atS: number) => void;
}

const hz = (p: number) => 440 * 2 ** ((p - 69) / 12);

// One piano-like voice: two partials through a lowpass that opens with velocity, a fast strike, then a decay that's
// longer for low notes. Returns its release. With the samples in, the sampled voice instead.
function strike(a: Audio, pitch: number, velocity: number, t: number): (atS: number) => void {
  if (a.bank) return playSample(a, a.bank, pitch, velocity, t);
  const { ctx, out } = a;
  const v = velocity / 127;
  const env = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = Math.min(16000, hz(pitch) * (2 + 8 * v));
  const oscs = [
    [1, "triangle", 1],
    [2, "sine", 0.3],
  ].map(([mult, type, level]) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type as OscillatorType;
    o.frequency.value = hz(pitch) * (mult as number);
    g.gain.value = level as number;
    o.connect(g).connect(tone);
    o.start(t);
    return o;
  });
  tone.connect(env).connect(out);
  const peak = synthSettings.peak * v ** 1.5;
  const decayS = Math.max(0.6, 4 - (pitch - 21) / 30); // low notes ring longer
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + synthSettings.attackS);
  env.gain.setTargetAtTime(0, t + synthSettings.attackS, decayS / 3);
  return (atS) => {
    const at = Math.max(atS, t);
    env.gain.cancelScheduledValues(at);
    env.gain.setTargetAtTime(0, at, synthSettings.releaseS);
    oscs.forEach((o) => o.stop(at + synthSettings.releaseS * 6));
  };
}

// General MIDI drums beat-track sends: kick, side stick, snare, closed hi-hat. Each a short synthesized hit.
export const DRUMS = [36, 37, 38, 42];

function drum(a: Audio, note: number, velocity: number, t: number) {
  const { ctx, out } = a;
  const v = velocity / 127;
  const g = ctx.createGain();
  g.connect(out);
  if (note === 36) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(g);
    g.gain.setValueAtTime(0.6 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.start(t);
    o.stop(t + 0.22);
    return;
  }
  // Snare, side stick and hi-hat: filtered noise, with a body tone for the snare.
  const len = note === 42 ? 0.05 : note === 37 ? 0.03 : 0.15;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = note === 42 ? "highpass" : "bandpass";
  f.frequency.value = note === 42 ? 7000 : note === 37 ? 1800 : 1200;
  src.connect(f).connect(g);
  g.gain.setValueAtTime((note === 42 ? 0.15 : 0.35) * v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.start(t);
  src.stop(t + len);
}

export interface Synth {
  message(bytes: ArrayLike<number>, atS?: number): void; // atS: on the AudioContext clock; omitted, now
  voices(): number;
  drumHits(): number; // channel-10 hits made so far (tests)
}

// audio() is null until the AudioContext exists; then notes sound at atS (or now).
export function createSynth(audio: () => Audio | null): Synth {
  const voices: Voice[] = [];
  const pedal = new Array<boolean>(16).fill(false);
  let hits = 0;
  const now = (atS?: number) => atS ?? audio()?.ctx.currentTime ?? 0;
  const end = (v: Voice, atS?: number) => {
    voices.splice(voices.indexOf(v), 1);
    v.stop(now(atS));
  };

  const noteOn = (ch: number, pitch: number, velocity: number, atS?: number) => {
    if (ch === 9) {
      if (!DRUMS.includes(pitch)) return; // other drum notes are silent
      hits++;
      const a = audio();
      if (a) drum(a, pitch, velocity, now(atS));
      return;
    }
    const again = voices.find((v) => v.ch === ch && v.pitch === pitch);
    if (again) end(again, atS); // a re-struck key starts over
    if (voices.length >= synthSettings.maxVoices) end(voices[0], atS); // steal the oldest
    const a = audio();
    voices.push({ ch, pitch, held: true, stop: a ? strike(a, pitch, velocity, now(atS)) : () => {} });
  };
  const noteOff = (ch: number, pitch: number, atS?: number) => {
    const v = voices.find((x) => x.ch === ch && x.pitch === pitch && x.held);
    if (!v) return;
    if (pedal[ch]) v.held = false; // the pedal keeps it sounding
    else end(v, atS);
  };

  return {
    message(bytes, atS) {
      const [status, d1 = 0, d2 = 0] = Array.from(bytes);
      const ch = status & 0x0f;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && d2 > 0) noteOn(ch, d1, d2, atS);
      else if (cmd === 0x80 || cmd === 0x90) noteOff(ch, d1, atS); // velocity 0 is a release, as the DGX sends
      else if (cmd === 0xb0 && d1 === 64) {
        pedal[ch] = d2 >= 64;
        if (!pedal[ch]) voices.filter((v) => v.ch === ch && !v.held).forEach((v) => end(v, atS)); // lifting ends them
      } else if (cmd === 0xb0 && d1 === 123) voices.filter((v) => v.ch === ch).forEach((v) => end(v, atS));
      // Program changes and everything else: accepted, ignored (every channel plays the piano voice in v1).
    },
    voices: () => voices.length,
    drumHits: () => hits,
  };
}
