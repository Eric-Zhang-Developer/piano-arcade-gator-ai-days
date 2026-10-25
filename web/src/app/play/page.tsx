"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, Frame, GameEvent, InputDevice, InputEvent, Results, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { plugins } from "../../game/layers";
import { barLines } from "../../game/bar-lines";
import { coreGuard, createGuard } from "../../game/crash-guard";
import { toast } from "../../game/notice-toast";
import { drawHighway, makeLayout, staticRange, type HighwayState, type KeyRange, type Layout } from "../../game/core/highway";
import { createZoom, zoomOn } from "../../game/highway-zoom";
import { Judge, noteTimeMs } from "../../game/core/judge";
import { keysDevice, midiDevice, testDevice } from "../../game/core/input";
import { laptopKey } from "../../game/laptop-sound";
import { describeTiming, timingSummary, type TimingSummary } from "../../game/timing";
import { SfxControls } from "../../game/sound/SfxControls";
import { nextPause, pauseClock, type PauseAction, type PauseMode } from "../../game/play-slots";
import { Slots } from "../../game/play-slots/ui";
import { PauseMenu } from "../../game/pause-skin";
import { ResultsLayout } from "../../game/results-layout";
import { emptyHud, reduceHud } from "../../game/hud";
import { barStep, holdClock, isWaitMode } from "../../game/wait-mode";
import { isFlowMode } from "../../game/flow-mode/clock";
import { FlowJudge } from "../../game/flow-mode/judge";
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
  pressNow?(pitch: number, velocity?: number): void; // at the current wall time, for flow mode's moving clock
  now?(): number; // the chart clock (holds and pauses taken out)
  results: Results | null;
}
declare global {
  interface Window {
    __pianoArcade?: TestHook;
  }
}

