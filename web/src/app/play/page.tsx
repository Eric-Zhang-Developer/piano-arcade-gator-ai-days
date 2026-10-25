"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, Frame, GameEvent, InputDevice, InputEvent, Results, Take } from "../../contracts";
import { validateChart } from "../../contracts";
import { APP_NAME } from "../../game/app-name";
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
import { nextPause, pauseClock, type PauseAction, type PauseMode } from "../../game/play-slots";
import { StartScreen } from "../../game/duo-start/StartScreen";
import { PauseLights } from "../../game/leds";
import { PauseMenu } from "../../game/pause-skin";
import { Button, MonoLabel, Panel, kitButton } from "../../game/duo-tokens";
import { ResultsLayout } from "../../game/results-layout";
import { emptyHud, hudLayout, hudSettings, reduceHud, tierFor } from "../../game/hud";
import { landingAt, landingCounts, landingMounted, landingPlan, landingRuns, landingSettings, landingT, startLanding, stopLanding } from "../../game/results-landing";
import { barStep, holdClock, isWaitMode } from "../../game/wait-mode";
import { isFlowMode } from "../../game/flow-mode/clock";
import { FlowJudge } from "../../game/flow-mode/judge";
import {
  GOOD_MS,
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
  const rewindRef = useRef<(dir: -1 | 1) => void>(() => {}); // the ◀ ▶ buttons, the same as ← → (mouse-first)
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
        document.title = `${(raw as Chart).title} · ${APP_NAME}`; // the tab names the song (#953)
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
    let judged = 0; // results-landing's T0: every note judged …
    let maxCombo = 0;
    const emit = (e: GameEvent) => {
      hud = reduceHud(hud, e);
      if (e.type === "noteHit" || e.type === "noteMiss") judged++;
      if (e.type === "combo") maxCombo = Math.max(maxCombo, e.count);
      if (e.type === "noteHit") hw.pressedHand!.set(e.pitch, handOf.get(e.noteId)!); // the key lights in its note's hand
      if (e.type === "noteHit") hw.latest = { judgment: e.judgment, offsetMs: e.offsetMs, atMs: e.atMs };
      if (e.type === "noteMiss") hw.latest = { judgment: "MISS", offsetMs: null, atMs: e.atMs };
      if (e.type === "wrongNote") hw.latest = { judgment: "WRONG", offsetMs: null, atMs: e.atMs };
      for (const p of plugins) if (p.onEvent) guard.run(p.id, "onEvent", () => p.onEvent!(e));
    };
    // ?mode=flow: the flow judge, which owns a clock that waits at each note and follows your tempo (flow-mode). With
    // ?tempo= the chart is already slowed by bar-loop, so rate 1 is the asked tempo and the steadiness reference.
    const flowJudge = isFlowMode(params) ? new FlowJudge(chart, emit, { startRate: params.has("tempo") ? 1 : undefined, tempo: params.has("tempo") ? Number(params.get("tempo")) / 100 : 1 }) : null;
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
    rewindRef.current = rewind;
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
    // ?x=results-landing (spec: results-landing): from T0 the drawn clock eases to a stop and the keyboard dims while
    // the judge runs on the real clock, so the take is judged as before; the results mount when the out ends.
    const landing = landingRuns(params);
    let t0Chart: number | null = null;
    const drawDim = (f: Frame, dim: number) => {
      if (!octx || dim <= 0) return;
      octx.fillStyle = `rgba(0,0,0,${dim.toFixed(3)})`;
      octx.fillRect(0, layout!.judgmentLineY, f.width, layout!.keyboardHeight);
    };
    const beginLanding = (now: number) => {
      t0Chart = now;
      const r = canvas.getBoundingClientRect();
      const hl = hudLayout(layout!.width, layout!.judgmentLineY);
      // Where the HUD drew its score: right-aligned left of the multiplier badge, as its draw code places it.
      // ponytail: mirrors hud/index.ts's score placement (that file is another PR's); move it to a hud export once free.
      const h = hl.panel.h;
      const pad = Math.max(10, h * 0.25);
      const fam = `${getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim() || "system-ui"}, system-ui, sans-serif`;
      ctx.save();
      ctx.font = `italic 900 ${Math.round(h * 0.5)}px ${fam}`;
      const badgeW = ctx.measureText(`x${tierFor(hud.combo).mult}`).width;
      ctx.font = `italic 800 ${Math.round(h * 0.42)}px ${fam}`;
      const scoreW = ctx.measureText(hud.score.toLocaleString("en-US")).width;
      ctx.restore();
      const scoreRight = layout!.width - pad - hudSettings.statusGutterPx - badgeW - pad;
      startLanding(
        { bpm: chart.bpm, mountChartMs: now + landingSettings.outMs, counts: landingCounts(hud), combo: hud.combo, maxCombo },
        {
          score: { x: r.left + scoreRight - scoreW / 2, y: r.top + h * 0.42, size: h * 0.42 },
          combo: { x: r.left + hl.combo.cx, y: r.top + hl.combo.cy, size: hl.combo.size },
        },
        hud.score,
      );
    };
    const finish = (now: number, drawn = now) => {
      done = true;
      const r = judge.finish(now);
      // The last frame behind the results: songEnd has gone out, so a plugin that ends with the song draws nothing now
      // and every other one leaves its final state, as their own canvases did.
      drawLayers({ ...layout!, nowMs: drawn });
      if (t0Chart !== null) drawDim({ ...layout!, nowMs: drawn }, landingAt(landingT(), landingPlan()!).keyboardDim);
      stop();
      if (background) idleRaf = requestAnimationFrame(idle);
      if (window.__pianoArcade) window.__pianoArcade.results = r;
      setTake(take);
      setResults(r);
      setScore(hud.score);
      if (t0Chart !== null) landingMounted(landingCounts(r.counts), r.maxCombo, hud.score);
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
      const out = t0Chart === null ? null : landingAt(landingT(), landingPlan()!);
      const drawn = out ? t0Chart! + out.clockMs : now;
      hw.nowMs = drawn;
      const beat = now < 0 ? Math.floor(now / mpb) + settings.countInBeats + 1 : 0;
      hw.countInBeat = null; // count-in draws the 8 beats; highway.ts's old digit comes out after #747 (count-in spec)
      if (beat > lastBeat) emit({ type: "countInBeat", beat, atMs: (beat - 1 - settings.countInBeats) * mpb });
      lastBeat = beat;
      // Flow's advance never MISSes: it only notices a stop past the free beats.
      if (!wait) core("the judge", () => judge.advance(now - Math.max(0, latencyRef.current) - INPUT_GRACE_MS));

      if (zoom) layout = makeLayout(chart, w, h, perspective, zoom(drawn));
      core("drawHighway", () => drawHighway(ctx, layout!, chart, hw));
      const f = { ...layout!, nowMs: drawn };
      drawLayers(f);
      if (out) drawDim(f, out.keyboardDim);
      if (background) guard.run(bgId, "background", () => background.frame(f));

      const tail = now > lastNoteMs + GOOD_MS + Math.max(0, latencyRef.current) + INPUT_GRACE_MS + END_TAIL_MS;
      if (!landing) {
        if (tail) finish(now);
      } else if (!out) {
        // … and no key held, or today's finish time: a key held past it doesn't hold the cut back
        if (tail || (judged >= chart.notes.length && hw.pressed.size === 0)) beginLanding(now);
      } else if (out.mounted) finish(now, drawn);
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
      stopLanding();
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

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      {/* The take is drawn, so the drawing is hidden from screen readers; the status line says what it shows. */}
      <div ref={backgroundRef} style={canvasStyle} aria-hidden />
      <canvas ref={highwayRef} style={canvasStyle} aria-hidden />
      <canvas ref={overlayRef} style={canvasStyle} aria-hidden />
      <p role="status" style={srOnly}>
        {phase === "playing" ? `${loaded?.chart.title ?? "The song"}: playing` : ""}
        {phase === "results" && results ? `${loaded?.chart.title ?? "The song"}: rank ${results.rank}, ${(results.accuracy * 100).toFixed(1)}%` : ""}
      </p>

      {/* mouse-first: Esc and ← → as buttons in the corner, while playing only; ?capture=1 hides them. Pressing one
          keeps focus where it was, so a later Space or Enter doesn't press it again. ?input=test never pauses. */}
      {phase === "playing" && pauseMode === "playing" && (
        <div data-capture-hide style={corner} onMouseDown={(e) => e.preventDefault()}>
          {loaded && isWaitMode(loaded.params) && (
            <>
              <Button kind="secondary" tabIndex={-1} aria-label="Back a bar" title="Back a bar (←)" aria-keyshortcuts="ArrowLeft" style={cornerButton} onClick={() => rewindRef.current(-1)} data-testid="bar-back">
                ◀
              </Button>
              <Button kind="secondary" tabIndex={-1} aria-label="Ahead a bar" title="Ahead a bar (→)" aria-keyshortcuts="ArrowRight" style={cornerButton} onClick={() => rewindRef.current(1)} data-testid="bar-ahead">
                ▶
              </Button>
            </>
          )}
          {!isTest && (
            <Button kind="secondary" tabIndex={-1} aria-label="Pause" title="Pause (Esc)" aria-keyshortcuts="Escape" style={cornerButton} onClick={() => pauseRef.current("esc")} data-testid="pause-button">
              ❚❚
            </Button>
          )}
        </div>
      )}
      {phase === "playing" && (
        <PauseMenu
          mode={pauseMode}
          count={countdown}
          beatMs={loaded ? msPerBeat(loaded.chart.bpm) : 500}
          onResume={() => pauseRef.current("resume")}
          onRetry={() => pauseRef.current("retry")}
          onQuit={() => pauseRef.current("quit")}
          status={!isTest && <PauseLights midi={midiStatus} />}
        />
      )}
      {phase !== "playing" && (
        <div style={overlay}>
          {/* Loading and a bad song link in the Duo kit; settings live in the Options drawers, not here (#889, #890). */}
          {phase === "loading" && <MonoLabel style={{ margin: "auto", fontSize: "clamp(13px, 1vw, 18px)" }}>Loading chart…</MonoLabel>}
          {phase === "error" && (
            <Panel style={{ margin: "auto", padding: "clamp(20px, 2.4vw, 44px)", display: "flex", flexDirection: "column", gap: "2.4vh", alignItems: "flex-start", maxWidth: "min(640px, 90vw)" }}>
              <p role="alert" style={stateTitle}>
                {error}
              </p>
              <Link href="/" {...kitButton("primary")}>
                Songs
              </Link>
            </Panel>
          )}
          {phase === "ready" && loaded && (
            <StartScreen
              plugins={plugins}
              panel={(p) => p.startPanel?.(loaded)}
              onStart={start}
              onLatency={onLatency}
              status={!isTest && <p data-capture-hide>{midiStatus}</p>}
            />
          )}
          {phase === "results" && results && (
            <ResultsLayout
              results={results}
              title={loaded?.chart.title}
              composer={loaded?.chart.composer}
              scored={!(loaded && isWaitMode(loaded.params))}
              score={score}
              timing={timing && <TimingPanel timing={timing} latency={latency} onLatency={onLatency} />}
              plugins={take && loaded ? plugins : []}
              panel={(p) => take && loaded && p.resultsPanel?.({ ...loaded, take, results, retry: start })}
              onRetry={start}
              onLatency={onLatency}
              status={!isTest && <p data-capture-hide>{midiStatus}</p>}
            />
          )}
        </div>
      )}
    </main>
  );
}

