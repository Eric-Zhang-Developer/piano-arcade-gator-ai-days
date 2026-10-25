// Conductor's hand tracking (spike: conductor): MediaPipe's Hand Landmarker, loaded at run time from a pinned CDN URL
// so nothing lands in package.json (decisions/conductor-dependency). Frames stay in the browser; nothing is stored.
export const trackerSettings = {
  version: "1.1.1",
  model: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};
const base = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${trackerSettings.version}`;

export interface Point {
  x: number;
  y: number;
}
interface Landmarker {
  detectForVideo(video: HTMLVideoElement, ms: number): { landmarks: Point[][] };
  close(): void;
}

let loading: Promise<Landmarker> | null = null;

// One landmarker per page. The import is left to the browser: the bundler is told not to resolve the URL.
export function loadLandmarker(): Promise<Landmarker> {
  loading ??= (async () => {
    const vision = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${base}/vision_bundle.mjs`);
    const fileset = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
    return vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: trackerSettings.model, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 1,
    }) as Promise<Landmarker>;
  })();
  loading.catch(() => (loading = null)); // a failed load can be retried
  return loading;
}

export interface Frame {
  ms: number; // performance.now() time of the frame
  mediaMs: number; // the video's own time (clip mode's labels are in it)
  landmarks: Point[] | null; // one hand, image coordinates 0..1, or null
}

// Runs the landmarker on every video frame, timed by requestVideoFrameCallback; returns a stop function.
export function trackVideo(video: HTMLVideoElement, lm: Landmarker, onFrame: (f: Frame) => void): () => void {
  let on = true;
  let id = 0;
  let lastMedia = -1;
  const tick: VideoFrameRequestCallback = (now, meta) => {
    if (!on) return;
    const ms = meta.captureTime ?? meta.expectedDisplayTime ?? now;
    const mediaMs = meta.mediaTime * 1000;
    if (mediaMs !== lastMedia) {
      lastMedia = mediaMs;
      const r = lm.detectForVideo(video, ms);
      onFrame({ ms, mediaMs, landmarks: r.landmarks[0] ?? null });
    }
    id = video.requestVideoFrameCallback(tick);
  };
  id = video.requestVideoFrameCallback(tick);
  return () => {
    on = false;
    video.cancelVideoFrameCallback(id);
  };
}

// The wrist's height and the hand's size (wrist to the middle finger's knuckle), for the beat detector.
export const sampleOf = (lm: Point[], ms: number) => ({ t: ms, y: lm[0].y, size: Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y) });
