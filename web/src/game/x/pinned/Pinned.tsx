// /musicbox (spec: pinned): your take as a brass music-box cylinder. The crank plays it on the laptop through the
// comb voice, one revolution for the whole take; Macro moves in on the pluck point; Export writes the STL.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, MonoLabel } from "../../duo-tokens";
import { getPrefs } from "../../sound";
import { hz, pinTake } from "./cylinder";
import { makeMusicBox, type MusicBox } from "./scene";
import { model, writeStl } from "./stl";
import { DEMO_SONG, demoTake, loadLast, type Saved } from "./take";
import { renderTooth, voiceSettings } from "./voice";
import styles from "./pinned.module.css";

const LEAD_S = 0.6; // the drum turns into its first pin
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Pinned() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<MusicBox | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; sources: AudioBufferSourceNode[]; t0: number } | null>(null);
  const turnRef = useRef(0);
  // The take: the one /play saved, else (below) a scripted perfect run of the demo song. Client-only page.
  const [saved, setSaved] = useState<Saved | null>(() => (new URLSearchParams(location.search).get("take") === "last" ? loadLast() : null));
  const [playing, setPlaying] = useState(false);
  const [macro, setMacro] = useState(false);
  const [noGl] = useState(() => !document.createElement("canvas").getContext("webgl2"));
  const [still] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches); // client-only page
  const pinned = useMemo(() => (saved ? pinTake(saved.take.events) : null), [saved]);

  useEffect(() => {
    if (saved) return;
    let live = true;
    void fetch(`/songs/${DEMO_SONG}/chart.json`)
      .then((r) => r.json())
      .then((chart) => live && setSaved(demoTake(chart)));
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
      const a = audioRef.current;
      if (a) {
        const t = a.ctx.currentTime - a.t0;
        turnRef.current = Math.min(2 * Math.PI, (t / lengthS) * 2 * Math.PI);
        if (t > lengthS + voiceSettings.lengthS) {
          audioRef.current = null;
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
  }, [pinned, still]);

  useEffect(() => () => stop(), []);

  function stop() {
    const a = audioRef.current;
    audioRef.current = null;
    a?.sources.forEach((s) => s.stop());
    setPlaying(false);
  }

  // The crank: every pin is scheduled on the audio clock up front, at one strength, and the drum follows that clock.
  function crank() {
    if (!pinned) return;
    if (playing) return stop();
    const ctx = new AudioContext();
    const out = ctx.createGain();
    const prefs = getPrefs();
    out.gain.value = prefs.muted ? 0 : prefs.volume;
    out.connect(ctx.destination);
    const voices = pinned.teeth.map((p) => {
      const samples = renderTooth(hz(p), ctx.sampleRate);
      const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buf.copyToChannel(samples, 0);
      return buf;
    });
    const t0 = ctx.currentTime + LEAD_S;
    const sources = pinned.pins.map((pin) => {
      const src = ctx.createBufferSource();
      src.buffer = voices[pin.tooth];
      src.connect(out);
      src.start(t0 + pin.timeMs / 1000);
      return src;
    });
    audioRef.current = { ctx, sources, t0 };
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

  return (
    <main className={styles.page} data-testid="pinned">
      <canvas ref={canvasRef} className={styles.canvas} data-testid="pinned-canvas" aria-label="Your take as a brass music-box cylinder above a steel comb" />
      {noGl && <p className={styles.noGl}>This browser has no WebGL, so there&apos;s no cylinder to show. Chrome has it.</p>}

      <header className={styles.rail}>
        <h1 className={styles.mark}>Pinned</h1>
        <dl className={styles.data}>
          <div>
            <dt>Song</dt>
            <dd data-testid="pinned-song">{saved?.chart.title ?? "…"}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>{pinned ? clock(pinned.lengthMs) : "…"}</dd>
          </div>
          <div>
            <dt>Pins</dt>
            <dd>{pinned?.pins.length ?? "…"}</dd>
          </div>
          <div>
            <dt>Teeth</dt>
            <dd>{pinned?.teeth.length ?? "…"}</dd>
          </div>
        </dl>
        {saved?.scripted && <MonoLabel>A scripted take: a perfect run, not yours. Play one with ?x=pinned to pin it.</MonoLabel>}
        <div className={styles.actions}>
          <Button onClick={crank} disabled={!pinned} data-testid="pinned-crank" aria-pressed={playing}>
            {playing ? "Stop" : "Turn the crank"}
          </Button>
          <Button kind="secondary" onClick={toggleMacro} disabled={!pinned || noGl} data-testid="pinned-macro" aria-pressed={macro}>
            {macro ? "Wide" : "Macro"}
          </Button>
          <Button kind="secondary" onClick={exportStl} disabled={!pinned} data-testid="pinned-export">
            Export STL
          </Button>
        </div>
      </header>

      <p className={styles.notes}>
        <span>A music box plays every note at one strength.</span>
        <span>The STL is a model, not fitted to a commercial movement.</span>
        <span className={styles.hint}>Drag to turn the view.</span>
      </p>
    </main>
  );
}
