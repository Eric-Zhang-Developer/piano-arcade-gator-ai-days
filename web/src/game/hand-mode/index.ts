// Hand mode (spec: hand-mode): play one hand while the piano plays the other. transformChart drops the other hand
// from the chart that's drawn and judged; this plugin plays it on the DGX (MIDI channel 1), or as a quiet laptop tone
// without one. Timing follows beat-track: a short lookahead queue on performance.now(), set at songStart and resume.
import { createElement } from "react";
import type { Chart, ChartNote, GamePlugin, InputDevice } from "../../contracts";
import { HandPicker } from "./HandPicker";
import { ALL_NOTES_OFF_CH1, echoGuard, handModeSettings, handsSetting, playbackBetween, splitHands, type HandsSetting, type Playback } from "./hands";

export { echoGuard, handsSetting, playbackBetween, splitHands } from "./hands";

const LOOKAHEAD_MS = 300; // as beat-track: stopping leaves at most this much queued
const midiHz = (p: number) => 440 * 2 ** ((p - 69) / 12);

export function handMode(): GamePlugin {
  let hands: HandsSetting = "both";
  let chart: Chart | null = null; // the full chart, for playback timing
  let playback: ChartNote[] = [];
  let twoHands = false;
  let output: MIDIOutput | null = null;
  let audio: AudioContext | null = null;
  let bus: GainNode | null = null; // this run's tones; disconnecting it silences tones already queued
  let zero = 0; // performance.now() at chart time 0
  let scheduledUntil = 0;
  let active = false;
  const guard = echoGuard();

  const play = (p: Playback) => {
    const on = zero + p.atMs;
    if (output) {
      output.send([0x90, p.pitch, p.velocity], on);
      output.send([0x80, p.pitch, 0], zero + p.endMs);
      guard.sent(p.pitch, on);
      return;
    }
    if (!audio || !bus) return;
    const t = Math.max(audio.currentTime, audio.currentTime + (on - performance.now()) / 1000);
    const len = Math.min(handModeSettings.toneMaxS, (p.endMs - p.atMs) / 1000);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "triangle";
    osc.frequency.value = midiHz(p.pitch);
    gain.gain.setValueAtTime(handModeSettings.toneVolume * (p.velocity / 127), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + Math.max(0.05, len));
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + Math.max(0.05, len));
  };

  const schedule = (nowMs: number) => {
    if (!active || !chart) return;
    const until = nowMs + LOOKAHEAD_MS;
    for (const p of playbackBetween(chart, playback, scheduledUntil, until)) play(p);
    scheduledUntil = until;
  };

  // songEnd, pause, quit, pagehide: nothing hangs. All Notes Off now, queued sends dropped, tones cut.
  const silence = () => {
    active = false;
    (output as (MIDIOutput & { clear?(): void }) | null)?.clear?.();
    output?.send(ALL_NOTES_OFF_CH1);
    bus?.disconnect();
    bus = null;
  };

  const begin = (atMs: number) => {
    zero = performance.now() - atMs;
    if (audio) {
      bus = audio.createGain();
      bus.connect(audio.destination);
    }
    scheduledUntil = atMs;
    active = true;
    schedule(atMs);
  };

  if (typeof window !== "undefined") window.addEventListener("pagehide", () => silence());

  return {
    id: "hand-mode",
    transformChart(c, params) {
      hands = handsSetting(params.get("hands"));
      const split = splitHands(c, hands);
      chart = c;
      playback = split.playback;
      twoHands = c.notes.some((n) => n.hand === "L") && c.notes.some((n) => n.hand === "R");
      return split.judged;
    },
    wrapInput(device): InputDevice {
      if (device.kind !== "midi") return device;
      return {
        ...device,
        start(onEvent) {
          return device.start((e) => {
            if (e.type === "on" && guard.isEcho(e.pitch, e.timeMs)) return; // the piano echoing what we sent
            onEvent(e);
          });
        },
      };
    },
    onEvent(e) {
      if (e.type === "songEnd" || e.type === "pause" || e.type === "quit") return silence();
      if (!playback.length) return;
      if (e.type === "resume") return begin(e.atMs);
      if (e.type !== "songStart") return;
      silence();
      guard.clear();
      // MIDI is asked for here, not at load: /play?midi=sim installs its fake piano after this plugin's transformChart.
      // Permission was granted at load (beat-track asks), so this resolves long before the count-in ends.
      void navigator.requestMIDIAccess?.().then(
        (access) => {
          output = [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
        },
        () => {
          output = null;
        },
      );
      try {
        audio ??= new AudioContext(); // inside Start's click, so it may play; unused when the piano answers
        void audio.resume().catch(() => {});
      } catch {
        audio = null;
      }
      begin(e.atMs);
    },
    draw(_ctx, frame) {
      schedule(frame.nowMs);
    },
    startPanel: () => (twoHands ? createElement(HandPicker, { current: hands }) : null),
  };
}
