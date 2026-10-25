"use client";
// /composers-hands (spike: composers-hands, #1069): the composer's own piano roll on the piano. Listen plays it whole;
// Duet plays his left hand while you play the right, judged by core's Judge against his timing; Compare draws his tempo,
// the score's metronome and yours. The slate on the left is the roll's box label: maker, number, performer, year.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chart, GameEvent, Results } from "../../../contracts";
import { drawHighway, makeLayout } from "../../core/highway";
import { midiDevice, keysDevice } from "../../core/input";
import { Judge } from "../../core/judge";
import { msPerBeat } from "../../core/settings";
import { Brackets, Button, canvasFonts, DataCell, kitChip, MonoLabel, Panel } from "../../duo-tokens";
import { echoGuard, splitHands } from "../../hand-mode/hands";
import { hud } from "../../hud";
import { PIANO_NAME } from "../../laptop-sound";
import { createSimMidiAccess, installSim } from "../../sim/fake";
import { fitCurve, tempoCurveSettings } from "../../tempo-curve";
import { handL, handR, inkDim } from "../../ui-tokens";
import { dtw, sequence } from "./align";
import { parseMidi, rollSettings, secondsChart, splitPoints, type Roll } from "./roll";
import { AHEAD_MS, ROLLS, sendsBetween, silence, testRoll, type Out } from "./rolls";
import css from "./composers-hands.module.css";

type Mode = "listen" | "duet" | "compare";

const LEAD_MS = 1500; // from Play to the roll's first instant: time to find the keys
const splitKey = (id: string) => `pianoArcade.composersHands.split.${id}`;
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const noteName = (p: number) => `${NAMES[Math.round(p) % 12]}${Math.floor(Math.round(p) / 12) - 1}`;

declare global {
  interface Window {
    __composersHandsSim?: ReturnType<typeof createSimMidiAccess>;
    __composersHands?: { startPerf: number; mode: Mode; rollOnMs: number[]; ended: boolean; lateMs: number[]; right: [number, number][] }; // lateMs: how far past its own time each note-on was handed to the piano
  }
}

async function pianoOutput(): Promise<Out | null> {
  try {
    const access = await navigator.requestMIDIAccess();
    const outs = [...access.outputs.values()];
    return ((outs.find((o) => o.name?.includes(PIANO_NAME)) ?? outs[0]) as unknown as Out) ?? null;
  } catch {
    return null;
  }
}

const readNudges = (id: string): Record<number, number> => {
  try {
    return JSON.parse(localStorage.getItem(splitKey(id)) ?? "{}");
  } catch {
    return {};
  }
};

