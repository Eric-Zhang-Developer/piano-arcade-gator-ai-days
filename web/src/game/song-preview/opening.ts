// Song preview's opening: the chart's first two bars, and the players that sound them (spec: song-preview).
import type { Chart } from "../../contracts";
import { msPerBeat } from "../core/settings";

export const previewSettings = {
  delayMs: 400, // a row must stay highlighted this long before its preview starts
  bars: 2,
  maxMs: 8000,
  velocity: 80, // when the chart has none
  toneVolume: 0.08, // laptop tones, 0–1: quiet
};

export interface PreviewNote {
  pitch: number;
  startMs: number; // from the first note
  durMs: number;
  velocity: number;
}

// The notes that start in bars 1–2, at the chart's own tempo, cut at 8 s. Time starts at the first note, so a chart
// that opens on rests doesn't preview as silence (specs/decisions/song-preview-start.md).
export function opening(chart: Chart): PreviewNote[] {
  const mpb = msPerBeat(chart.bpm);
  const inBars = chart.notes.filter((n) => n.beat < previewSettings.bars * chart.beatsPerBar);
  if (!inBars.length) return [];
  const zero = Math.min(...inBars.map((n) => n.beat)) * mpb;
  return inBars
    .map((n) => ({ pitch: n.pitch, startMs: n.beat * mpb - zero, durMs: n.duration * mpb, velocity: n.velocity ?? previewSettings.velocity }))
    .filter((n) => n.startMs < previewSettings.maxMs)
    .map((n) => ({ ...n, durMs: Math.min(n.durMs, previewSettings.maxMs - n.startMs) }))
    .sort((a, b) => a.startMs - b.startMs);
}

export const lastBar = (chart: Chart) => Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar);

export const practiceUrl = (id: string, chart: Chart) => `/play?song=${id}&from=1&to=${lastBar(chart)}&tempo=70&passes=1`;

export const openingMs = (notes: PreviewNote[]) => Math.max(0, ...notes.map((n) => n.startMs + n.durMs));

type Out = Pick<MIDIOutput, "send"> & { clear?(): void };

// On the piano, channel 1, queued with timestamps. stop() drops the queue (where Chrome has clear()) and sends All
// Notes Off, so nothing hangs.
export function playOnPiano(out: Out, notes: PreviewNote[], at = performance.now()): () => void {
  for (const n of notes) {
    out.send([0x90, n.pitch, n.velocity], at + n.startMs);
    out.send([0x80, n.pitch, 0], at + n.startMs + n.durMs);
  }
  return () => {
    out.clear?.();
    out.send([0xb0, 123, 0]);
  };
}

// Quiet Web Audio tones on their own bus; stop() disconnects the bus, so queued tones are never heard.
export function playAsTones(ctx: AudioContext, notes: PreviewNote[]): () => void {
  const bus = ctx.createGain();
  bus.gain.value = previewSettings.toneVolume;
  bus.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.02;
  for (const n of notes) {
    const t = t0 + n.startMs / 1000;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 440 * 2 ** ((n.pitch - 69) / 12);
    env.gain.setValueAtTime(n.velocity / 127, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.05, n.durMs / 1000));
    osc.connect(env).connect(bus);
    osc.start(t);
    osc.stop(t + Math.max(0.05, n.durMs / 1000));
  }
  return () => bus.disconnect();
}
