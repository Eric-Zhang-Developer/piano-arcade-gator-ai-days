// Highlight reel's sound (spike: highlight-reel): one OfflineAudioContext render of the take's own notes through
// laptop-sound's synth, each at its warped reel time. Slow motion stretches the timing, not the pitch: a note keeps
// its voice and only its start and release move. All Notes Off at each cut; the title card adds no notes.
import type { Take } from "../../../contracts";
import { createSynth, type Audio } from "../../laptop-sound/synth";
import { pianoOutSettings } from "../../piano-out";
import { highlightSettings as S, reelMsOf, type Edl } from "./cut";
import { hashBytes } from "./draw";

export const audioSettings = { sampleRate: 48000, channels: 2, gain: 1 };

interface Message {
  atMs: number;
  data: number[];
}

// The synth's messages in reel time, in order (releases and cuts before strikes at the same time).
export function reelMessages(edl: Edl, take: Take): Message[] {
  const out: Message[] = [];
  const [slow, finish, title] = edl.segments;
  const segOf = (t: number) => (t >= finish.srcFromMs && t < finish.srcToMs ? finish : t >= slow.srcFromMs && t < slow.srcToMs ? slow : null);
  for (const e of take.events) {
    if (e.velocity <= 0) continue;
    const g = segOf(e.timeMs);
    if (!g) continue;
    out.push({ atMs: reelMsOf(edl, e.timeMs)!, data: [0x90, e.pitch, e.velocity] });
    const off = e.offTimeMs ?? e.timeMs + pianoOutSettings.heldMs;
    if (off < g.srcToMs) out.push({ atMs: reelMsOf(edl, off)!, data: [0x80, e.pitch, 0] });
  }
  for (const g of [finish, title]) out.push({ atMs: (g.fromFrame * 1000) / S.fps, data: [0xb0, 123, 0] });
  const rank = (m: Message) => ((m.data[0] & 0xf0) === 0x90 ? 1 : 0);
  return out.sort((a, b) => a.atMs - b.atMs || rank(a) - rank(b));
}

// The reel's sound, 15.0 s at 48 kHz stereo. The synth takes an AudioContext; an OfflineAudioContext has every node it
// makes (oscillators, gains, a biquad), so it's passed through a cast (decision highlight-reel-audio).
export async function renderAudio(edl: Edl, take: Take): Promise<AudioBuffer> {
  const { sampleRate, channels, gain } = audioSettings;
  const ctx = new OfflineAudioContext(channels, Math.round((S.frames / S.fps) * sampleRate), sampleRate);
  const out = ctx.createGain();
  out.gain.value = gain;
  out.connect(ctx.destination);
  const a: Audio = { ctx: ctx as unknown as AudioContext, out };
  const synth = createSynth(() => a);
  for (const m of reelMessages(edl, take)) synth.message(m.data, m.atMs / 1000);
  return ctx.startRendering();
}

export const audioHash = (b: AudioBuffer) =>
  Array.from({ length: b.numberOfChannels }, (_, c) => hashBytes(new Uint8Array(b.getChannelData(c).buffer))).join("-");