export function ComposersHands() {
  const params = useSearchParams();
  const songId = params.get("song") ?? "rachmaninoff-prelude-cs";
  const info = ROLLS[songId];
  const [chart, setChart] = useState<Chart | null>(null);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [isTest, setIsTest] = useState(params.get("roll") === "chart");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("listen");
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [yours, setYours] = useState<{ t: number; p: number }[]>([]);
  const [nudges, setNudges] = useState<Record<number, number>>({});
  const [passage, setPassage] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});

  // ?midi=sim: /sim's fake piano, so a check reads what was sent and when (Validation c).
  useEffect(() => {
    if (params.get("midi") !== "sim") return;
    const sim = createSimMidiAccess();
    installSim(sim);
    window.__composersHandsSim = sim; // a check plays the right hand through it
  }, [params]);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await fetch(`/songs/${songId}/chart.json`);
      if (!r.ok) throw new Error(`No song called "${songId}".`);
      const c: Chart = await r.json();
      if (!live) return;
      setChart(c);
      setNudges(readNudges(songId)); // after the fetch, on the client: the server has no storage
      if (isTest || !info) return setRoll(testRoll(c));
      const m = await fetch(info.file);
      if (!m.ok) throw new Error("local");
      const parsed = parseMidi(new Uint8Array(await m.arrayBuffer()));
      if (live) setRoll(parsed);
    })().catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [songId, info, isTest]);

  const splits = useMemo(() => (roll ? splitPoints(roll.notes, nudges) : []), [roll, nudges]);
  const seconds = useMemo(
    () => (roll && chart ? secondsChart(roll, splits, { id: `composers-hands/${songId}`, title: chart.title, composer: chart.composer, source: info?.page ?? "test roll" }) : null),
    [roll, chart, splits, songId, info],
  );
  // His timing against the score: each roll note the alignment pairs with an equal pitch, at its chart time.
  const his = useMemo(() => {
    if (!roll || !chart) return null;
    const mpb = msPerBeat(chart.bpm);
    const r = sequence(roll.notes.map((n, i) => ({ pitch: n.pitch, ms: n.onMs, i })));
    const c = sequence(chart.notes.map((n) => ({ pitch: n.pitch, ms: n.beat * mpb })));
    const chartAt = new Map<number, number>();
    for (const [i, j] of dtw(r, c)) if (i >= 0 && j >= 0 && r[i].pitch === c[j].pitch) chartAt.set(r[i].i!, c[j].ms);
    return chartAt;
  }, [roll, chart]);

  const nudge = (by: number) => {
    const next = { ...nudges, [passage]: (nudges[passage] ?? 0) + by };
    setNudges(next);
    try {
      localStorage.setItem(splitKey(songId), JSON.stringify(next));
    } catch {
      // storage blocked: the nudge lasts this visit
    }
  };

  const stop = useCallback(() => stopRef.current(), []);

  const play = useCallback(
    async (m: "listen" | "duet") => {
      if (!roll || !seconds) return;
      stopRef.current();
      setResults(null);
      setMode(m);
      const out = await pianoOutput();
      setStatus(out ? `Piano: ${out.name ?? "MIDI out"}` : "No piano output: the highway plays silent");
      const startPerf = performance.now() + LEAD_MS;
      const endMs = roll.notes.reduce((e, n) => Math.max(e, n.offMs), 0);
      const { judged, playback } = splitHands(seconds, m === "duet" ? "R" : "both");
      const played = m === "duet" ? playback.map((n) => roll.notes[Number(n.id.slice(1))]) : roll.notes;
      const echo = echoGuard();
      const plugin = hud();
      plugin.transformChart?.(judged, new URLSearchParams());
      const onEvent = (e: GameEvent) => plugin.onEvent?.(e);
      const judge = m === "duet" ? new Judge(judged, onEvent) : null;
      if (judge) onEvent({ type: "songStart", atMs: 0 } as GameEvent);
      const pressed = new Set<number>();
      let index = 0;
      const devices = m === "duet" ? [midiDevice(setStatus), keysDevice(Math.min(...judged.notes.map((n) => n.pitch)))] : [];
      for (const d of devices)
        void d.start((e) => {
          if (e.type === "off") return void pressed.delete(e.pitch);
          if (echo.isEcho(e.pitch, e.timeMs)) return; // the piano echoing his left hand back
          pressed.add(e.pitch);
          judge?.press(e.pitch, e.timeMs - startPerf, index++);
        });
      const hook = (window.__composersHands = { startPerf, mode: m, rollOnMs: played.map((n) => n.onMs), ended: false, lateMs: [] as number[], right: m === "duet" ? judged.notes.map((n) => [n.pitch, n.beat * 1000] as [number, number]) : [] });

      let queuedTo = -LEAD_MS;
      const pedal = m === "listen" ? roll.pedal : [];
      const tick = () => {
        const to = performance.now() - startPerf + AHEAD_MS;
        for (const s of sendsBetween(played, pedal, queuedTo, to)) {
          out?.send(s.bytes, startPerf + s.atMs);
          if (s.bytes[0] !== 0x90) continue;
          echo.sent(s.bytes[1], startPerf + s.atMs);
          hook.lateMs.push(Math.max(0, performance.now() - (startPerf + s.atMs)));
        }
        queuedTo = to;
        if (to - AHEAD_MS > endMs + 1200) finish(); // here, not in the frame loop: a hidden tab stops drawing
      };
      tick();
      const timer = setInterval(tick, 25);

      let raf = 0;
      const ctx = canvas.current?.getContext("2d");
      const draw = () => {
        const nowMs = performance.now() - startPerf;
        const c = canvas.current;
        if (ctx && c) {
          const dpr = window.devicePixelRatio || 1;
          const { width, height } = c.getBoundingClientRect();
          if (c.width !== Math.round(width * dpr)) [c.width, c.height] = [Math.round(width * dpr), Math.round(height * dpr)];
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const layout = makeLayout(seconds, width, height, 0);
          // Listen lights the keys the roll holds now, in their hand's color; Duet lights yours, and his as they sound.
          const sounding = played.filter((n) => n.onMs <= nowMs && n.offMs > nowMs).map((n) => n.pitch);
          const lit = new Set<number>([...sounding, ...pressed]);
          const pressedHand = new Map(sounding.map((p) => [p, p < (splits[Math.floor(nowMs / rollSettings.passageMs)] ?? 60) ? ("L" as const) : ("R" as const)]));
          judge?.advance(nowMs);
          drawHighway(ctx, layout, seconds, { nowMs, noteState: judge?.noteState ?? new Map(), pressed: lit, pressedHand, latest: null, countInBeat: null });
          if (judge) plugin.draw?.(ctx, { nowMs, lowPitch: layout.lowPitch, highPitch: layout.highPitch, judgmentLineY: layout.judgmentLineY, keyX: layout.keyX, width, height });
          setPassage(Math.max(0, Math.floor(nowMs / rollSettings.passageMs)));
        }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);

      const finish = () => {
        stopRef.current();
        if (!judge) return;
        const r = judge.finish(endMs);
        setResults(r);
        // Your timing against the score: each of your hits, at the chart time of the roll note it hit.
        const pts: { t: number; p: number }[] = [];
        for (const j of r.judgments) {
          const i = Number(j.noteId.slice(1));
          const t = his?.get(i);
          if (j.offsetMs !== null && t !== undefined) pts.push({ t, p: roll.notes[i].onMs + j.offsetMs });
        }
        setYours(pts);
        setMode("compare");
      };
      stopRef.current = () => {
        clearInterval(timer);
        cancelAnimationFrame(raf);
        for (const d of devices) d.stop();
        silence(out, performance.now());
        if (window.__composersHands) window.__composersHands.ended = true;
        setPlaying(false);
        stopRef.current = () => {};
      };
      setPlaying(true);
    },
    [roll, seconds, splits, his],
  );

  // Unmount and pagehide stop it too, so closing the tab mid-roll leaves no note or pedal down.
  useEffect(() => {
    const leave = () => stopRef.current();
    addEventListener("pagehide", leave);
    return () => {
      removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  // At rest the stage shows the roll's opening, as it will fall, rather than an empty field.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (playing || mode === "compare" || !ctx || !c || !seconds) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    [c.width, c.height] = [Math.round(width * dpr), Math.round(height * dpr)];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const first = seconds.notes.reduce((m, n) => Math.min(m, n.beat * 1000), Infinity);
    drawHighway(ctx, makeLayout(seconds, width, height, 0), seconds, { nowMs: first - 400, noteState: new Map(), pressed: new Set(), latest: null, countInBeat: null });
  }, [playing, mode, seconds]);

  // Compare: three tempo lines over the score's time, in bpm.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (mode !== "compare" || !ctx || !c || !chart || !roll || !his) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    [c.width, c.height] = [Math.round(width * dpr), Math.round(height * dpr)];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCompare(ctx, width, height, chart, [...his].map(([i, t]) => ({ t, p: roll.notes[i].onMs })), yours);
  }, [mode, chart, roll, his, yours]);

  if (error)
    return (
      <main className={css.screen}>
        <Header />
        <section className={css.notice}>
          <h2>{error === "local" ? "This roll is on Eric's machine only" : error}</h2>
          {error === "local" && (
            <>
              <p>The roll&apos;s license is unclear, so it isn&apos;t committed. The test roll plays our own chart at its own tempo, to try the page.</p>
              <Button kind="secondary" onClick={() => (setError(null), setIsTest(true))} data-testid="ch-test-roll">
                Use the test roll
              </Button>
            </>
          )}
        </section>
      </main>
    );

  const split = splits[passage];
  return (
    <main className={css.screen}>
      <Header />
      <aside className={css.slate}>
        <Brackets style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
          <Panel style={{ padding: "clamp(16px, 1.6vw, 30px)", flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "1.6vh" }}>
            <MonoLabel style={{ fontSize: READ }}>{isTest ? "Test roll · our chart, not a performance" : "The roll"}</MonoLabel>
            <h2 className={css.title}>{chart?.title ?? "…"}</h2>
            <p className={css.performer} data-testid="ch-performer">
              {isTest || !info ? "No performer: built from our score" : <>Played by {info.performer}</>}
            </p>
            {!isTest && info && (
              <Panel style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", flex: "none" }}>
                <DataCell label={<span className={css.cell}>MAKER</span>} value={info.maker} size={34} style={{ borderLeft: "none" }} />
                <DataCell label={<span className={css.cell}>ROLL</span>} value={info.number} size={34} />
                <DataCell label={<span className={css.cell}>YEAR</span>} value={info.year || "—"} size={34} />
              </Panel>
            )}
            {(isTest || !info) && roll && (
              <Panel style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", flex: "none" }}>
                <DataCell label={<span className={css.cell}>NOTES</span>} value={roll.notes.length} size={34} style={{ borderLeft: "none" }} />
                <DataCell label={<span className={css.cell}>LENGTH</span>} value={clock(roll.notes.reduce((e, n) => Math.max(e, n.offMs), 0))} size={34} />
                <DataCell label={<span className={css.cell}>TEMPO</span>} value={chart?.bpm ?? "—"} size={34} />
              </Panel>
            )}
            {roll && !roll.dynamics && <p className={css.note}>This roll records no dynamics</p>}
            <nav className={css.modes} aria-label="Mode">
              {(["listen", "duet", "compare"] as const).map((m) => {
                const chip = kitChip(m === mode);
                return (
                  <button key={m} type="button" className={chip.className} style={{ ...chip.style, fontSize: READ }} disabled={m === "compare" ? !results : playing} aria-pressed={m === mode} onClick={() => setMode(m)} data-testid={`ch-mode-${m}`}>
                    {m === "listen" ? "Listen" : m === "duet" ? "Duet" : "Compare"}
                  </button>
                );
              })}
            </nav>
            <p className={css.line}>
              {mode === "listen" && (isTest || !info ? "The piano plays the test roll: both hands, at the score's tempo." : "The piano plays his roll: both hands, his timing, his pedal.")}
              {mode === "duet" && (isTest || !info ? "The piano plays the left hand. You play the right, judged against the roll's timing." : "He plays the left hand. You play the right, judged against his timing.")}
              {mode === "compare" && results && "Your right hand against the roll's timing. The lines are each tempo, bar by bar."}
            </p>
            {mode === "compare" && results && (
              <Panel style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", flex: "none" }}>
                <DataCell label={<span className={css.cell}>ACCURACY</span>} value={<span data-testid="ch-accuracy">{(results.accuracy * 100).toFixed(1)}%</span>} size={34} style={{ borderLeft: "none" }} />
                <DataCell label={<span className={css.cell}>RANK</span>} value={results.rank} size={34} />
                <DataCell label={<span className={css.cell}>MISSED</span>} value={results.counts.MISS} size={34} />
              </Panel>
            )}
            {mode === "compare" && (
              <Button kind="secondary" onClick={() => play("duet")} style={{ fontSize: READ, padding: "1.4vh 0" }} data-testid="ch-again">
                DUET AGAIN
              </Button>
            )}
            {mode !== "compare" && (
              <Button kind="primary" onClick={() => (playing ? stop() : play(mode))} disabled={!seconds} data-testid="ch-play" style={{ fontSize: READ, padding: "1.4vh 0" }}>
                {playing ? "STOP" : mode === "duet" ? "PLAY THE RIGHT HAND" : "LISTEN"}
              </Button>
            )}
            {mode !== "compare" && split !== undefined && (
              <div className={css.split} data-testid="ch-split">
                <MonoLabel style={{ fontSize: READ }}>
                  Left hand up to {noteName(Math.ceil(split) - 1)}, passage {passage + 1} of {splits.length}
                </MonoLabel>
                <div className={css.splitButtons}>
                  {[
                    ["‹", () => setPassage(Math.max(0, passage - 1)), "Earlier passage"],
                    ["−", () => nudge(-1), "Split a semitone lower"],
                    ["+", () => nudge(1), "Split a semitone higher"],
                    ["›", () => setPassage(Math.min(splits.length - 1, passage + 1)), "Later passage"],
                  ].map(([label, on, title]) => {
                    const chip = kitChip(false);
                    return (
                      <button key={title as string} type="button" className={chip.className} style={{ ...chip.style, fontSize: READ }} title={title as string} aria-label={title as string} disabled={playing && (label === "‹" || label === "›")} onClick={on as () => void}>
                        {label as string}
                      </button>
                    );
                  })}
                  <button type="button" {...kitChip(false)} style={{ ...kitChip(false).style, fontSize: READ }} onClick={() => void navigator.clipboard?.writeText(JSON.stringify({ song: songId, passageMs: rollSettings.passageMs, nudges }))}>
                    Copy JSON
                  </button>
                </div>
              </div>
            )}
            <StatusLine text={status} />
            {!isTest && info && (
              <a className={css.source} href={info.page} target="_blank" rel="noreferrer">
                Source: the IAMMP roll database ↗
              </a>
            )}
          </Panel>
        </Brackets>
      </aside>
      <section className={css.stage} aria-label={mode === "compare" ? "Tempo compared" : "Highway"}>
        <canvas ref={canvas} className={css.canvas} data-testid="ch-canvas" />
        {mode === "compare" && (
          <ul className={css.legend}>
            <li style={{ color: handL }}>{isTest || !info ? "The test roll" : info.performer.split(",")[0]}</li>
            <li style={{ color: inkDim }}>The score, {chart?.bpm} bpm</li>
            <li style={{ color: handR }}>You</li>
          </ul>
        )}
      </section>
    </main>
  );
}

