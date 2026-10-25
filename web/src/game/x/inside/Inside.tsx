"use client";
// /inside (spec: inside, #1226): a grand's action, driven by the DGX. Live keys are drawn from their note-on, since
// a note-on arrives after the strike; Play Moonlight knows its notes ahead and draws each approach to land on the
// note's send time. The page holds its own MIDI access so it can read the pedal (core input drops CCs).
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart } from "../../../contracts";
import { keysDevice } from "../../core/input";
import { KEYS_VELOCITY } from "../../core/settings";
import { Brackets, Button, DataCell, kitChip, MonoLabel, Panel } from "../../duo-tokens";
import { echoGuard } from "../../hand-mode/hands";
import { PIANO_NAME } from "../../laptop-sound";
import { loadPedal } from "../../pedal";
import { createSimMidiAccess, installSim } from "../../sim/fake";
import { AHEAD_MS, runGuard, silence, type Out } from "../composers-hands/rolls";
import { KeyAction, Rail, ring, snap, type Phase, type Pose } from "./action";
import { SOURCE } from "./geometry";
import { makeInside, type InsideScene, type View } from "./scene";
import { LEAD_MS, schedule, sendsIn, SONG } from "./schedule";
import css from "./inside.module.css";

const LOW = 21; // A0: key 0 of 88
const AHEAD_ACTION_MS = 400; // the action is fed further ahead than the piano, so a pp approach (the slowest) is drawn whole
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const noteName = (p: number) => `${NAMES[p % 12]}${Math.floor(p / 12) - 1}`;
const PHASE: Record<Phase, string> = {
  rest: "At rest",
  approach: "Jack lifts",
  flight: "Let-off",
  strike: "Strike",
  rebound: "Rebound",
  checked: "Checked",
  repetition: "Repetition",
  return: "Return",
};

declare global {
  interface Window {
    __insideSim?: ReturnType<typeof createSimMidiAccess>;
    __inside?: { workMs: number[]; view: View; playing: boolean };
  }
}

interface Live {
  keys: KeyAction[];
  rail: Rail;
  amps: number[];
  latest: number; // the key the cutaway shows
}
const fresh = (): Live => ({ keys: Array.from({ length: 88 }, () => new KeyAction()), rail: new Rail(), amps: Array(88).fill(0), latest: 39 });

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

async function midiAccess(): Promise<MIDIAccess | null> {
  try {
    return navigator.requestMIDIAccess ? await navigator.requestMIDIAccess() : null;
  } catch {
    return null;
  }
}