// How early or late the take was (timing-feedback). Only numbers computed from this take.
function TimingPanel({ timing, latency, onLatency }: { timing: TimingSummary; latency: number; onLatency: (ms: number) => void }) {
  const suggested = timing.suggestedLatencyMs;
  return (
    <div data-testid="timing" style={{ lineHeight: 1.6 }}>
      {describeTiming(timing).map((line) => (
        <div key={line}>{line}</div>
      ))}
      {suggested !== null && suggested !== latency && (
        <div data-capture-hide style={{ marginTop: 12 }}>
          <Button kind="secondary" onClick={() => onLatency(suggested)}>
            Set latency offset to {suggested} ms
          </Button>
          <div style={{ fontSize: 13, color: "var(--pa-ink-dim)", marginTop: 6 }}>
            Shifts every press, so it also hides a habit of rushing or dragging.
          </div>
        </div>
      )}
      {suggested !== null && suggested === latency && (
        <div data-capture-hide style={{ fontSize: 13, color: "var(--pa-ink-dim)", marginTop: 8 }}>
          Latency offset set to {latency} ms. Press Retry to use it.
        </div>
      )}
    </div>
  );
}

const canvasStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
// Read by screen readers, not drawn: the usual visually hidden box.
const srOnly: React.CSSProperties = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", margin: -1 };
// The error screen's line, in the kit's display type (upright, condensed).
const stateTitle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--pa-font-display), system-ui, sans-serif",
  fontStretch: "75%",
  fontWeight: 700,
  fontSize: "clamp(24px, 2.4vw, 44px)",
  lineHeight: 1.1,
  color: "var(--pa-ink)",
};

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

// The play corner (mouse-first): square kit buttons, the only way to pause or rewind with a mouse. Sized with the
// window (about 45 px at 1080p) and under the HUD band (hudLayout's clamp(44, 11% of the judgment line, 84) px, about
// 8.4vh), clear of its badge and the beat track's status line (#888).
const corner: React.CSSProperties = { position: "fixed", top: "calc(clamp(44px, 8.4vh, 84px) + 8px)", right: 12, display: "flex", gap: 6, zIndex: 5 };
const cornerButton: React.CSSProperties = {
  width: "clamp(36px, 4.2vh, 56px)",
  height: "clamp(36px, 4.2vh, 56px)",
  padding: 0,
  fontSize: "clamp(14px, 1.8vh, 22px)",
  background: "color-mix(in srgb, var(--pa-panel) 80%, transparent)",
  color: "var(--pa-ink)", // full ink: read from playing distance
};
