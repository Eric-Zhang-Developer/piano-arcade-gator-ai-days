// Song preview's opening: the chart's first 5 s, and the players that sound them (spec: song-preview).
import type { Chart } from "../../contracts";
import { msPerBeat } from "../core/settings";

export const previewSettings = {
  delayMs: 400, // a row must stay highlighted this long before its preview starts
  lengthMs: 5000, // every song's preview, from its first note (Eric: "maybe 5 seconds")
  lookaheadMs: 60, // the piano gets each note this far ahead, never the whole opening (see playOnPiano)
  tickMs: 20,
  velocity: 80, // when the chart has none
  toneVolume: 0.08, // laptop tones, 0–1: quiet
};

export interface PreviewNote {
  pitch: number;
  startMs: number; // from the first note
  durMs: number;
  velocity: number;
}

// The notes that start in the first 5 s, at the chart's own tempo, held notes cut at 5 s. Time starts at the first
// note, so a chart that opens on rests doesn't preview as silence (specs/decisions/song-preview-start.md).
export function opening(chart: Chart): PreviewNote[] {
  if (!chart.notes.length) return [];
  const { lengthMs, velocity } = previewSettings;
  const mpb = msPerBeat(chart.bpm);
  const zero = Math.min(...chart.notes.map((n) => n.beat)) * mpb;
  return chart.notes
    .map((n) => ({ pitch: n.pitch, startMs: n.beat * mpb - zero, durMs: n.duration * mpb, velocity: n.velocity ?? velocity }))
    .filter((n) => n.startMs < lengthMs)
    .map((n) => ({ ...n, durMs: Math.min(n.durMs, lengthMs - n.startMs) }))
    .sort((a, b) => a.startMs - b.startMs);
}

export const lastBar = (chart: Chart) => Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar);

export const practiceUrl = (id: string, chart: Chart) => `/play?song=${id}&from=1&to=${lastBar(chart)}&tempo=70&passes=1`;

export const openingMs = (notes: PreviewNote[]) => Math.max(0, ...notes.map((n) => n.startMs + n.durMs));

type Out = Pick<MIDIOutput, "send"> & { clear?(): void };

// On the piano, channel 1. A timestamped message can't be taken back (Chrome has no MIDIOutput.clear()), so a timer
// hands the output only the notes due within lookaheadMs, never the whole opening: queuing it all at once is why
// previews kept playing over each other on the DGX. stop() ends the timer, lifts every key it pressed, after its
// note-on so none sticks, and sends All Notes Off.
export function playOnPiano(out: Out, notes: PreviewNote[]): () => void {
  const { lookaheadMs, tickMs } = previewSettings;
  const at = performance.now();
  const pressed: { pitch: number; onAt: number }[] = [];
  let next = 0;
  const tick = () => {
    for (; next < notes.length && at + notes[next].startMs <= performance.now() + lookaheadMs; next++) {
      const n = notes[next];
      const onAt = at + n.startMs;
      out.send([0x90, n.pitch, n.velocity], onAt);
      out.send([0x80, n.pitch, 0], onAt + n.durMs);
      pressed.push({ pitch: n.pitch, onAt });
    }
  };
  tick();
  const timer = setInterval(() => {
    tick();
    if (next >= notes.length) clearInterval(timer);
  }, tickMs);
  return () => {
    clearInterval(timer);
    out.clear?.();
    const t = Math.max(performance.now(), ...pressed.map((p) => p.onAt)) + 1;
    for (const p of pressed) out.send([0x80, p.pitch, 0], t);
    out.send([0xb0, 123, 0], t);
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