const READ = "clamp(16px, 2.25vh, 24px)";
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

function Header() {
  return (
    <header className={css.top}>
      <h1 className={css.wordmark}>The Composer&apos;s Hands</h1>
      <Link href="/lab" className={css.back}>
        Back to the Lab
      </Link>
    </header>
  );
}

// Local tempo as bpm across the score: the window is tempo-curve's, two bars each side.
function drawCompare(ctx: CanvasRenderingContext2D, w: number, h: number, chart: Chart, hisPts: { t: number; p: number }[], yourPts: { t: number; p: number }[]) {
  ctx.clearRect(0, 0, w, h);
  const mpb = msPerBeat(chart.bpm);
  const end = Math.max(...chart.notes.map((n) => (n.beat + n.duration) * mpb));
  const windowMs = tempoCurveSettings.windowBars * chart.beatsPerBar * mpb;
  const lines: { pts: { t: number; p: number }[]; color: string }[] = [
    { pts: hisPts, color: handL },
    { pts: yourPts, color: handR },
  ];
  const pad = { l: 72, r: 24, t: 72, b: 56 };
  // The curves first, so the scale fits them: a tempo that wavers by 5% should look like it.
  const drawn = lines
    .filter(({ pts }) => pts.length >= tempoCurveSettings.minHits)
    .map(({ pts, color }) => {
      const curve = fitCurve(pts, windowMs);
      const [t0, t1] = [Math.min(...pts.map((q) => q.t)), Math.max(...pts.map((q) => q.t))];
      return { color, samples: Array.from({ length: 201 }, (_, k) => t0 + ((t1 - t0) * k) / 200).map((t) => ({ t, bpm: curve.tempo(t) * chart.bpm })) };
    });
  const all = [chart.bpm, ...drawn.flatMap((d) => d.samples.map((q) => q.bpm))];
  const span = Math.max(chart.bpm * 0.1, Math.max(...all) - Math.min(...all));
  const mid = (Math.max(...all) + Math.min(...all)) / 2;
  const [lo, hi] = [mid - span * 0.65, mid + span * 0.65];
  const x = (t: number) => pad.l + (t / end) * (w - pad.l - pad.r);
  const y = (bpm: number) => pad.t + (1 - (bpm - lo) / (hi - lo)) * (h - pad.t - pad.b);
  ctx.font = canvasFonts.data(Math.max(16, Math.min(24, h * 0.03)));
  ctx.fillStyle = inkDim;
  ctx.textAlign = "right";
  for (const bpm of [lo, chart.bpm, hi]) ctx.fillText(String(Math.round(bpm)), pad.l - 12, y(bpm) + 6);
  ctx.textAlign = "left";
  ctx.fillText("BAR 1", x(0), h - 16);
  ctx.textAlign = "right";
  ctx.fillText(`BAR ${Math.ceil(end / (mpb * chart.beatsPerBar))}`, x(end), h - 16);
  ctx.strokeStyle = inkDim;
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(0), y(chart.bpm));
  ctx.lineTo(x(end), y(chart.bpm));
  ctx.stroke();
  ctx.setLineDash([]);
  for (const { color, samples } of drawn) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    samples.forEach((q, k) => (k ? ctx.lineTo(x(q.t), y(q.bpm)) : ctx.moveTo(x(q.t), y(q.bpm))));
    ctx.stroke();
  }
}

// The piano status (#1207), "No piano output: the highway plays silent" among them, read out when it changes.
export function StatusLine({ text }: { text: string }) {
  return (
    <p className={css.status} role="status" aria-live="polite" data-testid="ch-status">
      {text}
    </p>
  );
}
