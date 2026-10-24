"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, GameEvent, InputDevice, InputEvent, Results, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { plugins } from "../../game/layers";
import { drawHighway, makeLayout, type HighwayState, type Layout } from "../../game/core/highway";
import { createZoom, zoomOn } from "../../game/highway-zoom";
import { Judge, noteTimeMs } from "../../game/core/judge";
import { keysDevice, midiDevice, testDevice } from "../../game/core/input";
import { describeTiming, timingSummary, type TimingSummary } from "../../game/timing";
import { SfxControls } from "../../game/sound/SfxControls";
import { nextPause, pauseClock, type PauseAction, type PauseMode } from "../../game/play-slots";
import { PauseOverlay, Slots } from "../../game/play-slots/ui";
import {
  GOOD_MS,
  LATENCY_MAX,
  LATENCY_MIN,
  loadLatencyOffset,
  msPerBeat,
  saveLatencyOffset,
  settings,
} from "../../game/core/settings";

const DEFAULT_SONG = "twinkle";
// A song id is its folder under web/public/songs/ (it may have subfolders, like library/...).
const SONG_ID = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/i;
const END_TAIL_MS = 1000; // after the last note's window closes, before the results screen
const INPUT_GRACE_MS = 50; // input can arrive this late after its timestamp; don't call a MISS before it could land

type Phase = "loading" | "ready" | "playing" | "results" | "error";

interface TestHook {
  ready: boolean;
  chart: Chart | null;
  press(pitch: number, chartTimeMs: number, velocity?: number): void;
  results: Results | null;
}
declare global {
  interface Window {
    __pianoArcade?: TestHook;
  }
}