export function Inside() {
  const params = useSearchParams();
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLUListElement>(null);
  const scene = useRef<InsideScene | null>(null);
  const live = useRef<Live>(fresh());
  const out = useRef<Out | null>(null);
  const echo = useRef(echoGuard());
  const stopRef = useRef<() => void>(() => {});
  const [view, setView] = useState<View>("cutaway");
  const [input, setInput] = useState("Looking for the piano…");
  const [playing, setPlaying] = useState(false);
  const [noWebGL, setNoWebGL] = useState(false);
  const [readout, setReadout] = useState<{ phase: Phase; key: number; velocity: number | null }>({ phase: "rest", key: 39 + LOW, velocity: null });
  const velocity = useRef<number | null>(null);

  // ?midi=sim: /sim's fake piano stands in for the DGX, so a check can play keys and the pedal into the page.
  useEffect(() => {
    if (params.get("midi") !== "sim") return;
    const sim = createSimMidiAccess();
    installSim(sim);
    window.__insideSim = sim;
  }, [params]);

  const press = useCallback((pitch: number, v: number, at: number, ahead = false) => {
    const k = pitch - LOW;
    if (k < 0 || k > 87) return;
    live.current.keys[k].press(at, v, ahead);
    live.current.latest = k;
    velocity.current = v;
  }, []);
  const release = useCallback((pitch: number, at: number) => {
    const k = pitch - LOW;
    if (k >= 0 && k <= 87) live.current.keys[k].release(at);
  }, []);

  // The DGX in (notes and CC64) and out, and laptop keys at a fixed velocity.
  useEffect(() => {
    let input: MIDIInput | null = null;
    let gone = false;
    const keys = keysDevice(60);
    void keys.start((e) => (e.type === "on" ? press(e.pitch, KEYS_VELOCITY, e.timeMs) : release(e.pitch, e.timeMs)));
    (async () => {
      const access = await midiAccess();
      if (gone) return;
      const ins = access ? [...access.inputs.values()] : [];
      const outs = access ? [...access.outputs.values()] : [];
      input = ins.find((i) => i.name?.includes(PIANO_NAME)) ?? ins[0] ?? null;
      out.current = ((outs.find((o) => o.name?.includes(PIANO_NAME)) ?? outs[0]) as unknown as Out) ?? null;
      setInput(input ? `Piano: ${input.name ?? "MIDI in"}` : "No piano: laptop keys A to ; play from middle C");
      if (!input) return;
      input.onmidimessage = (m) => {
        const d = m.data;
        if (!d || d.length < 3) return;
        const cmd = d[0] & 0xf0;
        const at = m.timeStamp;
        if (cmd === 0xb0 && d[1] === 64) return void (echo.current.isEcho(300, at) || live.current.rail.set(at, d[2]));
        if (cmd !== 0x90 && cmd !== 0x80) return;
        const on = cmd === 0x90 && d[2] > 0;
        if (echo.current.isEcho(on ? d[1] : d[1] + 128, at)) return; // the piano echoing what we sent
        if (on) press(d[1], d[2], at);
        else release(d[1], at);
      };
    })();
    return () => {
      gone = true;
      keys.stop();
      if (input) input.onmidimessage = null;
    };
  }, [press, release]);

  // The scene and its frame loop.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const s = makeInside(c, labels.current);
    if (!s) return setNoWebGL(true);
    scene.current = s;
    // Reduced motion, followed live: the OS setting can change mid-visit.
    const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
    let still = !!mq?.matches;
    const onMotion = (e: MediaQueryListEvent) => void (still = e.matches);
    mq?.addEventListener("change", onMotion);
    const poses: Pose[] = Array.from({ length: 88 }, () => ({ key: 0, hammer: 0, damper: 0, phase: "rest" as Phase }));
    const timing = process.env.NODE_ENV !== "production" ? (window.__inside = { workMs: [] as number[], view: "cutaway" as View, playing: false }) : null;
    let last = performance.now();
    let raf = 0;
    let shown = "";
    const fit = () => {
      const { width, height } = c.getBoundingClientRect();
      s.resize(width, height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    const draw = () => {
      const t0 = performance.now();
      const L = live.current;
      for (let k = 0; k < 88; k++) {
        const p = still ? snap(L.keys[k].pose(t0)) : L.keys[k].pose(t0);
        const rail = L.rail.forKey(t0, k);
        const damper = Math.max(p.damper, still ? (rail > 0.5 ? 1 : 0) : rail);
        poses[k] = { ...p, damper };
        const v = L.keys[k].struckBetween(last, t0);
        L.amps[k] = v ? Math.max(L.amps[k], v / 127) : ring(L.amps[k], t0 - last, damper);
        if (t0 - last > 1000) L.keys[k].forget(t0);
      }
      // The cutaway follows the key whose stroke began last.
      let latest = L.latest;
      let begun = -Infinity;
      for (let k = 0; k < 88; k++) {
        const b = L.keys[k].begunAt(t0);
        if (b !== null && b > begun) [begun, latest] = [b, k];
      }
      s.frame(poses, L.amps, latest, t0, still);
      last = t0;
      if (timing) timing.workMs.push(performance.now() - t0);
      const next = `${poses[latest].phase}:${latest}`;
      if (next !== shown) {
        shown = next;
        setReadout({ phase: poses[latest].phase, key: latest + LOW, velocity: velocity.current });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      mq?.removeEventListener("change", onMotion);
      ro.disconnect();
      s.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setView(view, reducedMotion());
    if (window.__inside) window.__inside.view = view;
  }, [view]);

  const runs = useRef(runGuard()).current;
  const stop = useCallback(() => (runs.cancel(), stopRef.current()), [runs]);

  const play = useCallback(async () => {
    stopRef.current();
    const current = runs.claim();
    const res = await fetch(`/songs/${SONG}/chart.json`);
    if (!current()) return;
    if (!res.ok) return setInput("Moonlight's chart didn't load.");
    const chart: Chart = await res.json();
    const sched = schedule(chart, await loadPedal(SONG));
    if (!current()) return;
    const piano = out.current;
    if (!piano) setInput("No piano output: the action plays silent");
    const start = performance.now() + LEAD_MS;
    let sentTo = -Infinity;
    let fedTo = -Infinity;
    const tick = () => {
      const now = performance.now() - start;
      // The action first, further ahead, so each approach starts before its note is even queued on the piano.
      for (const s of sendsIn(sched, fedTo, now + AHEAD_ACTION_MS)) {
        const at = start + s.atMs;
        if (s.bytes[0] === 0x90) press(s.bytes[1], s.bytes[2], at, true);
        else if (s.bytes[0] === 0x80) release(s.bytes[1], at);
        else live.current.rail.set(at, s.bytes[2]);
      }
      fedTo = now + AHEAD_ACTION_MS;
      for (const s of sendsIn(sched, sentTo, now + AHEAD_MS)) {
        const at = start + s.atMs;
        piano?.send(s.bytes, at);
        echo.current.sent(s.bytes[0] === 0xb0 ? 300 : s.bytes[0] === 0x80 ? s.bytes[1] + 128 : s.bytes[1], at);
      }
      sentTo = now + AHEAD_MS;
      if (now > sched.endMs + 1500) stopRef.current();
    };
    tick();
    const timer = setInterval(tick, 25);
    stopRef.current = () => {
      clearInterval(timer);
      silence(piano, performance.now());
      live.current = fresh(); // drop the strikes fed ahead, so nothing moves after Stop
      echo.current.clear();
      setPlaying(false);
      if (window.__inside) window.__inside.playing = false;
      stopRef.current = () => {};
    };
    setPlaying(true);
    if (window.__inside) window.__inside.playing = true;
  }, [press, release, runs]);

  // Stop on unmount and pagehide, so leaving mid-piece leaves no note or pedal down.
  useEffect(() => {
    addEventListener("pagehide", stop);
    return () => {
      removeEventListener("pagehide", stop);
      stop();
    };
  }, [stop]);

  return (
    <main className={css.screen} data-testid="inside-page">
      <header className={css.top}>
        <h1 className={css.wordmark}>Inside the Piano</h1>
        <Link href="/lab" className={css.back}>
          Back to the Lab
        </Link>
      </header>
      <aside className={css.slate}>
        <Brackets style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
          <Panel style={{ padding: "clamp(16px, 1.6vw, 30px)", flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "2vh" }}>
            <MonoLabel style={{ fontSize: READ }}>A grand&apos;s action, double escapement</MonoLabel>
            <p className={css.frame} data-testid="inside-framing">
              The DGX is a digital piano with no hammers. This is the acoustic action its sound is modeled on, moved by
              the keys you play.
            </p>
            <p className={css.phase} role="status" aria-live="off" data-testid="inside-phase">
              {PHASE[readout.phase]}
            </p>
            <Panel style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", flex: "none" }}>
              <DataCell label={<span className={css.cell}>KEY</span>} value={noteName(readout.key)} size={34} style={{ borderLeft: "none" }} />
              <DataCell label={<span className={css.cell}>VELOCITY</span>} value={readout.velocity ?? "—"} size={34} />
            </Panel>
            <nav className={css.views} aria-label="View">
              {(["cutaway", "row"] as const).map((v) => {
                const chip = kitChip(v === view);
                return (
                  <button key={v} type="button" className={chip.className} style={{ ...chip.style, fontSize: READ }} aria-pressed={v === view} onClick={() => setView(v)} data-testid={`inside-view-${v}`}>
                    {v === "cutaway" ? "One key" : "All 88"}
                  </button>
                );
              })}
            </nav>
            <Button kind="primary" onClick={() => (playing ? stop() : void play())} data-testid="inside-play" style={{ fontSize: READ, padding: "1.4vh 0" }}>
              {playing ? "STOP" : "PLAY MOONLIGHT"}
            </Button>
            <p className={css.status} role="status" data-testid="inside-input">
              {input}
            </p>
            <p className={css.source} data-testid="inside-source">
              {SOURCE.label}
              {SOURCE.url && (
                <>
                  {" "}
                  <a href={SOURCE.url} target="_blank" rel="noreferrer">
                    ↗
                  </a>
                </>
              )}
            </p>
          </Panel>
        </Brackets>
      </aside>
      <section className={css.stage} aria-label={view === "cutaway" ? "One key's action, in section" : "All 88 hammers and dampers"}>
        <canvas ref={canvas} className={css.canvas} data-testid="inside-canvas" />
        <ul ref={labels} className={css.labels} aria-hidden hidden={view !== "cutaway"} />
        {noWebGL && <p className={css.notice}>This browser has no WebGL, so the action can&apos;t be drawn.</p>}
      </section>
    </main>
  );
}

const READ = "clamp(16px, 2.25vh, 24px)";
