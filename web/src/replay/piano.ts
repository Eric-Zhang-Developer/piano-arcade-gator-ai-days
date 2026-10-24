// The replay's voice: each step's note on the DGX ("Portable Grand") when Chrome can reach it, else a short Web Audio
// tone. Written here on purpose (the spec says not to touch beat-track's files).
export const PIANO_NAME = "Portable Grand";
const VELOCITY = 80;

export function pickOutput(access: Pick<MIDIAccess, "outputs"> | null): MIDIOutput | null {
  for (const o of access?.outputs.values() ?? []) if (o.name?.includes(PIANO_NAME)) return o;
  return null;
}

export type Voice = { note(pitch: number, ms: number): void; stop(): void; kind: "piano" | "tone" };

export function pianoVoice(out: Pick<MIDIOutput, "send">): Voice {
  return {
    kind: "piano",
    note(pitch, ms) {
      const now = performance.now();
      out.send([0x90, pitch, VELOCITY], now);
      out.send([0x80, pitch, 0], now + ms);
    },
    // All Notes Off (CC 123) on all 16 channels, so a pause never leaves a key sounding.
    stop() {
      for (let ch = 0; ch < 16; ch++) out.send([0xb0 | ch, 123, 0]);
    },
  };
}

// Browser fallback: a percussive fundamental with faster-decaying upper partials.
// Synthesized piano-like audio, not sampled piano. It never sends MIDI or changes a device voice.
export function pianoTone(ctx: AudioContext, pitch: number, ms: number, at = ctx.currentTime, destination: AudioNode = ctx.destination, velocity = 80, ended = () => {}): () => void {
  const duration = Math.max(.08, ms / 1000);
  const voices: OscillatorNode[] = [];
  let finished = false;
  for (const [harmonic, weight] of [[1, .5], [2, .16], [3, .06]]) {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440 * 2 ** ((pitch - 69) / 12) * harmonic;
    const peak = Math.max(.001, weight * velocity / 127);
    const end = at + Math.min(duration, harmonic === 1 ? 3 : 1.2 / harmonic);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(peak, at + .004);
    gain.gain.exponentialRampToValueAtTime(peak * .18, at + Math.min(.3 / harmonic, (end - at) * .65));
    gain.gain.exponentialRampToValueAtTime(.0001, end);
    osc.connect(gain).connect(destination); osc.start(at); osc.stop(end + .015);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); if (harmonic === 1 && !finished) { finished = true; ended(); } };
    voices.push(osc);
  }
  return () => { for (const osc of voices) { try { osc.stop(); } catch { /* Already ended. */ } } };
}

export function toneVoice(ctx: AudioContext): Voice {
  const live = new Set<() => void>();
  return {
    kind: "tone",
    note(pitch, ms) {
      const stop = pianoTone(ctx, pitch, ms, ctx.currentTime, ctx.destination, 80, () => live.delete(stop));
      live.add(stop);
    },
    stop() { live.forEach(stop => stop()); live.clear(); },
  };
}