export default function Play() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [timing, setTiming] = useState<TimingSummary | null>(null);
  const [latency, setLatency] = useState(0);
  const [midiStatus, setMidiStatus] = useState("MIDI: connects when you press Start");
  const [isTest, setIsTest] = useState(false);
  const [title, setTitle] = useState("");
  const [take, setTake] = useState<Take | null>(null);
  const [loaded, setLoaded] = useState<{ chart: Chart; params: URLSearchParams } | null>(null); // for the panels
  const [pauseMode, setPauseMode] = useState<PauseMode>("playing");
  const [countdown, setCountdown] = useState(0);

  const chartRef = useRef<Chart | null>(null);
  const paramsRef = useRef<URLSearchParams | null>(null);
  const latencyRef = useRef(0);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const highwayRef = useRef<HTMLCanvasElement>(null);
  const layerRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const stopRef = useRef<() => void>(() => {});
  const pauseRef = useRef<(a: PauseAction) => void>(() => {});
  const startRef = useRef<() => void>(() => {}); // Retry from the pause menu, inside start itself

  // Load settings and the chart once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    paramsRef.current = params;
    latencyRef.current = loadLatencyOffset();
    let live = true; // StrictMode mounts twice in dev: only the live mount's load may set state
    const song = params.get("song") || DEFAULT_SONG;
    (SONG_ID.test(song) ? fetch(`/songs/${song}/chart.json`) : Promise.reject(new Error(`No song called "${song}".`)))
      .then((r) => {
        if (!r.ok) throw new Error(`No song called "${song}".`);
        return r.json();
      })
      .then((raw: unknown) => {
        if (!live) return;
        const problems = validateChart(raw);
        if (problems.length) throw new Error(`Bad chart: ${problems.join("; ")}`);
        chartRef.current = plugins.reduce((c, p) => p.transformChart?.(c, params) ?? c, raw as Chart);
        setTitle(chartRef.current.title);
        setLoaded({ chart: chartRef.current, params });
        setLatency(latencyRef.current);
        setIsTest(params.get("input") === "test");
        setPhase("ready");
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message);
        setPhase("error");
      });
    return () => {
      live = false;
      stopRef.current();
    };
  }, []);

  const start = useCallback(() => {
    const chart = chartRef.current;
    const canvas = highwayRef.current;
    if (!chart || !canvas) return;
    stopRef.current();
    setResults(null);
    setPhase("playing");
    setPauseMode("playing");

    const params = paramsRef.current ?? new URLSearchParams();
    const test = params.get("input") === "test";
    const perspective = Math.min(0.3, Math.max(0, Number(params.get("perspective")) || settings.perspective));
    const mpb = msPerBeat(chart.bpm);
    const lastNoteMs = Math.max(...chart.notes.map((n) => noteTimeMs(chart, n)));

    const take: Take = {
      chartId: chart.id,
      startedAt: new Date().toISOString(),
      latencyOffsetMs: latencyRef.current,
      inputDevice: test ? "test" : "keys",
      events: [],
    };
    // The first plugin with a background gets an empty element behind the highway, once per take.
    const bgEl = backgroundRef.current;
    const background = bgEl ? (plugins.find((p) => p.background)?.background?.(bgEl) ?? null) : null;
    const hw: HighwayState = {
      nowMs: -settings.countInBeats * mpb,
      noteState: new Map(),
      pressed: new Set(),
      pressedHand: new Map(),
      latest: null,
      countInBeat: null,
      backdropAlpha: background ? settings.stageBackdropAlpha : 1,
    };
    const handOf = new Map(chart.notes.map((n) => [n.id, n.hand]));
    const emit = (e: GameEvent) => {
      if (e.type === "noteHit") hw.pressedHand!.set(e.pitch, handOf.get(e.noteId)!); // the key lights in its note's hand
      if (e.type === "noteHit") hw.latest = { judgment: e.judgment, offsetMs: e.offsetMs, atMs: e.atMs };
      if (e.type === "noteMiss") hw.latest = { judgment: "MISS", offsetMs: null, atMs: e.atMs };
      if (e.type === "wrongNote") hw.latest = { judgment: "WRONG", offsetMs: null, atMs: e.atMs };
      for (const p of plugins) p.onEvent?.(e);
    };
    const judge = new Judge(chart, emit);
    hw.noteState = judge.noteState;
    // Zero is fixed here, after the stage and judge are built, so songStart's atMs is the chart time now and a plugin's
    // performance.now() - atMs is the same zero the judge uses. Fixed before the build, it trailed by the build (#173).
    const zeroPerf = performance.now() + settings.countInBeats * mpb; // chart clock 0 = beat 0 of bar 1
    const clock = pauseClock(zeroPerf); // stands still while paused (play-slots)
    emit({ type: "songStart", atMs: hw.nowMs });

    // Input: every device feeds one handler; a key's judged time is its arrival minus the latency offset.
    let firstKind = true;
    const onInput = (kind: Take["inputDevice"]) => (e: InputEvent) => {
      if (clock.paused) return; // keys while paused are neither judged nor recorded
      const t = clock.now(e.timeMs) - latencyRef.current;
      if (e.type === "on") {
        if (firstKind && !test) take.inputDevice = kind;
        firstKind = false;
        hw.pressed.add(e.pitch);
        take.events.push({ pitch: e.pitch, velocity: e.velocity, timeMs: t, offTimeMs: null });
        judge.press(e.pitch, t, take.events.length - 1);
      } else {
        hw.pressed.delete(e.pitch);
        hw.pressedHand!.delete(e.pitch);
        const ev = take.events.findLast((x) => x.pitch === e.pitch && x.offTimeMs === null);
        if (ev) ev.offTimeMs = t;
      }
    };
    const wrap = (d: InputDevice) => plugins.reduce((dev, p) => p.wrapInput?.(dev) ?? dev, d);
    const tester = test ? testDevice() : null;
    const devices = (tester ? [tester] : [midiDevice(setMidiStatus), keysDevice(Math.min(...chart.notes.map((n) => n.pitch)))]).map(wrap);
    for (const d of devices) void d.start(onInput(d.kind));

    // Canvases sized to the window, in CSS pixels.
    const ctx = canvas.getContext("2d")!;
    const layerCtxs = layerRefs.current.map((c) => c?.getContext("2d") ?? null);
    let layout: Layout | null = null;
    // highway-zoom: on wide charts (or ?zoom=on) the layout follows the music, rebuilt each frame from its range.
    const zoom = zoomOn(chart, params) ? createZoom(chart) : null;
    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      for (const c of [canvas, ...layerRefs.current]) {
        if (!c) continue;
        c.width = w * dpr;
        c.height = h * dpr;
        c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      layout = makeLayout(chart, w, h, perspective);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let idleRaf = 0;
    let lastBeat = 0;
    let done = false;
    let mode: PauseMode = "playing";
    let countdownUntil = 0; // wall time the resume countdown ends
    let shownCount = 0;
    // Pause, Resume, Retry and Quit (play-slots). Esc and the menu's buttons both come here.
    const act = (a: PauseAction) => {
      const next = nextPause(mode, a);
      if (next === mode) return;
      const perf = performance.now();
      if (next === "menu") {
        clock.pause(perf);
        const at = clock.now(perf);
        emit({ type: "pause", atMs: at });
        // Held keys end at the pause: their releases arrive while paused, where input is ignored.
        for (const pitch of hw.pressed) {
          const ev = take.events.findLast((x) => x.pitch === pitch && x.offTimeMs === null);
          if (ev) ev.offTimeMs = at - latencyRef.current;
        }
        hw.pressed.clear();
        hw.pressedHand!.clear();
      }
      if (next === "countdown") countdownUntil = perf + chart.beatsPerBar * mpb;
      if (next === "playing") {
        clock.resume(perf);
        emit({ type: "resume", atMs: clock.now(perf) });
      }
      mode = next;
      setPauseMode(next);
      if (next !== "quit") return;
      emit({ type: "quit", atMs: clock.now(perf) });
      if (a === "retry") return startRef.current();
      stopRef.current();
      setPhase("ready");
    };
    pauseRef.current = act;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      e.preventDefault();
      act("esc");
    };
    if (!test) window.addEventListener("keydown", onKey); // ?input=test never pauses
    // After the take, the background keeps animating behind the results screen until the next take or unmount.
    const idle = () => {
      background?.frame({ ...layout!, nowMs: clock.now(performance.now()) });
      idleRaf = requestAnimationFrame(idle);
    };
    const finish = (now: number) => {
      done = true;
      const r = judge.finish(now);
      stop();
      if (background) idleRaf = requestAnimationFrame(idle);
      if (window.__pianoArcade) window.__pianoArcade.results = r;
      setTake(take);
      setResults(r);
      setTiming(timingSummary(chart, take, r, latencyRef.current));
      setPhase("results");
    };
    const frame = () => {
      if (mode === "countdown") {
        const left = countdownUntil - performance.now();
        if (left <= 0) act("countdownDone");
        else if (Math.ceil(left / mpb) !== shownCount) setCountdown((shownCount = Math.ceil(left / mpb)));
      }
      const now = clock.now(performance.now());
      hw.nowMs = now;
      const beat = now < 0 ? Math.floor(now / mpb) + settings.countInBeats + 1 : 0;
      hw.countInBeat = beat > 0 ? beat : null;
      if (beat > lastBeat) emit({ type: "countInBeat", beat, atMs: (beat - 1 - settings.countInBeats) * mpb });
      lastBeat = beat;
      judge.advance(now - Math.max(0, latencyRef.current) - INPUT_GRACE_MS);

      if (zoom) layout = makeLayout(chart, w, h, perspective, zoom(now));
      drawHighway(ctx, layout!, chart, hw);
      const f = { ...layout!, nowMs: now };
      plugins.forEach((p, i) => {
        const lc = layerCtxs[i];
        if (!lc || !p.draw) return;
        lc.clearRect(0, 0, f.width, f.height);
        p.draw(lc, f);
      });
      background?.frame(f);

      if (now > lastNoteMs + GOOD_MS + Math.max(0, latencyRef.current) + INPUT_GRACE_MS + END_TAIL_MS) return finish(now);
      if (!done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    function stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      for (const d of devices) d.stop();
    }
    stopRef.current = () => {
      stop();
      cancelAnimationFrame(idleRaf);
      background?.dispose();
    };

    if (window.__pianoArcade) {
      Object.assign(window.__pianoArcade, {
        ready: true,
        results: null,
        press: (pitch: number, chartTimeMs: number, velocity = 80) => tester?.queue(pitch, clock.toPerf(chartTimeMs) + latencyRef.current, velocity),
      });
    }
  }, []);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  // Test hook (?input=test only), then auto-start so the verify script needs no clicks.
  useEffect(() => {
    if (!isTest || phase !== "ready") return;
    window.__pianoArcade = { ready: false, chart: chartRef.current, press: () => {}, results: null };
    start();
  }, [isTest, phase, start]);

  const onLatency = (v: number) => {
    latencyRef.current = v;
    setLatency(v);
    saveLatencyOffset(v);
  };

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <div ref={backgroundRef} style={canvasStyle} />
      <canvas ref={highwayRef} style={canvasStyle} />
      {plugins.map((p, i) => (
        <canvas key={p.id} ref={(c) => void (layerRefs.current[i] = c)} style={canvasStyle} />
      ))}

      {phase === "playing" && (
        <PauseOverlay
          mode={pauseMode}
          count={countdown}
          button={button}
          onResume={() => pauseRef.current("resume")}
          onRetry={() => pauseRef.current("retry")}
          onQuit={() => pauseRef.current("quit")}
        />
      )}
      {phase !== "playing" && (
        <div style={overlay}>
          {phase === "loading" && <p>Loading chart…</p>}
          {phase === "error" && (
            <>
              <p role="alert">{error}</p>
              <Link href="/" style={{ color: settings.noteColor }}>
                Back to the song list
              </Link>
            </>
          )}
          {phase === "ready" && (
            <>
              <h1 style={{ margin: 0 }}>{title}</h1>
              <p style={{ opacity: 0.7 }}>Laptop keys: A S D F G H J K L ; (white) · W E T Y U O P (black)</p>
              <button style={button} onClick={start} autoFocus>
                Start
              </button>
              {loaded && <Slots plugins={plugins} panel={(p) => p.startPanel?.(loaded)} />}
            </>
          )}
          {phase === "results" && results && (
            <ResultsScreen results={results} timing={timing} latency={latency} onLatency={onLatency} onRetry={start}>
              {take && loaded && (
                <Slots plugins={plugins} panel={(p) => p.resultsPanel?.({ ...loaded, take, results, retry: start })} />
              )}
            </ResultsScreen>
          )}
          <label style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center" }}>
            Latency offset
            <input type="range" min={LATENCY_MIN} max={LATENCY_MAX} step={1} value={latency} onChange={(e) => onLatency(Number(e.target.value))} />
            <output style={{ width: 64 }}>{latency} ms</output>
          </label>
          <SfxControls />
          {!isTest && <p style={{ opacity: 0.6, fontSize: 14 }}>{midiStatus}</p>}
        </div>
      )}
    </main>
  );
}

