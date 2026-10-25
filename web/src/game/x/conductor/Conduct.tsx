"use client";
// /conduct (spike: conductor): the podium. The highway takes the screen and follows the conducted clock; the stand
// beside it holds the camera with the baton's last second, the tempo as one big numeral, and the session's controls.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Chart } from "../../../contracts";
import { drawHighway, makeLayout } from "../../core/highway";
import { settings } from "../../core/settings";
import { Button, DataCell, MonoLabel } from "../../duo-tokens";
import { PIANO_NAME } from "../../laptop-sound";
import { loadPedal } from "../../pedal";
import { primary } from "../../ui-tokens";
import styles from "./conduct.module.css";
import { createSession, type Output, type Session, type SessionState } from "./session";
import { loadLandmarker, trackVideo } from "./tracker";

const SONGS = [
  { id: "moonlight-1", label: "Moonlight" },
  { id: "fur-elise", label: "Für Elise" },
  { id: "minute-waltz", label: "Minute Waltz" },
];
const GOLDEN = { id: "local/golden-hard", label: "Golden" }; // local and optional: listed only when it loads

const STATE_LINE: Record<SessionState | "off", string> = {
  off: "Start the camera, then give two beats to set the tempo",
  prep: "Two beats to set the tempo. The song starts on the third",
  running: "Following you",
  held: "Held. Beat again to go on",
  cut: "Cut off. Two beats to start again",
  fin: "Fine",
};

const loadChart = async (id: string): Promise<Chart> => {
  if (!/^(local\/)?[\w-]+$/.test(id)) throw new Error(`No song called "${id}".`);
  const r = await fetch(`/songs/${id}/chart.json`);
  if (!r.ok) throw new Error(`No song called "${id}".`);
  return r.json();
};

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

async function pianoOutput(): Promise<Output | null> {
  try {
    const access = await navigator.requestMIDIAccess();
    return ([...access.outputs.values()].find((o) => o.name?.includes(PIANO_NAME)) as unknown as Output) ?? null;
  } catch {
    return null;
  }
}

interface Readout {
  state: SessionState | "off";
  bpm: number | null;
  ratio: number | null;
  fps: number | null;
  beats: number;
}

