// Audio track (spec: audio-track): a local song's own recording plays under /play, in sync with the chart clock, the
// player's piano on top. The recording comes from a sidecar next to the chart, songs/local/<id>/audio.json:
// { "src": "golden.mp3", "offsetMs": 1234 }, where offsetMs is the file time of chart time 0. No sidecar, no audio.
import type { Chart, GameEvent, GamePlugin } from "../../contracts";
import { msPerBeat } from "../core/settings";
import { loopChart } from "../bar-loop";
import { isWaitMode } from "../wait-mode";
import { isFlowMode } from "../flow-mode/clock";
import { savedNumber } from "../laptop-sound/volume";

export const audioTrackSettings = {
  fadeOutS: 0.25, // after songEnd: a short fade, then silence
  watchMs: 250, // how often a playing take checks it's still on /play (leaving by the back button sends no event)
};

export interface Sidecar {
  src: string; // relative to the song's folder
  offsetMs: number; // file time of chart time 0 (the first downbeat)
}

// A bar loop's window (bar-loop): pass k's notes start at chart time k * passMs, after a one-bar gap.
export interface LoopWindow {
  startMs: number; // song time of the window's first bar
  passMs: number; // one pass plus its gap bar
  barMs: number;
  passes: number;
}

// A sidecar is an object with a non-empty src and a finite offsetMs; anything else is no audio.
export const parseSidecar = (raw: unknown): Sidecar | null => {
  const o = raw as Partial<Sidecar> | null;
  return o && typeof o.src === "string" && o.src && Number.isFinite(o.offsetMs) ? { src: o.src, offsetMs: o.offsetMs! } : null;
};

// The bar loop's window in song time, or null for the whole song (no loop, or Speed alone).
export function loopWindow(chart: Chart, params: URLSearchParams): LoopWindow | null {
  let r: ReturnType<typeof loopChart> = null;
  try {
    r = loopChart(chart, params);
  } catch {
    return null; // bar-loop shows the bad request as /play's error
  }
  if (!r || r.plan.whole) return null;
  const mpb = msPerBeat(chart.bpm);
  return { startMs: (r.plan.from - 1) * chart.beatsPerBar * mpb, passMs: r.plan.passBeats * mpb, barMs: chart.beatsPerBar * mpb, passes: r.plan.passes };
}

// Which pass a chart time belongs to: each pass owns its gap bar before it, the first owns the count-in.
const passAt = (chartMs: number, w: LoopWindow) => Math.min(w.passes - 1, Math.max(0, Math.floor((chartMs + w.barMs) / w.passMs)));

// File time of a chart time. In a loop, each pass restarts at the window's start, its gap bar playing the bar before.
export function fileTimeAt(chartMs: number, offsetMs: number, w: LoopWindow | null = null): number {
  if (!w) return offsetMs + chartMs;
  return offsetMs + w.startMs + chartMs - passAt(chartMs, w) * w.passMs;
}

// The stretches to play from chart time fromMs on: one for the whole song, or one per pass left in a loop. end is the
// chart time it stops (Infinity: the file's end).
export interface Segment {
  atMs: number;
  fileMs: number;
  endMs: number;
}
export function segmentsFrom(fromMs: number, offsetMs: number, w: LoopWindow | null = null): Segment[] {
  if (!w) return [{ atMs: fromMs, fileMs: fileTimeAt(fromMs, offsetMs), endMs: Infinity }];
  const segs: Segment[] = [];
  const first = passAt(fromMs, w);
  for (let k = first; k < w.passes; k++) {
    const atMs = k === first ? fromMs : k * w.passMs - w.barMs; // the first runs from now, count-in included
    segs.push({ atMs, fileMs: fileTimeAt(atMs, offsetMs, w), endMs: (k + 1) * w.passMs - w.barMs });
  }
  return segs;
}

// Why a take plays no recording, or null when it plays one. The record can't bend, so anything that moves the chart
// clock off the record's own tempo is out.
export function skipReason(params: URLSearchParams): string | null {
  if (params.get("audio") === "off") return "?audio=off";
  if (params.has("tempo") && params.get("tempo") !== "100") return `tempo ${params.get("tempo")}% (the record can't bend)`;
  if (isWaitMode(params)) return "wait mode (the clock holds at each note; the record can't)";
  if (isFlowMode(params)) return "flow mode (the clock follows the player; the record can't)";
  return null;
}

