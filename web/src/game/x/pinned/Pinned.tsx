// /musicbox (spec: pinned): your take as a brass music-box cylinder. The crank plays it on the laptop through the
// comb voice, one revolution for the whole take; Macro moves in on the pluck point; Export writes the STL.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, MonoLabel } from "../../duo-tokens";
import { crankAudio } from "./crank-audio";
import { getPrefs } from "../../sound";
import { hz, pinTake } from "./cylinder";
import { makeMusicBox, type MusicBox } from "./scene";
import { model, writeStl } from "./stl";
import { loadDemo, loadLast, type Saved } from "./take";
import { renderTooth, voiceSettings } from "./voice";
import styles from "./pinned.module.css";

const LEAD_S = 0.6; // the drum turns into its first pin
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Pinned() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<MusicBox | null>(null);
  const [audio] = useState(() => crankAudio()); // one context for every crank, closed on leaving
  const runRef = useRef<{ t0: number } | null>(null); // the crank in progress
  const turnRef = useRef(0);
  // The take: the one /play saved, else (below) a scripted perfect run of the demo song. Client-only page.
  const [saved, setSaved] = useState<Saved | null>(() => (new URLSearchParams(location.search).get("take") === "last" ? loadLast() : null));
  const [failed, setFailed] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [macro, setMacro] = useState(false);
  const [noGl] = useState(() => !document.createElement("canvas").getContext("webgl2"));
  const [still] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches); // client-only page
  const pinned = useMemo(() => (saved ? pinTake(saved.take.events) : null), [saved]);

  useEffect(() => {
    if (saved) return;
    let live = true;
    void loadDemo().then((r) => live && ("saved" in r ? setSaved(r.saved) : setFailed(r.error)));
    return () => void (live = false);
  }, [saved]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pinned) return;
    const box = makeMusicBox(canvas, pinned);
    if (!box) return; // no WebGL: noGl says so
    boxRef.current = box;
    const fit = () => box.resize(canvas.clientWidth, canvas.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    const lengthS = pinned.lengthMs / 1000;
    let raf = 0;
    const loop = () => {
      const run = runRef.current;
      if (run && audio.ctx) {
        const t = audio.ctx.currentTime - run.t0;
        turnRef.current = Math.min(2 * Math.PI, (t / lengthS) * 2 * Math.PI);
        if (t > lengthS + voiceSettings.lengthS) {
          // the natural end: stop()'s steps, inlined so the effect doesn't rerun on every render
          runRef.current = null;
          audio.stop();
          setPlaying(false);
        }
      }
      box.frame(turnRef.current, still);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      box.dispose();
      boxRef.current = null;
    };
  }, [pinned, still, audio]);

  useEffect(() => () => audio.close(), [audio]);

  function stop() {
    runRef.current = null;
    audio.stop();
    setPlaying(false);
  }

  // The crank: every pin is scheduled on the audio clock up front, at one strength, and the drum follows that clock.
  function crank() {
    if (!pinned) return;
    if (playing) return stop();
    const prefs = getPrefs();
    let t0 = 0;
    audio.start(prefs.muted ? 0 : prefs.volume, (ctx, out) => {
      const voices = pinned.teeth.map((p) => {
        const samples = renderTooth(hz(p), ctx.sampleRate);
        const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buf.copyToChannel(samples, 0);
        return buf;
      });
      t0 = ctx.currentTime + LEAD_S;
      return pinned.pins.map((pin) => {
        const src = ctx.createBufferSource();
        src.buffer = voices[pin.tooth];
        src.connect(out);
        src.start(t0 + pin.timeMs / 1000);
        return src;
      });
    });
    runRef.current = { t0 };
    setPlaying(true);
  }

  function toggleMacro() {
    boxRef.current?.setMacro(!macro, still);
    setMacro(!macro);
  }

  function exportStl() {
    if (!pinned || !saved) return;
    const blob = new Blob([writeStl(model(pinned), `${saved.chart.id} pinned`)], { type: "model/stl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${saved.chart.id.replace(/\//g, "-")}-pinned.stl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const waiting = failed ? "—" : "…"; // nothing is coming once the load failed
  return (
    <main className={styles.page} data-testid="pinned">
      <canvas ref={canvasRef} className={styles.canvas} data-testid="pinned-canvas" aria-label="Your take as a brass music-box cylinder above a steel comb" />
      {noGl && <p className={styles.noGl}>This browser has no WebGL, so there&apos;s no cylinder to show. Chrome has it.</p>}

      <header className={styles.rail}>
        <h1 className={styles.mark}>Pinned</h1>
        <dl className={styles.data}>
          <div>
            <dt>Song</dt>
            <dd data-testid="pinned-song">{saved?.chart.title ?? waiting}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{pinned ? clock(pinned.lengthMs) : waiting}</dd>
          </div>
          <div>
            <dt>Pins</dt>
            <dd>{pinned?.pins.length ?? waiting}</dd>
          </div>
          <div>
            <dt>Teeth</dt>
            <dd>{pinned?.teeth.length ?? waiting}</dd>
          </div>
        </dl>
        <LoadError error={failed} />
        {saved?.scripted && <MonoLabel>A scripted take, a perfect run. Pin your own from the results with Pinned on in the Lab.</MonoLabel>}
        <div className={styles.actions}>
          <Toggles playing={playing} macro={macro} onCrank={crank} onMacro={toggleMacro} crankOff={!pinned} macroOff={!pinned || noGl} />
          <Button kind="secondary" onClick={exportStl} disabled={!pinned} data-testid="pinned-export">
            Export STL
          </Button>
        </div>
      </header>

      <p className={styles.notes}>
        <span>A music box plays every note at one strength.</span>
        <span>The STL is a model, not fitted to a commercial movement.</span>
        {!failed && <span className={styles.hint}>Drag to turn the view.</span>}
      </p>
    </main>
  );
}

// The two toggles say one thing: each label names what a press does next ("Stop", "Wide"), and neither carries
// aria-pressed, which made a reader hear "Stop, pressed" (#1200, decision musicbox-polish-toggles). Each keeps the
// width of its longer label, so the row doesn't jump as they change: both labels share one grid cell, and the idle one
// is hidden (visibility, so it leaves the accessible name too).
export function Toggles(p: { playing: boolean; macro: boolean; onCrank(): void; onMacro(): void; crankOff: boolean; macroOff: boolean }) {
  return (
    <>
      <Button onClick={p.onCrank} disabled={p.crankOff} data-testid="pinned-crank">
        <Swap on={p.playing} off="Turn the crank" onLabel="Stop" />
      </Button>
      <Button kind="secondary" onClick={p.onMacro} disabled={p.macroOff} data-testid="pinned-macro">
        <Swap on={p.macro} off="Macro" onLabel="Wide" />
      </Button>
    </>
  );
}

function Swap({ on, off, onLabel }: { on: boolean; off: string; onLabel: string }) {
  return (
    <span className={styles.swap}>
      <span data-idle={on || undefined}>{off}</span>
      <span data-idle={!on || undefined}>{onLabel}</span>
    </span>
  );
}

// The demo chart's failed load, said once in the rail (#1329): ink, not a judgment colour, which stays off chrome.
export const LoadError = ({ error }: { error: string | null }) =>
  error ? (
    <p className={styles.failed} role="alert" data-testid="pinned-failed">
      {error}
    </p>
  ) : null;