function ResultsScreen({
  results,
  timing,
  latency,
  onLatency,
  onRetry,
  children,
}: {
  results: Results;
  timing: TimingSummary | null;
  latency: number;
  onLatency: (ms: number) => void;
  onRetry: () => void;
  children?: React.ReactNode; // the plugins' results panels, between the timing panel and Retry
}) {
  const { counts } = results;
  const rows: [string, string, number | string][] = [
    ["PERFECT", "count-PERFECT", counts.PERFECT],
    ["GREAT", "count-GREAT", counts.GREAT],
    ["GOOD", "count-GOOD", counts.GOOD ?? 0],
    ["MISS", "count-MISS", counts.MISS],
    ["Wrong notes", "count-wrong", counts.wrong ?? 0],
    ["Extra presses", "count-extra", counts.extra],
    ["Accuracy", "accuracy", `${(results.accuracy * 100).toFixed(1)}%`],
    ["Max combo", "max-combo", results.maxCombo],
  ];
  return (
    <section data-testid="results" style={{ textAlign: "center" }}>
      <div data-testid="rank" style={{ fontSize: 96, fontWeight: 800, color: settings.noteColor }}>
        {results.rank}
      </div>
      <table style={{ margin: "0 auto", fontSize: 20, borderSpacing: "24px 4px" }}>
        <tbody>
          {rows.map(([label, id, value]) => (
            <tr key={id}>
              <td style={{ textAlign: "left" }}>{label}</td>
              <td data-testid={id} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {timing && <TimingPanel timing={timing} latency={latency} onLatency={onLatency} />}
      {children}
      <button style={{ ...button, marginTop: 24 }} onClick={onRetry} autoFocus>
        Retry
      </button>
    </section>
  );
}

// How early or late the take was (timing-feedback). Only numbers computed from this take.
function TimingPanel({ timing, latency, onLatency }: { timing: TimingSummary; latency: number; onLatency: (ms: number) => void }) {
  const suggested = timing.suggestedLatencyMs;
  return (
    <div data-testid="timing" style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6 }}>
      {describeTiming(timing).map((line) => (
        <div key={line}>{line}</div>
      ))}
      {suggested !== null && suggested !== latency && (
        <div style={{ marginTop: 8 }}>
          <button style={{ ...button, fontSize: 15, padding: "6px 16px", background: "#ddd" }} onClick={() => onLatency(suggested)}>
            Set latency offset to {suggested} ms
          </button>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
            Shifts every press, so it also hides a habit of rushing or dragging.
          </div>
        </div>
      )}
      {suggested !== null && suggested === latency && (
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>Latency offset set to {latency} ms. Press Retry to use it.</div>
      )}
    </div>
  );
}

const canvasStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "safe center", // centered while it fits; once results panels make it taller, it starts at the top
  overflowY: "auto", // … and scrolls, so the rank and counts are never cut off above the window
  background: "rgba(0,0,0,0.75)",
};
const button: React.CSSProperties = {
  padding: "12px 32px",
  fontSize: 20,
  borderRadius: 8,
  border: "none",
  background: settings.noteColor,
  color: "#000",
  cursor: "pointer",
};