export function Conduct() {
  const params = useSearchParams();
  const songId = params.get("song") ?? SONGS[0].id;
  const clip = params.get("clip") === "1";
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [golden, setGolden] = useState(false);
  const [cam, setCam] = useState<"off" | "loading" | "on">("off");
  const [readout, setReadout] = useState<Readout>({ state: "off", bpm: null, ratio: null, fps: null, beats: 0 });
  const [copied, setCopied] = useState(false);
  const highway = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<Session | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const pedal = useRef<Awaited<ReturnType<typeof loadPedal>>>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadChart(songId), loadPedal(songId)])
      .then(([c, p]) => live && (setChart(c), (pedal.current = p)))
      .catch((e: Error) => live && setError(e.message));
    fetch(`/songs/${GOLDEN.id}/chart.json`, { method: "HEAD" })
      .then((r) => live && setGolden(r.ok))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [songId]);

  // The draw loop: the highway at the conducted time, the beat pulse, the camera with its trail, the readout.
  useEffect(() => {
    if (!chart) return;
    let raf = 0;
    let lastReadout = 0;
    const empty = new Map();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      const s = session.current;
      const c = highway.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const { width, height } = c.getBoundingClientRect();
        const dpr = devicePixelRatio || 1;
        if (c.width !== Math.round(width * dpr)) [c.width, c.height] = [Math.round(width * dpr), Math.round(height * dpr)];
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const L = makeLayout(chart, width, height, settings.perspective);
        const nowMs = s ? s.nowMs(now) : -60000 / chart.bpm;
        drawHighway(ctx, L, chart, { nowMs, noteState: empty, pressed: s?.pressed() ?? new Set(), latest: null, countInBeat: null });
        // the pulse: a band on the hit line that fades over 200 ms; under reduced motion a flat tint for as long
        const since = now - (s?.pulseAt() ?? -Infinity);
        if (since < 200) {
          ctx.globalAlpha = reducedMotion() ? 0.35 : 0.8 * (1 - since / 200);
          ctx.fillStyle = primary;
          ctx.fillRect(0, L.judgmentLineY - 6, width, 12);
          ctx.globalAlpha = 1;
        }
      }
      const t = thumb.current;
      const tctx = t?.getContext("2d");
      const v = video.current;
      if (t && tctx && v && v.readyState >= 2) {
        const [w, h] = [t.width, t.height];
        tctx.save();
        tctx.translate(w, 0);
        tctx.scale(-1, 1); // a mirror, so the hand moves the way the conductor sees it
        tctx.drawImage(v, 0, 0, w, h);
        tctx.fillStyle = "rgba(3, 6, 7, 0.45)";
        tctx.fillRect(0, 0, w, h);
        const trail = s?.trail() ?? [];
        if (!reducedMotion() && trail.length > 1) {
          tctx.lineCap = "round";
          for (let i = 1; i < trail.length; i++) {
            const age = (now - trail[i].ms) / 1000;
            tctx.strokeStyle = `rgba(43, 155, 255, ${Math.max(0, 1 - age)})`;
            tctx.lineWidth = 2 + 6 * Math.max(0, 1 - age);
            tctx.beginPath();
            tctx.moveTo(trail[i - 1].x * w, trail[i - 1].y * h);
            tctx.lineTo(trail[i].x * w, trail[i].y * h);
            tctx.stroke();
          }
        }
        const lm = s?.landmarks();
        if (lm) {
          tctx.fillStyle = primary;
          tctx.beginPath();
          tctx.arc(lm[0].x * w, lm[0].y * h, 6, 0, Math.PI * 2);
          tctx.fill();
        }
        tctx.restore();
      }
      if (now - lastReadout > 125) {
        lastReadout = now;
        setReadout(s ? { state: s.state, bpm: s.bpm, ratio: s.ratio, fps: s.fps, beats: s.log().beats.length } : (r) => (r.state === "off" ? r : { ...r, state: "off" }));
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [chart]);

  const stop = () => {
    stopRef.current();
    stopRef.current = () => {};
    session.current?.stop();
    setCam("off");
  };

  useEffect(() => {
    const end = () => stopRef.current();
    addEventListener("pagehide", end);
    return () => {
      removeEventListener("pagehide", end);
      end();
      session.current?.stop();
    };
  }, []);

  // Camera or clip: the same detector and clock either way.
  const start = async (file?: File) => {
    const v = video.current;
    if (!chart || !v) return;
    stop();
    setError(null);
    setCam("loading");
    try {
      let stream: MediaStream | null = null;
      if (file) {
        v.srcObject = null;
        v.src = URL.createObjectURL(file);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480, frameRate: { ideal: 60 } }, audio: false });
        v.srcObject = stream;
      }
      const [lm, out] = await Promise.all([loadLandmarker(), pianoOutput()]);
      await v.play();
      const s = createSession(chart, pedal.current, out);
      session.current = s;
      const untrack = trackVideo(v, lm, s.frame);
      stopRef.current = () => {
        untrack();
        stream?.getTracks().forEach((track) => track.stop());
        v.pause();
        if (file) URL.revokeObjectURL(v.src);
      };
      setCam("on");
    } catch (e) {
      setCam("off");
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "The camera wasn't allowed." : `Couldn't start: ${(e as Error).message}`);
    }
  };

  const copy = async () => {
    const s = session.current;
    if (!s) return;
    await navigator.clipboard.writeText(JSON.stringify({ ...s.log(), fps: s.fps, clip }, null, 1));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const songs = golden ? [...SONGS, GOLDEN] : SONGS;
  const bpm = readout.bpm === null ? "—" : Math.round(readout.bpm);
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Conduct</h1>
        <p className={styles.sub}>{chart ? `${chart.title} · ${chart.composer}` : "Wave a hand. The piano follows."}</p>
        <Link href="/lab" className={styles.back}>
          Lab
        </Link>
      </header>
      {error && <p className={styles.note}>{error}</p>}
      <div className={styles.podium}>
        <canvas ref={highway} className={styles.highway} aria-label="The song's highway, moving at your tempo" />
        <aside className={styles.stand}>
          <div className={styles.camera}>
            <canvas ref={thumb} width={320} height={240} className={styles.thumb} aria-label="Your hand, with the baton's last second" />
            <video ref={video} className={styles.video} muted playsInline />
            {cam === "on" && (
              <MonoLabel dim={false} style={{ position: "absolute", top: 8, left: 10, fontSize: 12 }}>
                <span className={styles.dot} aria-hidden /> {clip ? "Clip" : "Camera on"}
              </MonoLabel>
            )}
            {cam !== "on" && <MonoLabel style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 12 }}>{cam === "loading" ? "Loading the hand tracker…" : clip ? "No clip" : "Camera off"}</MonoLabel>}
          </div>
          <div className={styles.tempo}>
            <MonoLabel>Tempo</MonoLabel>
            <span className={styles.bpm} data-testid="conduct-bpm">
              {bpm}
            </span>
            <MonoLabel>{readout.ratio === null ? `BPM · chart ${chart?.bpm ?? "—"}` : `BPM · ×${readout.ratio.toFixed(2)} the chart's ${chart?.bpm}`}</MonoLabel>
          </div>
          <p className={styles.state} data-testid="conduct-state">
            {STATE_LINE[cam === "on" ? readout.state : "off"]}
          </p>
          <div className={styles.cells}>
            <DataCell label="Beats" value={readout.beats} size={28} />
            <DataCell label="Camera fps" value={readout.fps === null ? "—" : Math.round(readout.fps)} size={28} />
          </div>
          <div className={styles.actions}>
            {clip ? (
              <label className={styles.file}>
                <MonoLabel dim={false}>Choose a clip</MonoLabel>
                <input type="file" accept="video/*" disabled={!chart} onChange={(e) => e.target.files?.[0] && start(e.target.files[0])} />
              </label>
            ) : cam === "off" ? (
              <Button onClick={() => start()} disabled={!chart}>
                Start camera
              </Button>
            ) : (
              <Button kind="secondary" onClick={stop}>
                Stop
              </Button>
            )}
            <Button kind="secondary" onClick={copy} disabled={cam !== "on" && readout.beats === 0}>
              {copied ? "Copied" : "Copy log"}
            </Button>
          </div>
          <p className={styles.small}>Frames stay in this browser. Nothing is recorded or saved. A fist cuts off; a still hand holds.</p>
          <nav className={styles.songs} aria-label="Songs">
            {songs.map((s) => (
              <Link key={s.id} href={`/conduct?song=${s.id}${clip ? "&clip=1" : ""}`} className={styles.song} aria-current={s.id === songId ? "page" : undefined}>
                {s.label}
              </Link>
            ))}
          </nav>
        </aside>
      </div>
    </main>
  );
}
