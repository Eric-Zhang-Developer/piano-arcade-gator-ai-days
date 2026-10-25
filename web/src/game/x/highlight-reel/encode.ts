// Highlight reel's encode (spike: highlight-reel): the drawn frames and the rendered sound into one WebM through
// MediaRecorder. The encode runs in real time: the sound plays through a real AudioContext into the recorder, and
// frame n is drawn and requested when that clock reaches n / fps. A frame drawn more than a frame late is counted.
import { highlightSettings as S } from "./cut";

export const encodeSettings = {
  // VP8 first: in the first local run VP9 kept 662 of 900 frames at 1080p60 (FINDINGS.md)
  mimeTypes: ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"],
  videoBitsPerSecond: 12_000_000,
  leadS: 0.02, // the sound and frame 0 start this long after the recorder (its own start-up)
  tailS: 1 / 60, // and the recorder stops one frame after the last frame is due
  // ponytail: one measured constant, not a per-machine calibration. The sound reaches the recorder this much later
  // than a requested frame (the first local run: 65–72 ms over all 11 onsets, FINDINGS.md), so each frame is
  // requested this much later on the audio clock. If another machine measures differently, calibrate per run from
  // the first onset.
  avLatencyMs: 66,
};

export interface Encoded {
  blob: Blob;
  mimeType: string;
  framesRequested: number;
  framesLate: number;
  drawMs: { median: number; p95: number }; // drawFrame's own time per frame
}

type CaptureTrack = MediaStreamTrack & { requestFrame(): void };

// A tick that keeps running in a background tab (rAF and timers throttle there; a MessageChannel post doesn't).
const tick = () => new Promise<void>((r) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => r();
  ch.port2.postMessage(0);
});

export async function encode(
  canvas: HTMLCanvasElement,
  sound: AudioBuffer,
  drawFrame: (n: number) => void,
  onProgress: (frame: number) => void,
): Promise<Encoded> {
  const mimeType = encodeSettings.mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const ac = new AudioContext({ sampleRate: sound.sampleRate });
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const src = ac.createBufferSource();
  src.buffer = sound;
  src.connect(dest);
  const video = canvas.captureStream(0).getVideoTracks()[0] as CaptureTrack;
  const rec = new MediaRecorder(new MediaStream([video, ...dest.stream.getAudioTracks()]), {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: encodeSettings.videoBitsPerSecond,
  });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  drawFrame(0);
  rec.start();
  const t0 = ac.currentTime + encodeSettings.leadS;
  src.start(t0);
  let n = 0;
  let late = 0;
  const drawn: number[] = [];
  while (n < S.frames) {
    const due = (ac.currentTime - t0 - encodeSettings.avLatencyMs / 1000) * S.fps;
    if (due >= n) {
      if (due - n > 1) late++;
      const t = performance.now();
      drawFrame(n);
      drawn.push(performance.now() - t);
      video.requestFrame();
      onProgress(n);
      n++;
    } else await tick();
  }
  while (ac.currentTime < t0 + encodeSettings.avLatencyMs / 1000 + S.frames / S.fps + encodeSettings.tailS) await tick();
  rec.stop();
  await stopped;
  video.stop();
  await ac.close();
  drawn.sort((a, b) => a - b);
  const q = (p: number) => drawn[Math.min(drawn.length - 1, Math.floor(p * (drawn.length - 1)))];
  return { blob: new Blob(chunks, { type: mimeType || "video/webm" }), mimeType: rec.mimeType || mimeType, framesRequested: n, framesLate: late, drawMs: { median: q(0.5), p95: q(0.95) } };
}
