"use client";
// Real Keys (spec: real-keys): the camera's picture of the real keys, full bleed, with the chart's notes falling onto
// it through a 4-corner homography and sparks on the key pressed, delayed by the camera's measured latency. The same
// chart, judge and HUD as /play: a new view of a take, not a new game. Clip mode (?clip=1) runs it all on a recorded
// clip and its MIDI log instead of the camera and the piano. Frames never leave the browser.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Chart, GameEvent, InputDevice, InputEvent, Results } from "../../../contracts";
import { validateChart } from "../../../contracts";
import { Judge, noteTimeMs } from "../../core/judge";
import { keysDevice, midiDevice } from "../../core/input";
import { settings as coreSettings, msPerBeat } from "../../core/settings";
import { captureOn } from "../../capture-mode";
import { Button, MonoLabel, kitChip } from "../../duo-tokens";
import { canvasFonts } from "../../duo-tokens/canvas";
import { noteColorFor } from "../../hand-colors";
import { hitParticles, type HitParticles } from "../../hit-particles/gl";
import { hud } from "../../hud";
import { primary, wrong as wrongColor } from "../../ui-tokens";
import { apply, homography, mul, type H, type Pt } from "./homography";
import { bedQuads, BED_CORNERS, mapQuad, meanLuma, samplePoints, type Quad } from "./keys";
import { pressDelays, summarize, type Sample, type Summary } from "./latency";
import { containFit, laneDepth, noteSpan, overlaySettings, parseLog, type LoggedNote } from "./overlay";
import css from "./real-keys.module.css";

const SONG_ID = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;
const PRESSES = 8; // the latency step's presses of one key
const ANALYSIS_W = 480; // the brightness reads run on a picture this wide
const CORNER_NAMES = ["back left", "back right", "front right", "front left"];
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const noteName = (p: number) => `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`;

type Step = "source" | "corners" | "range" | "latency" | "play";
interface Calibration {
  corners: Pt[]; // in the video's own pixels, BED_CORNERS' order
  lo: number | null;
  hi: number | null;
  delayMs: number;
  latency?: Summary;
}
const EMPTY: Calibration = { corners: [], lo: null, hi: null, delayMs: 0 };
const storeKey = (device: string) => `pianoArcade.x.realKeys.${device || "default"}`;
function loadCal(device: string): Calibration {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(device)) ?? "null");
    return v && Array.isArray(v.corners) ? { ...EMPTY, ...v } : EMPTY;
  } catch {
    return EMPTY;
  }
}
function saveCal(device: string, c: Calibration) {
  try {
    localStorage.setItem(storeKey(device), JSON.stringify(c));
  } catch {
    // private window: this page only
  }
}

const download = (name: string, data: unknown) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

// One visual moment, shown when the camera's picture catches up with it.
type Visual = { at: number; kind: "down" | "up" | "hit" | "wrong"; pitch: number; judgment?: "PERFECT" | "GREAT" | "GOOD" };