export default function Play() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [timing, setTiming] = useState<TimingSummary | null>(null);
  const [latency, setLatency] = useState(0);
  const [midiStatus, setMidiStatus] = useState("MIDI: connects when you press Start");
  const [isTest, setIsTest] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const [score, setScore] = useState<number>(); // the score the player saw on the HUD
  const [loaded, setLoaded] = useState<{ chart: Chart; params: URLSearchParams } | null>(null); // for the panels
  const [pauseMode, setPauseMode] = useState<PauseMode>("playing");
  const [countdown, setCountdown] = useState(0);

  const chartRef = useRef<Chart | null>(null);
  const keysRef = useRef<KeyRange | null>(null); // the keyboard for every take: the chart as loaded, before transforms
  const paramsRef = useRef<URLSearchParams | null>(null);
  const latencyRef = useRef(0);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const highwayRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // every plugin's draw, in layers.ts order
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
        keysRef.current = staticRange(raw as Chart); // hands=, loops and practice keep the whole song's keyboard
        chartRef.current = plugins.reduce((c, p) => p.transformChart?.(c, params) ?? c, raw as Chart);
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
      barLines: barLines(chart, params), // the chart /play plays: a loop's bars carry the song's numbers
    };
    // crash-guard: one plugin's throw turns that plugin off for this take (its layer cleared once, a toast says so) and
    // the game goes on; Retry's new guard brings it back. Core's own throws are logged once and the frame goes on.
    // The overlay is cleared and redrawn every frame, so a plugin that's off simply isn't drawn from the next one on.
    const guard = createGuard((id) => toast(`${id} stopped after an error. The game goes on.`));
    const core = coreGuard();
    const bgId = plugins.find((p) => p.background)?.id ?? "";
    const handOf = new Map(chart.notes.map((n) => [n.id, n.hand]));
    let hud = emptyHud(); // rebuilt with the HUD's own reducer, as records does
    const emit = (e: GameEvent) => {
      hud = reduceHud(hud, e);
      if (e.type === "noteHit") hw.pressedHand!.set(e.pitch, handOf.get(e.noteId)!); // the key lights in its note's hand
      if (e.type === "noteHit") hw.latest = { judgment: e.judgment, offsetMs: e.offsetMs, atMs: e.atMs };
      if (e.type === "noteMiss") hw.latest = { judgment: "MISS", offsetMs: null, atMs: e.atMs };
      if (e.type === "wrongNote") hw.latest = { judgment: "WRONG", offsetMs: null, atMs: e.atMs };
      for (const p of plugins) if (p.onEvent) guard.run(p.id, "onEvent", () => p.onEvent!(e));
    };
    // ?mode=flow: the flow judge, which owns a clock that waits at each note and follows your tempo (flow-mode). With
    // ?tempo= the chart is already slowed by bar-loop, so rate 1 is the asked tempo and the steadiness reference.
    const flowJudge = isFlowMode(params) ? new FlowJudge(chart, emit, { startRate: params.has("tempo") ? 1 : undefined }) : null;
    const judge = flowJudge ?? new Judge(chart, emit, { scored: !isWaitMode(params) }); // wait mode: no score moments
    hw.noteState = judge.noteState;
    // Zero is fixed here, after the stage and judge are built, so songStart's atMs is the chart time now and a plugin's
    // performance.now() - atMs is the same zero the judge uses. Fixed before the build, it trailed by the build (#173).
    const zeroPerf = performance.now() + settings.countInBeats * mpb; // chart clock 0 = beat 0 of bar 1
    const pauses = pauseClock(zeroPerf); // stands still while paused (play-slots)
    // ?mode=wait: the chart clock also holds at each note until it's pressed, and nothing is a MISS (wait-mode).
    const wait = isWaitMode(params) ? holdClock(chart, judge.noteState) : null;
    const held = wait ?? flowJudge?.clock ?? null; // either clock runs over the pause clock
    const clock = {
      now: (perf: number) => (held ? held.now(pauses.now(perf)) : pauses.now(perf)),
      toPerf: (chartMs: number) => pauses.toPerf(held ? held.toOuter(chartMs) : chartMs),
    };
    emit({ type: "songStart", atMs: hw.nowMs });

    // Input: every device feeds one handler; a key's judged time is its arrival minus the latency offset.
    let firstKind = true;
    const onInput = (kind: Take["inputDevice"]) => (e: InputEvent) => {
      // laptop-sound: a laptop key sounds here, still inside its key event (no frame wait), after laptop-octaves'
      // shift, so the note heard is the note judged; before the pause check, as a piano's keys sound while paused.
      if (kind === "keys") laptopKey(e.type, e.pitch, e.velocity);
      if (pauses.paused) return; // keys while paused are neither judged nor recorded
      // A press during a hold lands on the held note's time; taking off the latency could put it outside GOOD.
      const t = held?.holding ? clock.now(e.timeMs) : clock.now(e.timeMs) - latencyRef.current;
      if (e.type === "on") {
        if (firstKind && !test) take.inputDevice = kind;
        firstKind = false;
        hw.pressed.add(e.pitch);
        take.events.push({ pitch: e.pitch, velocity: e.velocity, timeMs: t, offTimeMs: null });
        // Flow judges steadiness in wall time (the pause clock's), so it gets the press's own, latency taken off.
        if (flowJudge) flowJudge.press(e.pitch, t, take.events.length - 1, pauses.now(e.timeMs) - latencyRef.current);
        else judge.press(e.pitch, t, take.events.length - 1);
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
    const overlay = overlayRef.current;
    const octx = overlay?.getContext("2d") ?? null;
    const drawers = plugins.filter((p) => p.draw);
    // One canvas for every plugin's layer: cleared once, then each plugin draws in layers.ts order, its canvas state
    // (transform, alpha, composite mode) saved and restored around it so nothing leaks into the next. One full-window
    // canvas per plugin was 53 layers for the compositor to blend each frame (#678).
    const drawLayers = (f: Frame) => {
      if (!octx) return;
      octx.clearRect(0, 0, f.width, f.height);
      for (const p of drawers) {
        if (guard.off(p.id)) continue;
        octx.save();
        guard.run(p.id, "draw", () => p.draw!(octx, f));
        octx.restore();
      }
    };
    let layout: Layout | null = null;
    const keys = keysRef.current ?? staticRange(chart);
    // highway-zoom: on wide charts (or ?zoom=on) the layout follows the music, rebuilt each frame from its range.
    const zoom = zoomOn(chart, params) ? createZoom(chart) : null;
    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap);
      for (const c of [canvas, overlay]) {
        if (!c) continue;
        c.width = w * dpr;
        c.height = h * dpr;
        c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      layout = makeLayout(chart, w, h, perspective, undefined, keys); // a resize changes the width, never the keys
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
    // Held keys end at a pause: their releases arrive while paused, where input is ignored.
    const endHeld = (at: number) => {
      for (const pitch of hw.pressed) {
        const ev = take.events.findLast((x) => x.pitch === pitch && x.offTimeMs === null);
        if (ev) ev.offTimeMs = at - latencyRef.current;
      }
      hw.pressed.clear();
      hw.pressedHand!.clear();
    };
    // Pause, Resume, Retry and Quit (play-slots). Esc and the menu's buttons both come here.
    const act = (a: PauseAction) => {
      const next = nextPause(mode, a);
      if (next === mode) return;
      const perf = performance.now();
      if (next === "menu") {
        pauses.pause(perf);
        const at = clock.now(perf);
        emit({ type: "pause", atMs: at });
        endHeld(at);
      }
      if (next === "countdown") {
        countdownUntil = perf + chart.beatsPerBar * mpb;
        setCountdown((shownCount = chart.beatsPerBar)); // the countdown's first render has its full count (pause-skin)
      }
      if (next === "playing") {
        pauses.resume(perf);
        emit({ type: "resume", atMs: clock.now(perf) });
      }
      mode = next;
      setPauseMode(next);
      if (next !== "quit") return;
      emit({ type: "quit", atMs: clock.now(perf) });
      if (a === "retry") return startRef.current();
      stopRef.current();
      router.push("/"); // Quit opens the music select (pause-skin)
    };
    pauseRef.current = act;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.repeat) return;
      e.preventDefault();
      act("esc");
    };
    if (!test) window.addEventListener("keydown", onKey); // ?input=test never pauses
    // rewind (wait mode): ← back to the bar before, → ahead to the next bar, while playing past the count-in. A pause and
    // a resume at the bar start around it, so plugins re-anchor (the resume's atMs is the target). Works with input=test.
    const rewind = (dir: -1 | 1) => {
      const perf = performance.now();
      const at = clock.now(perf);
      if (!wait || mode !== "playing" || done || at < 0) return;
      const target = barStep(hw.barLines?.map((b) => b.atMs) ?? [], at, dir);
      if (target === null) return;
      emit({ type: "pause", atMs: at });
      endHeld(at);
      if (dir < 0) judge.rewind(target);
      wait.seek(target, pauses.now(perf));
      emit({ type: "resume", atMs: target });
    };
    const onArrow = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || !wait) return;
      e.preventDefault();
      rewind(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onArrow);
    // After the take, the background keeps animating behind the results screen until the next take or unmount.
    const idle = () => {
      if (background) guard.run(bgId, "background", () => background.frame({ ...layout!, nowMs: clock.now(performance.now()) }));
      idleRaf = requestAnimationFrame(idle);
    };
    const finish = (now: number) => {
      done = true;
      const r = judge.finish(now);
      // The last frame behind the results: songEnd has gone out, so a plugin that ends with the song draws nothing now
      // and every other one leaves its final state, as their own canvases did.
      drawLayers({ ...layout!, nowMs: now });
      stop();
      if (background) idleRaf = requestAnimationFrame(idle);
      if (window.__pianoArcade) window.__pianoArcade.results = r;
      setTake(take);
      setResults(r);
      setScore(hud.score);
      setTiming(timingSummary(chart, take, r, latencyRef.current));
      setPhase("results");
    };
    const frame = () => {
      try {
        step();
      } finally {
        if (!done) raf = requestAnimationFrame(frame); // whatever threw, the clock runs on to the results
      }
    };
    const step = () => {
      if (mode === "countdown") {
        const left = countdownUntil - performance.now();
        if (left <= 0) act("countdownDone");
        else if (Math.ceil(left / mpb) !== shownCount) setCountdown((shownCount = Math.ceil(left / mpb)));
      }
      const perf = performance.now();
      held?.update(pauses.now(perf));
      const now = clock.now(perf);
      hw.nowMs = now;
      const beat = now < 0 ? Math.floor(now / mpb) + settings.countInBeats + 1 : 0;
      hw.countInBeat = beat > 0 ? beat : null;
      if (beat > lastBeat) emit({ type: "countInBeat", beat, atMs: (beat - 1 - settings.countInBeats) * mpb });
      lastBeat = beat;
      // Flow's advance never MISSes: it only notices a stop past the free beats.
      if (!wait) core("the judge", () => judge.advance(now - Math.max(0, latencyRef.current) - INPUT_GRACE_MS));

      if (zoom) layout = makeLayout(chart, w, h, perspective, zoom(now));
      core("drawHighway", () => drawHighway(ctx, layout!, chart, hw));
      const f = { ...layout!, nowMs: now };
      drawLayers(f);
      if (background) guard.run(bgId, "background", () => background.frame(f));

      if (now > lastNoteMs + GOOD_MS + Math.max(0, latencyRef.current) + INPUT_GRACE_MS + END_TAIL_MS) finish(now);
    };
    raf = requestAnimationFrame(frame);

    function stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keydown", onArrow);
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
        pressNow: (pitch: number, velocity = 80) => tester?.queue(pitch, performance.now() + latencyRef.current, velocity),
        now: () => clock.now(performance.now()),
      });
    }
  }, [router]);

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

  // Latency, sound and MIDI status: under the start screen, and under the details on the results screen. Setup, not the
  // game: ?capture=1 hides each of them (capture-mode); the SfxControls wrapper has no box, so nothing moves without it.
  const controls = (
    <>
      <label data-capture-hide style={{ marginTop: 24, display: "flex", gap: 8, alignItems: "center" }}>
        Latency offset
        <input type="range" min={LATENCY_MIN} max={LATENCY_MAX} step={1} value={latency} onChange={(e) => onLatency(Number(e.target.value))} />
        <output style={{ width: 64 }}>{latency} ms</output>
      </label>
      <div data-capture-hide style={{ display: "contents" }}>
        <SfxControls />
      </div>
      {!isTest && (
        <p data-capture-hide style={{ opacity: 0.6, fontSize: 14 }}>
          {midiStatus}
        </p>
      )}
    </>
  );

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      <div ref={backgroundRef} style={canvasStyle} />
      <canvas ref={highwayRef} style={canvasStyle} />
      <canvas ref={overlayRef} style={canvasStyle} />

      {phase === "playing" && (
        <PauseMenu
          mode={pauseMode}
          count={countdown}
          beatMs={loaded ? msPerBeat(loaded.chart.bpm) : 500}
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
              <p data-capture-hide style={{ opacity: 0.7 }}>
                Laptop keys: A S D F G H J K L ; (white) · W E T Y U O P (black)
              </p>
              <button style={button} onClick={start} autoFocus>
                Start
              </button>
              {loaded && <Slots plugins={plugins} panel={(p) => p.startPanel?.(loaded)} />}
            </>
          )}
          {phase === "results" && results && (
            <ResultsLayout
              results={results}
              title={loaded?.chart.title}
              scored={!(loaded && isWaitMode(loaded.params))}
              score={score}
              timing={timing && <TimingPanel timing={timing} latency={latency} onLatency={onLatency} />}
              plugins={take && loaded ? plugins : []}
              panel={(p) => take && loaded && p.resultsPanel?.({ ...loaded, take, results, retry: start })}
              onRetry={start}
              settings={controls}
            />
          )}
          {/* not while loading: the slider would show useState's 0 before the stored offset is read (#447, #478) */}
          {phase !== "results" && phase !== "loading" && controls}
        </div>
      )}
    </main>
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
        <div data-capture-hide style={{ marginTop: 8 }}>
          <button style={{ ...button, fontSize: 15, padding: "6px 16px", background: "#ddd" }} onClick={() => onLatency(suggested)}>
            Set latency offset to {suggested} ms
          </button>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
            Shifts every press, so it also hides a habit of rushing or dragging.
          </div>
        </div>
      )}
      {suggested !== null && suggested === latency && (
        <div data-capture-hide style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>
          Latency offset set to {latency} ms. Press Retry to use it.
        </div>
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
