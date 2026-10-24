"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, GameEvent, InputDevice, InputEvent, Results, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { plugins } from "../../game/layers";
import { drawHighway, makeLayout, type HighwayState, type Layout } from "../../game/core/highway";
import { Judge, noteTimeMs } from "../../game/core/judge";
import { keysDevice, midiDevice, testDevice } from "../../game/core/input";
import {
  GREAT_MS,
  LATENCY_MAX,
  LATENCY_MIN,
  loadLatencyOffset,
  msPerBeat,
  saveLatencyOffset,
  settings,
} from "../../game/core/settings";

const CHART_URL = "/songs/twinkle/chart.json";
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
  const [latency, setLatency] = useState(0);
  const [midiStatus, setMidiStatus] = useState("MIDI: connecting…");
  const [isTest, setIsTest] = useState(false);
  const [title, setTitle] = useState("");

  const chartRef = useRef<Chart | null>(null);
  const paramsRef = useRef<URLSearchParams | null>(null);
  const latencyRef = useRef(0);
  const highwayRef = useRef<HTMLCanvasElement>(null);
  const layerRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const stopRef = useRef<() => void>(() => {});

  // Load settings and the chart once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    paramsRef.current = params;
    latencyRef.current = loadLatencyOffset();
    let live = true; // StrictMode mounts twice in dev: only the live mount's load may set state
    fetch(CHART_URL)
      .then((r) => r.json())
      .then((raw: unknown) => {
        if (!live) return;
        const problems = validateChart(raw);
        if (problems.length) throw new Error(`Bad chart: ${problems.join("; ")}`);
        chartRef.current = plugins.reduce((c, p) => p.transformChart?.(c, params) ?? c, raw as Chart);
        setTitle(chartRef.current.title);
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

    const params = paramsRef.current ?? new URLSearchParams();
    const test = params.get("input") === "test";
    const perspective = Math.min(0.3, Math.max(0, Number(params.get("perspective")) || settings.perspective));
    const mpb = msPerBeat(chart.bpm);
    const startPerf = performance.now();
    const zeroPerf = startPerf + settings.countInBeats * mpb; // chart clock 0 = beat 0 of bar 1
    const lastNoteMs = Math.max(...chart.notes.map((n) => noteTimeMs(chart, n)));

    const take: Take = {
      chartId: chart.id,
      startedAt: new Date().toISOString(),
      latencyOffsetMs: latencyRef.current,
      inputDevice: test ? "test" : "keys",
      events: [],
    };
    const hw: HighwayState = { nowMs: -settings.countInBeats * mpb, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null };
    const emit = (e: GameEvent) => {
      if (e.type === "noteHit") hw.latest = { judgment: e.judgment, offsetMs: e.offsetMs, atMs: e.atMs };
      if (e.type === "noteMiss") hw.latest = { judgment: "MISS", offsetMs: null, atMs: e.atMs };
      for (const p of plugins) p.onEvent?.(e);
    };
    const judge = new Judge(chart, emit);
    hw.noteState = judge.noteState;
    emit({ type: "songStart", atMs: hw.nowMs });

    // Input: every device feeds one handler; a key's judged time is its arrival minus the latency offset.
    let firstKind = true;
    const onInput = (kind: Take["inputDevice"]) => (e: InputEvent) => {
      const t = e.timeMs - zeroPerf - latencyRef.current;
      if (e.type === "on") {
        if (firstKind && !test) take.inputDevice = kind;
        firstKind = false;
        hw.pressed.add(e.pitch);
        take.events.push({ pitch: e.pitch, velocity: e.velocity, timeMs: t, offTimeMs: null });
        judge.press(e.pitch, t, take.events.length - 1);
      } else {
        hw.pressed.delete(e.pitch);
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
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
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
    let lastBeat = 0;
    let done = false;
    const finish = (now: number) => {
      done = true;
      const r = judge.finish(now);
      stop();
      if (window.__pianoArcade) window.__pianoArcade.results = r;
      setResults(r);
      setPhase("results");
    };
    const frame = () => {
      const now = performance.now() - zeroPerf;
      hw.nowMs = now;
      const beat = now < 0 ? Math.floor(now / mpb) + settings.countInBeats + 1 : 0;
      hw.countInBeat = beat > 0 ? beat : null;
      if (beat > lastBeat) emit({ type: "countInBeat", beat, atMs: (beat - 1 - settings.countInBeats) * mpb });
      lastBeat = beat;
      judge.advance(now - Math.max(0, latencyRef.current) - INPUT_GRACE_MS);

      drawHighway(ctx, layout!, chart, hw);
      const f = { ...layout!, nowMs: now };
      plugins.forEach((p, i) => {
        const lc = layerCtxs[i];
        if (!lc || !p.draw) return;
        lc.clearRect(0, 0, f.width, f.height);
        p.draw(lc, f);
      });

      if (now > lastNoteMs + GREAT_MS + Math.max(0, latencyRef.current) + INPUT_GRACE_MS + END_TAIL_MS) return finish(now);
      if (!done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    function stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      for (const d of devices) d.stop();
    }
    stopRef.current = stop;

    if (window.__pianoArcade) {
      Object.assign(window.__pianoArcade, {
        ready: true,
        results: null,
        press: (pitch: number, chartTimeMs: number, velocity = 80) => tester?.queue(pitch, zeroPerf + chartTimeMs + latencyRef.current, velocity),
      });
    }
  }, []);

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
      <canvas ref={highwayRef} style={canvasStyle} />
      {plugins.map((p, i) => (
        <canvas key={p.id} ref={(c) => void (layerRefs.current[i] = c)} style={canvasStyle} />
      ))}

      {phase !== "playing" && (
        <div style={overlay}>
          {phase === "loading" && <p>Loading chart…</p>}
          {phase === "error" && <p role="alert">{error}</p>}
          {phase === "ready" && (
            <>
              <h1 style={{ margin: 0 }}>{title}</h1>
              <p style={{ opacity: 0.7 }}>Laptop keys: A S D F G H J K L ; (white) · W E T Y U O P (black)</p>
              <button style={button} onClick={start} autoFocus>
                Start
              </button>
            </>
          )}
          {phase === "results" && results && <ResultsScreen results={results} onRetry={start} />}
          <label style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center" }}>
            Latency offset
            <input type="range" min={LATENCY_MIN} max={LATENCY_MAX} step={1} value={latency} onChange={(e) => onLatency(Number(e.target.value))} />
            <output style={{ width: 64 }}>{latency} ms</output>
          </label>
          {!isTest && <p style={{ opacity: 0.6, fontSize: 14 }}>{midiStatus}</p>}
        </div>
      )}
    </main>
  );
}

function ResultsScreen({ results, onRetry }: { results: Results; onRetry: () => void }) {
  const { counts } = results;
  const rows: [string, string, number | string][] = [
    ["PERFECT", "count-PERFECT", counts.PERFECT],
    ["GREAT", "count-GREAT", counts.GREAT],
    ["MISS", "count-MISS", counts.MISS],
    ["Extras", "count-extra", counts.extra],
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
      <button style={{ ...button, marginTop: 24 }} onClick={onRetry} autoFocus>
        Retry
      </button>
    </section>
  );
}

const canvasStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
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