export function RealKeys() {
  const params = useMemo(() => new URLSearchParams(typeof location === "undefined" ? "" : location.search), []);
  const song = params.get("song") ?? "twinkle";
  const clipMode = params.get("clip") === "1";
  const composite = params.get("composite") === "draw" ? "draw" : "video"; // the faster way is a measured choice
  const capture = typeof document !== "undefined" && captureOn();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [gave, setGave] = useState<string | null>(null); // what the camera actually gave
  const [log, setLog] = useState<LoggedNote[]>([]);
  const [clipName, setClipName] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("source");
  const [saved, setSaved] = useState<Record<string, Calibration>>({}); // this visit's edits, per camera
  const [midi, setMidi] = useState("MIDI: waiting");
  const [presses, setPresses] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [perf, setPerf] = useState<{ p95: number; frames: number } | null>(null);
  const [playing, setPlaying] = useState(false);

  // Everything the frame loop reads, in one ref: the loop never waits on React.
  const live = useRef({
    cal: EMPTY,
    step: "source" as Step,
    toPicture: null as H | null,
    bed: new Map<number, Quad>(), // each key in bed space
    quads: new Map<number, Quad>(), // each key in the picture
    samples: new Map<number, Int32Array>(), // analysis-picture pixel offsets per key
    latency: { pitch: null as number | null, presses: [] as number[], frames: [] as Sample[] },
    analysis: new Map<number, Sample[]>(), // clip mode: each logged key's luma per frame, for score.mjs
    judge: null as Judge | null,
    zero: 0, // the clock at chart time 0
    endAt: Infinity,
    hud: null as ReturnType<typeof hud> | null,
    visuals: [] as Visual[],
    down: new Map<number, number>(), // pitch → when it went down, on the picture's clock
    wrongs: new Map<number, number>(),
    frameMs: [] as number[],
    eventIndex: 0,
    logAt: 0, // clip mode: the next log entry to replay
    lastClock: 0,
  });

  // The take's clock: performance.now() live, the clip's media time in clip mode (its log is on that clock).
  const clock = useCallback(() => (clipMode ? (videoRef.current?.currentTime ?? 0) * 1000 : performance.now()), [clipMode]);

  useEffect(() => {
    (SONG_ID.test(song) ? fetch(`/songs/${song}/chart.json`) : Promise.reject(new Error(`No song called "${song}".`)))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No song called "${song}".`))))
      .then((raw) => {
        const problems = validateChart(raw);
        if (problems.length) throw new Error(problems.join("; "));
        setChart(raw as Chart);
      })
      .catch((e: Error) => setError(e.message));
  }, [song]);

  // The calibration for this camera (or the clip): this visit's, else this browser's stored one.
  const calId = clipMode ? "clip" : deviceId;
  const stored = useMemo(() => (typeof localStorage === "undefined" ? EMPTY : loadCal(calId)), [calId]);
  const cal = saved[calId] ?? stored;
  useEffect(() => {
    live.current.cal = cal;
  }, [cal]);

  const updateCal = useCallback(
    (next: Calibration) => {
      live.current.cal = next;
      setSaved((s) => ({ ...s, [calId]: next }));
      saveCal(calId, next);
    },
    [calId],
  );
  useEffect(() => {
    live.current.step = step;
  }, [step]);

  // The geometry follows the calibration: the map, each key's quad in the picture, and its analysis samples.
  useEffect(() => {
    const L = live.current;
    const v = videoRef.current;
    if (cal.corners.length !== 4 || !v?.videoWidth) {
      L.toPicture = null;
      L.bed = new Map();
      L.quads = new Map();
      return;
    }
    L.toPicture = homography(BED_CORNERS, cal.corners);
    const lo = cal.lo ?? 21, hi = cal.hi ?? 108;
    const bed = bedQuads(Math.min(lo, hi), Math.max(lo, hi));
    L.bed = bed;
    L.quads = new Map([...bed].map(([p, q]) => [p, mapQuad(L.toPicture!, q)]));
    const k = ANALYSIS_W / v.videoWidth;
    const m = mul([k, 0, 0, 0, k, 0, 0, 0, 1], L.toPicture); // the analysis picture's map: the homography, then the scale
    const ah = Math.round(v.videoHeight * k);
    L.samples = new Map([...bed].map(([p, q]) => [p, samplePoints(m, q, ANALYSIS_W, ah)]));
  }, [cal, gave, clipName]);

  // Cameras: the list, then the chosen one at 1920×1080 if it can.
  useEffect(() => {
    if (clipMode || !navigator.mediaDevices?.enumerateDevices) return;
    const list = () => navigator.mediaDevices.enumerateDevices().then((d) => setDevices(d.filter((x) => x.kind === "videoinput")));
    void list();
    navigator.mediaDevices.addEventListener?.("devicechange", list);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", list);
  }, [clipMode, stream]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setGave(null);
  }, [stream]);
  useEffect(() => {
    const end = () => stream?.getTracks().forEach((t) => t.stop());
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
    };
  }, [stream]);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        audio: false,
      });
      const v = videoRef.current!;
      v.srcObject = s;
      await v.play();
      const st = s.getVideoTracks()[0]?.getSettings();
      setGave(`${st?.width ?? v.videoWidth}×${st?.height ?? v.videoHeight} at ${Math.round(st?.frameRate ?? 0)} fps`);
      if (!deviceId && st?.deviceId) setDeviceId(st.deviceId);
      setStream(s);
      setStep((x) => (x === "source" ? "corners" : x));
    } catch (e) {
      setError(`Camera: ${(e as Error).name}`);
    }
  }, [deviceId, stopCamera]);

  const hasLog = log.length > 0;
  const openClip = useCallback((file: File | undefined) => {
    if (!file) return;
    const v = videoRef.current!;
    v.srcObject = null;
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => {
      setGave(`${v.videoWidth}×${v.videoHeight}, ${v.duration.toFixed(1)} s`);
      setClipName(file.name);
      // On to the corners once both files are in: going sooner unmounts the log's file input before it's picked.
      if (hasLog) setStep((x) => (x === "source" ? "corners" : x));
    };
  }, [hasLog]);
  const openLog = useCallback((file: File | undefined) => {
    if (!file) return;
    void file.text().then((t) => {
      try {
        setLog(parseLog(JSON.parse(t)));
        if (clipName) setStep((x) => (x === "source" ? "corners" : x));
      } catch {
        setError("notes.json: not JSON");
      }
    });
  }, [clipName]);

  // A key event, on the take's clock: setup steps read it, the judge scores it, and the overlay shows it delayed.
  const onKey = useCallback(
    (e: InputEvent) => {
      const L = live.current;
      const t = e.timeMs;
      if (e.type === "on") {
        if (L.step === "range") {
          const c = L.cal;
          if (c.lo === null || (c.lo !== null && c.hi !== null)) updateCal({ ...c, lo: e.pitch, hi: null });
          else updateCal({ ...c, hi: e.pitch });
        } else if (L.step === "latency") {
          L.latency.pitch ??= e.pitch;
          if (e.pitch === L.latency.pitch && L.latency.presses.length < PRESSES) {
            L.latency.presses.push(t);
            setPresses(L.latency.presses.length);
          }
        } else if (L.step === "play" && L.judge) L.judge.press(e.pitch, t - L.zero, L.eventIndex++);
      }
      L.visuals.push({ at: t + L.cal.delayMs, kind: e.type === "on" ? "down" : "up", pitch: e.pitch });
    },
    [updateCal],
  );

  // Live input: the piano, and the laptop keys for trying it without one.
  useEffect(() => {
    if (clipMode || !chart) return;
    const lowest = Math.min(...chart.notes.map((n) => n.pitch));
    const devs: InputDevice[] = [midiDevice(setMidi), keysDevice(lowest)];
    devs.forEach((d) => void d.start(onKey));
    return () => devs.forEach((d) => d.stop());
  }, [clipMode, chart, onKey]);

  // The latency step's answer, once its presses are in and the frames after the last one have arrived.
  const finishLatency = useCallback(() => {
    const L = live.current;
    // The frame period the picture actually had: the median gap between its frames (60 fps when there are too few).
    const f = L.latency.frames, gaps = f.slice(1).map((x, i) => x.t - f[i].t).filter((d) => d > 0).sort((a, b) => a - b);
    const frameMs = gaps.length ? gaps[gaps.length >> 1] : 1000 / 60;
    const s = summarize(pressDelays(L.latency.frames, L.latency.presses), frameMs);
    if (s) updateCal({ ...L.cal, delayMs: Math.round(s.medianMs), latency: s });
  }, [updateCal]);
  const resetLatency = () => {
    live.current.latency = { pitch: null, presses: [], frames: [] };
    setPresses(0);
  };

  const start = useCallback(() => {
    if (!chart) return;
    const L = live.current;
    const mpb = msPerBeat(chart.bpm);
    const events: GameEvent[] = [];
    const h = hud();
    h.transformChart?.(chart, params);
    L.hud = h;
    L.zero = clock() + coreSettings.countInBeats * mpb;
    L.eventIndex = 0;
    // Chart time: the last note's end, then 1.2 s of quiet before the results.
    L.endAt = Math.max(...chart.notes.map((n) => noteTimeMs(chart, n) + n.duration * mpb)) + 1200;
    L.judge = new Judge(chart, (e) => {
      events.push(e);
      h.onEvent?.(e);
      const at = e.atMs + L.zero + L.cal.delayMs;
      if (e.type === "noteHit") L.visuals.push({ at, kind: "hit", pitch: e.pitch, judgment: e.judgment });
      if (e.type === "wrongNote") L.visuals.push({ at, kind: "wrong", pitch: e.pitch });
    });
    h.onEvent?.({ type: "songStart", atMs: -coreSettings.countInBeats * mpb });
    setResults(null);
    setStep("play");
    setPlaying(true);
    if (clipMode) void videoRef.current?.play();
  }, [chart, clock, clipMode, params]);

  // The frame loop: read the picture for the latency step, replay the clip's log, judge, draw, and time the work.
  useEffect(() => {
    const v = videoRef.current, canvas = canvasRef.current, stage = stageRef.current;
    if (!v || !canvas || !stage || !chart) return;
    const ctx = canvas.getContext("2d")!;
    const small = document.createElement("canvas");
    const sctx = small.getContext("2d", { willReadFrequently: true })!;
    const color = noteColorFor(chart);
    const handOf = new Map(chart.notes.map((n) => [n.pitch, n.hand]));
    const mpb = msPerBeat(chart.bpm);
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let sparks: HitParticles | null = null;
    let raf = 0, vfc = 0, lastWall = performance.now();

    // Each new video frame: its luma per key for the latency step, on the picture's own display clock.
    // In clip mode, also every logged key's luma, so score.mjs can find each key going down (latency and sparks).
    const logged = [...new Set(log.map((n) => n.pitch))];
    const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      const L = live.current;
      const at = L.step === "latency" && L.latency.pitch !== null ? L.samples.get(L.latency.pitch) : undefined;
      const analyse = clipMode && logged.length > 0 && L.samples.size > 0 && (L.step === "latency" || L.step === "play");
      if ((at || analyse) && v.videoWidth) {
        small.width = ANALYSIS_W;
        small.height = Math.round((v.videoHeight * ANALYSIS_W) / v.videoWidth);
        sctx.drawImage(v, 0, 0, small.width, small.height);
        const img = sctx.getImageData(0, 0, small.width, small.height);
        const t = clipMode ? meta.mediaTime * 1000 : meta.expectedDisplayTime;
        if (at) L.latency.frames.push({ t, b: meanLuma(img.data, at) });
        if (analyse)
          for (const p of logged) {
            const q = L.samples.get(p);
            if (!q) continue;
            const list = L.analysis.get(p) ?? [];
            if (list.at(-1)?.t !== t) list.push({ t, b: meanLuma(img.data, q) });
            L.analysis.set(p, list);
          }
      }
      vfc = v.requestVideoFrameCallback(onFrame);
    };
    if ("requestVideoFrameCallback" in v) vfc = v.requestVideoFrameCallback(onFrame);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const t0 = performance.now();
      const L = live.current;
      const now = clock();
      const dt = t0 - lastWall;
      lastWall = t0;

      // Clip mode: the log's note events reach the take as the clip passes them.
      if (clipMode) {
        if (now < L.lastClock) L.logAt = log.findIndex((n) => n.t >= now) === -1 ? log.length : log.findIndex((n) => n.t >= now);
        while (L.logAt < log.length && log[L.logAt].t <= now) {
          const n = log[L.logAt++];
          onKey({ type: n.type, pitch: n.pitch, velocity: n.velocity, timeMs: n.t });
        }
      }
      L.lastClock = now;

      const w = stage.clientWidth, h = stage.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!v.videoWidth) return;
      const fit = containFit(v.videoWidth, v.videoHeight, w, h);
      if (composite === "draw") ctx.drawImage(v, fit.dx, fit.dy, v.videoWidth * fit.scale, v.videoHeight * fit.scale);
      const S = (p: Pt): Pt => [fit.dx + p[0] * fit.scale, fit.dy + p[1] * fit.scale];
      const path = (q: Quad) => {
        ctx.beginPath();
        q.forEach((p, i) => {
          const [x, y] = S(p);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
      };

      // The visuals the picture has caught up with.
      L.visuals = L.visuals.filter((e) => {
        if (e.at > now) return true;
        if (e.kind === "down") L.down.set(e.pitch, e.at);
        else if (e.kind === "up") L.down.delete(e.pitch);
        else if (e.kind === "wrong") L.wrongs.set(e.pitch, e.at);
        else if (e.kind === "hit" && sparks && !still.matches) {
          const q = L.quads.get(e.pitch);
          if (q) {
            const [a, b] = [S(q[0]), S(q[1])];
            sparks.hit(Math.min(a[0], b[0]), Math.abs(b[0] - a[0]), (a[1] + b[1]) / 2, e.judgment!, color(handOf.get(e.pitch) ?? "R"));
          }
        }
        return false;
      });

      const corners = L.cal.corners;
      if (L.step !== "play") {
        // Setup: the bed's outline, the keys once the range is known, and a reticle per corner.
        ctx.lineWidth = 1;
        ctx.strokeStyle = primary;
        if (L.toPicture) {
          ctx.globalAlpha = 0.55;
          for (const [p, q] of L.quads) {
            path(q);
            if (p === L.latency.pitch && L.step === "latency") {
              ctx.fillStyle = primary;
              ctx.globalAlpha = 0.35;
              ctx.fill();
              ctx.globalAlpha = 0.55;
            }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
        corners.forEach((c, i) => {
          const [x, y] = S(c);
          ctx.strokeStyle = primary;
          ctx.beginPath();
          ctx.moveTo(x - 14, y);
          ctx.lineTo(x + 14, y);
          ctx.moveTo(x, y - 14);
          ctx.lineTo(x, y + 14);
          ctx.stroke();
          ctx.strokeRect(x - 6, y - 6, 12, 12);
          ctx.font = canvasFonts.data(12);
          ctx.fillStyle = primary;
          ctx.fillText(`${i + 1} ${Math.round(c[0])},${Math.round(c[1])}`, x + 10, y - 10);
        });
      }

      // Held keys glow in their hand's color; wrong ones flash red.
      for (const [p] of L.down) {
        const q = L.quads.get(p);
        if (!q) continue;
        const c = color(handOf.get(p) ?? "R");
        path(q);
        ctx.fillStyle = c;
        ctx.globalAlpha = overlaySettings.glowAlpha;
        ctx.fill();
        if (sparks && !still.matches && L.step === "play") {
          const [a, b] = [S(q[0]), S(q[1])];
          sparks.hold(Math.min(a[0], b[0]), Math.abs(b[0] - a[0]), (a[1] + b[1]) / 2, c, dt);
        }
      }
      for (const [p, at] of L.wrongs) {
        const k = 1 - (now - at) / overlaySettings.wrongMs;
        const q = L.quads.get(p);
        if (k <= 0 || !q) {
          L.wrongs.delete(p);
          continue;
        }
        path(q);
        ctx.fillStyle = wrongColor;
        ctx.globalAlpha = overlaySettings.wrongAlpha * k;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (L.step === "play" && L.judge && L.toPicture) {
        const chartNow = now - L.zero;
        L.judge.advance(chartNow);
        const depth = laneDepth(L.toPicture);
        ctx.globalAlpha = overlaySettings.noteAlpha;
        for (const n of chart.notes) {
          const at = noteTimeMs(chart, n);
          const span = noteSpan(chartNow, at, Math.max(mpb / 4, n.duration * mpb - overlaySettings.gapMs), depth);
          const k = L.bed.get(n.pitch);
          if (!span || !k) continue;
          const [u0, u1] = [k[0][0], k[1][0]];
          path(mapQuad(L.toPicture, [[u0, span[0]], [u1, span[0]], [u1, span[1]], [u0, span[1]]]));
          ctx.fillStyle = color(n.hand);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const lineY = (S(apply(L.toPicture, [0, 0]))[1] + S(apply(L.toPicture, [1, 0]))[1]) / 2;
        const frame = { nowMs: chartNow, lowPitch: L.cal.lo ?? 21, highPitch: L.cal.hi ?? 108, judgmentLineY: lineY, width: w, height: h, keyX: () => ({ x: 0, width: 0 }) };
        L.hud?.draw?.(ctx, frame);
        if (sparks) sparks.draw(ctx, frame, dt);
        if (chartNow > L.endAt) {
          setResults(L.judge.finish(chartNow));
          L.judge = null;
          setPlaying(false);
        }
      }

      // The frame's work, for the perf readout: p95 over the last 600 frames.
      const L2 = L.frameMs;
      L2.push(performance.now() - t0);
      if (L2.length > 600) L2.shift();
      if (L2.length % 60 === 0) {
        const s = [...L2].sort((a, b) => a - b);
        setPerf({ p95: s[Math.floor(s.length * 0.95)], frames: s.length });
      }
    };
    sparks = hitParticles();
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      if (vfc && "cancelVideoFrameCallback" in v) v.cancelVideoFrameCallback(vfc);
    };
  }, [chart, clipMode, clock, composite, log, onKey]);

  // Corners: a click sets the next one; a drag on one nudges it.
  const dragging = useRef<number | null>(null);
  const toVideo = (e: ReactPointerEvent): Pt | null => {
    const v = videoRef.current, st = stageRef.current;
    if (!v?.videoWidth || !st) return null;
    const r = st.getBoundingClientRect();
    const f = containFit(v.videoWidth, v.videoHeight, r.width, r.height);
    return [(e.clientX - r.left - f.dx) / f.scale, (e.clientY - r.top - f.dy) / f.scale];
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    if (step !== "corners") return;
    const p = toVideo(e);
    const v = videoRef.current;
    if (!p || !v) return;
    const near = cal.corners.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) < v.videoWidth / 60);
    if (near >= 0) {
      dragging.current = near;
      (e.target as Element).setPointerCapture(e.pointerId);
    } else if (cal.corners.length < 4) updateCal({ ...cal, corners: [...cal.corners, p] });
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragging.current === null) return;
    const p = toVideo(e);
    if (!p) return;
    const corners = cal.corners.map((c, i) => (i === dragging.current ? p : c));
    updateCal({ ...cal, corners });
  };
  const onPointerUp = () => {
    dragging.current = null;
  };

  // Save still: the raw camera frame, one PNG, only when clicked.
  const saveStill = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `real-keys-still-${c.width}x${c.height}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
    // The calibration it was taken with, for score.mjs edges: numbers, no picture.
    download(`real-keys-calibration-${c.width}x${c.height}.json`, cal);
  };

  // Clip mode: the frames' luma per logged key, the log and the delay, for score.mjs latency and sparks.
  const saveAnalysis = () => {
    const frames = Object.fromEntries([...live.current.analysis].map(([p, f]) => [p, [...f].sort((a, b) => a.t - b.t)]));
    download(`${(clipName ?? "clip").replace(/\.[^.]+$/, "")}.analysis.json`, { clip: clipName, delayMs: cal.delayMs, notes: log, frames });
  };

  const steps: [Step, string][] = [
    ["source", clipMode ? "Clip" : "Camera"],
    ["corners", "Corners"],
    ["range", "Key range"],
    ["latency", "Latency"],
    ["play", "Play"],
  ];
  const ready = cal.corners.length === 4;
  const sourceOn = clipMode ? !!clipName : !!stream;

  return (
    <main className={css.page} data-testid="real-keys">
      <div
        ref={stageRef}
        className={css.stage}
        data-step={step}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <video ref={videoRef} className={css.video} style={composite === "draw" ? { opacity: 0 } : undefined} playsInline muted />
        <canvas ref={canvasRef} className={css.overlay} />
        {!sourceOn && (
          <div className={css.empty}>
            <MonoLabel>{clipMode ? "No clip loaded" : "Camera off"}</MonoLabel>
            <p>Point a camera down at the keys. Nothing it sees leaves this page.</p>
          </div>
        )}
      </div>

      {sourceOn && !clipMode && (
        <div className={css.live} data-testid="camera-on">
          <span className={css.dot} aria-hidden /> Camera on
        </div>
      )}

      {!capture && (
        <aside className={css.rail} aria-label="Real Keys setup">
          <header className={css.head}>
            <Link href="/lab" className={css.back}>
              Lab
            </Link>
            <h1 className={css.title}>Real Keys</h1>
            <MonoLabel>{chart ? `${chart.title} · ${chart.notes.length} notes` : (error ?? "loading")}</MonoLabel>
          </header>
          <ol className={css.steps}>
            {steps.map(([s, label], i) => (
              <li key={s}>
                <button type="button" {...kitChip(step === s)} onClick={() => setStep(s)} disabled={s !== "source" && !sourceOn} data-testid={`step-${s}`}>
                  <span className={css.num}>{String(i + 1).padStart(2, "0")}</span> {label}
                </button>
              </li>
            ))}
          </ol>

          <section className={css.body}>
            {step === "source" && !clipMode && (
              <>
                <label className={css.field}>
                  <MonoLabel>Camera</MonoLabel>
                  <select className={css.select} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                    <option value="">Default camera</option>
                    {devices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Camera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={css.row}>
                  <Button onClick={() => void startCamera()}>{stream ? "Restart camera" : "Start camera"}</Button>
                  {stream && (
                    <Button kind="secondary" onClick={stopCamera}>
                      Stop
                    </Button>
                  )}
                </div>
                <p className={css.note}>Asks for 1920×1080. {gave ? `Got ${gave}.` : ""}</p>
              </>
            )}
            {step === "source" && clipMode && (
              <>
                <label className={css.field}>
                  <MonoLabel>Clip (video)</MonoLabel>
                  <input className={css.file} type="file" accept="video/*" onChange={(e) => openClip(e.target.files?.[0])} />
                </label>
                <label className={css.field}>
                  <MonoLabel>MIDI log (notes.json)</MonoLabel>
                  <input className={css.file} type="file" accept="application/json,.json" onChange={(e) => openLog(e.target.files?.[0])} />
                </label>
                <p className={css.note}>
                  {gave ? `${clipName}: ${gave}. ` : ""}
                  {log.length ? `${log.filter((n) => n.type === "on").length} note-ons.` : "No log yet."}
                </p>
              </>
            )}
            {step === "corners" && (
              <>
                <p className={css.prompt}>
                  {cal.corners.length < 4 ? (
                    <>
                      Click the key bed&apos;s <b>{CORNER_NAMES[cal.corners.length]}</b> corner.
                    </>
                  ) : (
                    "All four set. Drag a corner to nudge it."
                  )}
                </p>
                <p className={css.note}>The back edge is the fallboard&apos;s side: the notes fall in from beyond it.</p>
                <div className={css.row}>
                  <Button kind="secondary" onClick={() => updateCal({ ...cal, corners: [] })}>
                    Reset corners
                  </Button>
                  <Button disabled={!ready} onClick={() => setStep("range")}>
                    Next
                  </Button>
                </div>
              </>
            )}
            {step === "range" && (
              <>
                <p className={css.prompt}>
                  {cal.lo === null ? "Press the leftmost key in view." : cal.hi === null ? "Now the rightmost key in view." : "Range set. Press again to redo."}
                </p>
                <dl className={css.data}>
                  <dt>Low</dt>
                  <dd>{cal.lo === null ? "—" : `${noteName(cal.lo)} · ${cal.lo}`}</dd>
                  <dt>High</dt>
                  <dd>{cal.hi === null ? "—" : `${noteName(cal.hi)} · ${cal.hi}`}</dd>
                </dl>
                <p className={css.note}>{midi}</p>
                <div className={css.row}>
                  <Button kind="secondary" onClick={() => updateCal({ ...cal, lo: 21, hi: 108 })}>
                    Whole bed: 88 keys
                  </Button>
                  <Button disabled={cal.lo === null || cal.hi === null} onClick={() => setStep("latency")}>
                    Next
                  </Button>
                </div>
              </>
            )}
            {step === "latency" && (
              <>
                <p className={css.prompt}>
                  Press one key {PRESSES} times, a beat apart. {presses ? `${presses} of ${PRESSES}.` : ""}
                </p>
                <dl className={css.data}>
                  <dt>Delay</dt>
                  <dd>{cal.latency ? `${Math.round(cal.latency.medianMs)} ms` : `${cal.delayMs} ms`}</dd>
                  <dt>Spread</dt>
                  <dd>
                    {cal.latency
                      ? `${Math.round(cal.latency.minMs)}–${Math.round(cal.latency.maxMs)} ms · ${cal.latency.spreadFrames.toFixed(1)} fr`
                      : "—"}
                  </dd>
                  <dt>Found</dt>
                  <dd>{cal.latency ? `${cal.latency.found} of ${cal.latency.of}` : "—"}</dd>
                </dl>
                <div className={css.row}>
                  <Button kind="secondary" onClick={resetLatency}>
                    Again
                  </Button>
                  <Button disabled={presses < 3} onClick={finishLatency}>
                    Measure
                  </Button>
                  <Button kind="secondary" onClick={() => setStep("play")}>
                    Next
                  </Button>
                </div>
              </>
            )}
            {step === "play" && (
              <>
                {results ? (
                  <dl className={css.data} data-testid="real-keys-results">
                    <dt>Rank</dt>
                    <dd>{results.rank}</dd>
                    <dt>Accuracy</dt>
                    <dd>{(results.accuracy * 100).toFixed(1)}%</dd>
                    <dt>Perfect</dt>
                    <dd>{results.counts.PERFECT}</dd>
                    <dt>Great</dt>
                    <dd>{results.counts.GREAT}</dd>
                    <dt>Miss</dt>
                    <dd>{results.counts.MISS}</dd>
                  </dl>
                ) : (
                  <p className={css.prompt}>{playing ? "Playing. The overlay runs " + cal.delayMs + " ms behind your keys, with the picture." : "Ready."}</p>
                )}
                <div className={css.row}>
                  <Button disabled={!ready || playing || !chart} onClick={start} data-testid="real-keys-start">
                    {results ? "Retry" : "Start"}
                  </Button>
                </div>
              </>
            )}
          </section>

          <footer className={css.foot}>
            <Button kind="secondary" onClick={saveStill} disabled={!sourceOn}>
              Save still
            </Button>
            {clipMode && (
              <Button kind="secondary" onClick={saveAnalysis} disabled={!sourceOn || !log.length}>
                Save analysis log
              </Button>
            )}
            <MonoLabel>
              {perf ? `p95 ${perf.p95.toFixed(2)} ms · ${composite}` : composite}{" "}
              <a className={css.link} href={`?${new URLSearchParams({ ...Object.fromEntries(params), composite: composite === "draw" ? "video" : "draw" })}`}>
                try {composite === "draw" ? "video" : "draw"}
              </a>
            </MonoLabel>
          </footer>
        </aside>
      )}
    </main>
  );
}
