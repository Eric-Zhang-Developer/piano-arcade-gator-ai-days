// Highlight reel's encode (spike: highlight-reel): the drawn frames and the rendered sound into one WebM through
// MediaRecorder. The encode runs in real time: the sound plays through a real AudioContext into the recorder, and
// frame n is drawn and requested when that clock reaches n / fps. A frame drawn more than a frame late is counted.
import { highlightSettings as S } from "./cut";

export const encodeSettings = {
  mimeTypes: ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"],
  videoBitsPerSecond: 12_000_000,
  leadS: 0.02, // the sound and frame 0 start this long after the recorder (its own start-up)
  tailS: 1 / 60, // and the recorder stops one frame after the last frame is due
};

export interface Encoded {
  blob: Blob;
  mimeType: string;
  framesRequested: number;
  framesLate: number;
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
  while (n < S.frames) {
    const due = (ac.currentTime - t0) * S.fps;
    if (due >= n) {
      if (due - n > 1) late++;
      drawFrame(n);
      video.requestFrame();
      onProgress(n);
      n++;
    } else await tick();
  }
  while (ac.currentTime < t0 + S.frames / S.fps + encodeSettings.tailS) await tick();
  rec.stop();
  await stopped;
  video.stop();
  await ac.close();
  return { blob: new Blob(chunks, { type: mimeType || "video/webm" }), mimeType: rec.mimeType || mimeType, framesRequested: n, framesLate: late };
}