// "Recording volume", 0–1: the recording's own level, apart from the effects mute and the piano volume. Each take
// reads it at its start.
export const DEFAULT_RECORDING_VOLUME = 0.7;
const volume = savedNumber("pianoArcade.recordingVolume", DEFAULT_RECORDING_VOLUME, 0, 1);
export const { get: getRecordingVolume, set: setRecordingVolume, subscribe: subscribeRecordingVolume } = volume;

// "Recording offset", ± ms (golden-demo, part 6): moves the recording against the chart, for a sidecar's offsetMs that
// is a little off on this machine. File time = offsetMs + recording offset + chart time; positive plays it earlier.
// Read at each start and resume.
export const RECORDING_OFFSET_MIN = -300;
export const RECORDING_OFFSET_MAX = 300;
const offset = savedNumber("pianoArcade.recordingOffsetMs", 0, RECORDING_OFFSET_MIN, RECORDING_OFFSET_MAX);
export const { get: getRecordingOffset, set: setRecordingOffset, subscribe: subscribeRecordingOffset } = offset;

interface Scheduled {
  node: AudioBufferSourceNode;
  whenS: number; // context time the node starts
  offsetS: number; // file time it starts at
  endS: number; // context time it stops
}

declare global {
  interface Window {
    __pianoArcadeAudio?: {
      loaded: boolean;
      playing: boolean;
      chartMs(): number | null;
      fileTimeAt(chartMs: number): number;
      positionMs(): number | null;
    };
  }
}

