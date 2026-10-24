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

export function toneVoice(ctx: AudioContext): Voice {
  const live = new Set<OscillatorNode>();
  return {
    kind: "tone",
    note(pitch, ms) {
      const t = ctx.currentTime;
      const end = t + Math.min(ms, 900) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => live.delete(osc);
      live.add(osc);
      osc.start(t);
      osc.stop(end + 0.05);
    },
    stop() {
      live.forEach((o) => o.stop());
      live.clear();
    },
  };
}
