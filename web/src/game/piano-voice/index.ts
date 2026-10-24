// Piano voice (spec: piano-voice): a chart's General MIDI voice on the DGX for the take, then back to a fixed one.
// Program Change on channel 1 only; beat-track's drums on channel 10 are untouched. MIDI can't read the piano's
// current voice, so the game restores pianoVoiceSettings.restoreVoice.
import type { Chart, GamePlugin } from "../../contracts";
import { getReplayState, subscribeReplay } from "../piano-out";

export const pianoVoiceSettings = {
  restoreVoice: 1, // Acoustic Grand Piano
};

export const programChange = (voice: number): number[] => [0xc0, voice - 1];

// ?voice=off sends nothing; ?voice=<1–128> overrides the chart's; otherwise the chart's, if it names one.
export function voiceFor(chart: Chart, param: string | null): number | null {
  if (param === "off") return null;
  const v = Number(param);
  if (param !== null && Number.isInteger(v) && v >= 1 && v <= 128) return v;
  return chart.voice ?? null;
}

export function pianoVoice(): GamePlugin {
  let voice: number | null = null;
  let output: MIDIOutput | null = null;
  let changed = false; // the piano is on our voice and needs restoring
  let inTake = false;

  const send = (v: number) => {
    output?.send(programChange(v));
    changed = v !== pianoVoiceSettings.restoreVoice;
  };
  const restore = () => {
    if (!changed) return;
    output?.send(programChange(pianoVoiceSettings.restoreVoice));
    changed = false;
  };
  // After the take: restore now, unless piano-out is replaying it (the replay keeps the chart's voice until it stops).
  const end = () => {
    inTake = false;
    if (!getReplayState().playing) restore();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => restore());
    // A replay of the take sounds in the take's voice; its end puts the piano back.
    let wasPlaying = false;
    subscribeReplay(() => {
      const playing = getReplayState().playing;
      if (playing && !wasPlaying && voice !== null) send(voice);
      if (!playing && wasPlaying && !inTake) restore();
      wasPlaying = playing;
    });
  }

  return {
    id: "piano-voice",
    transformChart(c, params) {
      voice = voiceFor(c, params.get("voice"));
      if (voice !== null && typeof navigator !== "undefined" && navigator.requestMIDIAccess) {
        navigator
          .requestMIDIAccess()
          .then((access) => {
            output = [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
          })
          .catch(() => {
            output = null; // no piano: no message, no error
          });
      }
      return c;
    },
    onEvent(e) {
      if (e.type === "songStart") {
        inTake = true;
        if (voice !== null) send(voice);
      }
      if (e.type === "songEnd" || e.type === "quit") end();
    },
  };
}