export function audioTrack(): GamePlugin {
  let audio: AudioContext | null = null;
  let buffer: AudioBuffer | null = null;
  let sidecar: Sidecar | null = null;
  let loop: LoopWindow | null = null;
  let bus: GainNode | null = null; // this run's sources; disconnecting it silences them at once
  let scheduled: Scheduled[] = [];
  let anchor: { perf: number; atMs: number } | null = null; // the chart clock while it runs; null while paused or done
  let watch = 0;
  let load = 0; // StrictMode loads twice: only the latest load may set the buffer

  // Context time for a performance time, with a matched pair of readings (beat-track's mapping).
  const ctxAt = (perf: number) => {
    const stamp = audio!.getOutputTimestamp?.();
    const [ctxT, perfT] = stamp?.performanceTime ? [stamp.contextTime ?? 0, stamp.performanceTime] : [audio!.currentTime, performance.now()];
    return ctxT + (perf - perfT) / 1000;
  };
  const latencyS = () => audio?.outputLatency || audio?.baseLatency || 0;

  const silence = () => {
    anchor = null;
    clearInterval(watch);
    bus?.disconnect();
    bus = null;
    scheduled = [];
  };

  // Play from chart time atMs, which sounds now: songStart, a resume, or the buffer arriving mid-take.
  // The file time of chart time 0: the sidecar's, moved by the player's Recording offset.
  const fileOffset = () => (sidecar?.offsetMs ?? 0) + getRecordingOffset();
  const play = (atMs: number) => {
    anchor = { perf: performance.now(), atMs };
    if (!audio || !buffer || !sidecar) return;
    bus?.disconnect();
    bus = audio.createGain();
    bus.gain.value = getRecordingVolume();
    bus.connect(audio.destination);
    scheduled = [];
    const nowS = audio.currentTime;
    for (const seg of segmentsFrom(atMs, fileOffset(), loop)) {
      // Heard at the segment's chart time: started one output latency early.
      let whenS = ctxAt(anchor.perf + seg.atMs - atMs) - latencyS();
      let offsetS = seg.fileMs / 1000;
      const endS = seg.endMs === Infinity ? Infinity : whenS + (seg.endMs - seg.atMs) / 1000;
      if (offsetS < 0) [whenS, offsetS] = [whenS - offsetS, 0]; // before the file's start: silence, then the file
      if (whenS < nowS) [offsetS, whenS] = [offsetS + nowS - whenS, nowS]; // already due: join it where it is
      if (offsetS >= buffer.duration || endS <= whenS) continue;
      const node = audio.createBufferSource();
      node.buffer = buffer;
      node.connect(bus);
      node.start(whenS, offsetS);
      if (endS !== Infinity) node.stop(endS);
      scheduled.push({ node, whenS, offsetS, endS: Math.min(endS, whenS + buffer.duration - offsetS) });
    }
    clearInterval(watch);
    watch = window.setInterval(() => {
      if (window.location.pathname !== "/play") silence(); // left /play without a quit (back button, a link)
    }, audioTrackSettings.watchMs);
  };

  // A demo (bot=…&demo=1) never clicks Start, so Chrome keeps a new context suspended: the first press or click
  // anywhere resumes it. Anything play() scheduled while it was suspended was mapped on a stopped clock, so once it
  // runs the recording restarts at the chart's time now.
  const wakeable = (ctx: AudioContext) => {
    const wake = () => void ctx.resume().catch(() => {});
    for (const type of ["pointerdown", "keydown"]) window.addEventListener(type, wake, { once: true, capture: true });
    ctx.onstatechange = () => {
      if (ctx.state === "running" && anchor) play(anchor.atMs + performance.now() - anchor.perf);
    };
    return ctx;
  };

  const sounding = () => {
    if (!audio || !bus) return null;
    const t = audio.currentTime;
    return scheduled.find((s) => s.whenS <= t && t < s.endS) ?? null;
  };

  return {
    id: "audio-track",
    transformChart(c, params) {
      silence();
      buffer = null;
      sidecar = null;
      loop = null;
      const song = params.get("song") ?? "";
      if (!song.startsWith("local/")) return c; // recordings are local-only (decision 003, amended for local play)
      const why = skipReason(params);
      if (why) {
        console.info(`audio-track: no recording for this take: ${why}`);
        return c;
      }
      loop = loopWindow(c, params);
      const token = ++load;
      const dir = `/songs/${song}/`;
      try {
        audio ??= wakeable(new AudioContext());
      } catch {
        return c; // no Web Audio: the take plays without the recording
      }
      fetch(`${dir}audio.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then(async (raw) => {
          const s = parseSidecar(raw);
          if (!s || token !== load) return;
          const bytes = await fetch(new URL(s.src, new URL(dir, window.location.origin))).then((r) => {
            if (!r.ok) throw new Error(`${s.src}: ${r.status}`);
            return r.arrayBuffer();
          });
          const decoded = await audio!.decodeAudioData(bytes);
          if (token !== load) return;
          [sidecar, buffer] = [s, decoded];
          if (anchor) play(anchor.atMs + performance.now() - anchor.perf); // arrived mid-take: join at the clock's time
        })
        .catch((e: Error) => console.warn(`audio-track: no recording: ${e.message}`));
      // The test hook, on every local take with a recording, not only ?input=test: that mode can't pause (Esc is off),
      // and verify-audio has to pause, resume and quit the way a player does.
      window.__pianoArcadeAudio = {
        get loaded() {
          return buffer !== null;
        },
        get playing() {
          return sounding() !== null;
        },
        // The chart time now, from the clock this plugin follows; null while paused or before the take.
        chartMs: () => (anchor ? anchor.atMs + performance.now() - anchor.perf : null),
        fileTimeAt: (chartMs) => fileTimeAt(chartMs, fileOffset(), loop),
        // The file time being heard now, or null when nothing sounds.
        positionMs: () => {
          const s = sounding();
          return s ? (s.offsetS + ctxAt(performance.now()) - latencyS() - s.whenS) * 1000 : null;
        },
      };
      return c;
    },
    onEvent(e: GameEvent) {
      if (e.type === "pause" || e.type === "quit") return silence();
      if (e.type === "songEnd") {
        anchor = null;
        clearInterval(watch);
        const b = bus;
        if (b && audio) {
          b.gain.setTargetAtTime(0, audio.currentTime, audioTrackSettings.fadeOutS / 3);
          setTimeout(() => b.disconnect(), audioTrackSettings.fadeOutS * 1000 + 50);
        }
        bus = null;
        scheduled = [];
        return;
      }
      if (e.type === "songStart") {
        if (!audio) return; // not a local song with a recording
        void audio.resume().catch(() => {}); // Start is a click: the context may run from here
        play(e.atMs);
      }
      if (e.type === "resume") play(e.atMs);
    },
  };
}
