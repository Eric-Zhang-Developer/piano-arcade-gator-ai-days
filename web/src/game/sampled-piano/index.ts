// Sampled piano (spec: sampled-piano): the laptop's "Portable Grand" plays real piano samples (the Salamander Grand
// Piano, CC BY 3.0) instead of laptop-sound's oscillators. A small subset lives in web/public/samples/piano/ with a
// manifest; each pitch plays its layer's nearest sample, pitch-shifted with playbackRate. Plain fetch and
// decodeAudioData, no dependency. Until every sample has decoded, or if any fails, laptop-sound keeps its synth voice.
import type { Audio } from "../laptop-sound/synth";

export const sampledSettings = {
  base: "/samples/piano/",
  gain: 0.9, // a velocity-127 note's level before the piano volume: the knob to match the synth voice's loudness
  releaseS: 0.08, // time constant of a released note's fade, as the synth voice's
};

// One manifest row: the sample's own pitch (MIDI), the velocity it was recorded at, and its file under `base`.
export interface SampleRow {
  pitch: number;
  vel: number;
  file: string;
}

export interface Bank {
  rows: SampleRow[];
  buffers: AudioBuffer[]; // rows[i]'s decoded audio
}

// The layer recorded nearest this velocity, then that layer's nearest pitch (the lower one on a tie). Pure.
export function pick(rows: SampleRow[], pitch: number, velocity: number): { index: number; rate: number } {
  const vel = rows.reduce((best, r) => (Math.abs(r.vel - velocity) < Math.abs(best - velocity) ? r.vel : best), rows[0].vel);
  let index = -1;
  rows.forEach((r, i) => {
    if (r.vel !== vel) return;
    const d = Math.abs(r.pitch - pitch);
    const best = index < 0 ? Infinity : Math.abs(rows[index].pitch - pitch);
    if (d < best || (d === best && r.pitch < rows[index].pitch)) index = i;
  });
  return { index, rate: 2 ** ((pitch - rows[index].pitch) / 12) };
}

// Fetches the manifest and decodes every sample. Null (and one console.warn) if anything fails: the synth stays on.
export async function loadBank(ctx: BaseAudioContext, fetcher: typeof fetch = fetch): Promise<Bank | null> {
  try {
    const res = await fetcher(`${sampledSettings.base}manifest.json`);
    if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
    const rows = (await res.json()) as SampleRow[];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("manifest: no samples");
    const buffers = await Promise.all(
      rows.map(async (r) => {
        const s = await fetcher(`${sampledSettings.base}${r.file}`);
        if (!s.ok) throw new Error(`${r.file}: HTTP ${s.status}`);
        return ctx.decodeAudioData(await s.arrayBuffer());
      }),
    );
    return { rows, buffers };
  } catch (e) {
    console.warn(`sampled-piano: keeping the synth voice (${(e as Error).message})`);
    return null;
  }
}

// One sampled note at t; returns its release, as laptop-sound's strike() does. A note left ringing ends with its sample.
export function playSample(a: Audio, bank: Bank, pitch: number, velocity: number, t: number): (atS: number) => void {
  const { ctx, out } = a;
  const { index, rate } = pick(bank.rows, pitch, velocity);
  const src = ctx.createBufferSource();
  src.buffer = bank.buffers[index];
  src.playbackRate.value = rate;
  const env = ctx.createGain();
  env.gain.value = sampledSettings.gain * (velocity / 127) ** 1.2;
  src.connect(env).connect(out);
  src.start(t);
  return (atS) => {
    const at = Math.max(atS, t);
    env.gain.cancelScheduledValues(at);
    env.gain.setTargetAtTime(0, at, sampledSettings.releaseS);
    src.stop(at + sampledSettings.releaseS * 6);
  };
}
