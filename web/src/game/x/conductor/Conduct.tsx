"use client";
// /conduct (spike: conductor): the podium. The highway takes the screen and follows the conducted clock; the stand
// beside it holds the camera with the baton's last second, the tempo as one big numeral, and the session's controls.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Chart } from "../../../contracts";
import { drawHighway, makeLayout } from "../../core/highway";
import { settings } from "../../core/settings";
import { Button, canvasFonts, DataCell, MonoLabel } from "../../duo-tokens";
import { PIANO_NAME } from "../../laptop-sound";
import { loadPedal } from "../../pedal";
import { ink, inkDim, primary } from "../../ui-tokens";
import { ErrorLine, StateLine, TrackerStatus, type Cam } from "./announce";
import styles from "./conduct.module.css";
import { createSession, type Output, type Session, type SessionState } from "./session";
import { mediaRun, stopTracks } from "../media-run";
import { loadLandmarker, trackVideo } from "./tracker";

const SONGS = [
  { id: "moonlight-1", label: "Moonlight" },
  { id: "fur-elise", label: "Für Elise" },
  { id: "minute-waltz", label: "Minute Waltz" },
];
const GOLDEN = { id: "local/golden-hard", label: "Golden" }; // local and optional: listed only when it loads

const loadChart = async (id: string): Promise<Chart> => {
  if (!/^(local\/)?[\w-]+$/.test(id)) throw new Error(`No song called "${id}".`);
  const r = await fetch(`/songs/${id}/chart.json`);
  if (!r.ok) throw new Error(`No song called "${id}".`);
  return r.json();
};

// What the pit says while it waits for the conductor.
const PIT_CUE: Partial<Record<SessionState | "off", [string, string]>> = {
  off: ["Raise a hand", "Two beats set the tempo. The piano comes in on the third"],
  prep: ["Two beats", "Strike down and up again: the low point is the beat"],
  cut: ["Two beats", "to start again from here"],
};

// The gesture, drawn in the camera's place until it's on: a stroke down into a low point, the beat, and back up.
function drawGesture(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const [x0, y0, xl, yl, x1, y1] = [w * 0.32, h * 0.2, w * 0.5, h * 0.72, w * 0.68, h * 0.42];
  ctx.lineCap = "round";
  ctx.strokeStyle = primary;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(x0 + (xl - x0) * 0.35, yl, xl, yl);
  ctx.quadraticCurveTo(xl + (x1 - xl) * 0.5, yl, x1, y1);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(xl, yl, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = canvasFonts.data(13);
  ctx.textAlign = "center";
  ctx.fillStyle = inkDim;
  ctx.fillText("THE BEAT", xl, yl + 32);
}

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
  const [cam, setCam] = useState<Cam>("off");
  const [readout, setReadout] = useState<Readout>({ state: "off", bpm: null, ratio: null, fps: null, beats: 0 });
  const [copied, setCopied] = useState(false);
  const highway = useRef<HTMLCanvasElement>(null);
  const thumb = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef<Session | null>(null);
  // The camera, the tracker and the session, each held by its start as it opens (#1315): Stop, a newer start, a song
  // change (#1316), pagehide and unmount stop all of them, even mid-start.
  const runs = useRef(mediaRun()).current;
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
      runs.stop(); // a new song: its own session, from Start
      setCam("off");
    };
  }, [songId, runs]);

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
        const cue = PIT_CUE[s?.state ?? "off"];
        if (cue) {
          const big = Math.round(Math.min(width / 9, height / 6));
          const y = L.judgmentLineY * 0.42;
          ctx.fillStyle = "rgba(3, 6, 7, 0.88)"; // the ground, so no note runs through the words
          ctx.fillRect(0, y - big * 1.05, width, big * 1.95);
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.font = canvasFonts.display(big);
          ctx.fillStyle = ink;
          ctx.fillText(cue[0].toUpperCase(), width / 2, y);
          ctx.font = canvasFonts.data(Math.round(big / 4.2));
          ctx.fillStyle = inkDim;
          ctx.fillText(cue[1].toUpperCase(), width / 2, y + big * 0.62);
        }
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
      if (t && tctx && (!v || v.readyState < 2)) drawGesture(tctx, t.width, t.height);
      else if (t && tctx && v && v.readyState >= 2) {
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
    runs.stop();
    setCam("off");
  };

  useEffect(() => {
    addEventListener("pagehide", runs.stop);
    return () => {
      removeEventListener("pagehide", runs.stop);
      runs.stop();
    };
  }, [runs]);

  // Camera or clip: the same detector and clock either way.
  const start = async (file?: File) => {
    const v = video.current;
    if (!chart || !v) return;
    const run = runs.start();
    setError(null);
    setCam("loading");
    try {
      if (file) {
        v.srcObject = null;
        const url = (v.src = URL.createObjectURL(file));
        run.hold(() => URL.revokeObjectURL(url));
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480, frameRate: { ideal: 60 } }, audio: false });
        if (!run.hold(() => stopTracks(stream))) return;
        v.srcObject = stream;
      }
      run.hold(() => v.pause());
      const [lm, out] = await Promise.all([loadLandmarker(), pianoOutput()]);
      if (!run.live()) return;
      await v.play();
      if (!run.live()) return;
      const s = createSession(chart, pedal.current, out);
      session.current = s; // kept after Stop, so Copy log still has the take
      run.hold(() => s.stop());
      run.hold(trackVideo(v, lm, s.frame));
      setCam("on");
    } catch (e) {
      if (!run.live()) return; // superseded or stopped: nothing to report
      runs.stop();
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
  const conducted = readout.bpm !== null;
  const bpm = conducted ? Math.round(readout.bpm!) : (chart?.bpm ?? "");
  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Conduct</h1>
        <p className={styles.sub}>{chart ? `${chart.title} · ${chart.composer}` : "Wave a hand. The piano follows."}</p>
        <nav className={styles.songs} aria-label="Songs">
          {songs.map((s) => (
            <Link key={s.id} href={`/conduct?song=${s.id}${clip ? "&clip=1" : ""}`} className={styles.song} aria-current={s.id === songId ? "page" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>
        <Link href="/lab" className={styles.back}>
          Lab
        </Link>
      </header>
      <ErrorLine error={error} />
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
            {cam === "loading" && <MonoLabel style={{ position: "absolute", top: 8, left: 10, fontSize: 12 }}>Loading the hand tracker…</MonoLabel>}
            <TrackerStatus cam={cam} />
          </div>
          <div className={styles.tempo}>
            <MonoLabel>Tempo</MonoLabel>
            <span className={styles.bpm} data-testid="conduct-bpm" style={conducted ? undefined : { color: "var(--pa-ink-dim)" }}>
              {bpm}
            </span>
            <MonoLabel>{readout.ratio === null ? "BPM · as written" : `BPM · ×${readout.ratio.toFixed(2)} the chart's ${chart?.bpm}`}</MonoLabel>
          </div>
          <StateLine cam={cam} state={readout.state} />
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
              <Button onClick={() => start()} disabled={!chart} style={{ fontSize: "0.85em" }}>
                Start camera
              </Button>
            ) : (
              <Button kind="secondary" onClick={stop} style={{ fontSize: "0.85em" }}>
                Stop
              </Button>
            )}
            {readout.beats > 0 && (
              <Button kind="secondary" onClick={copy} style={{ fontSize: "0.85em" }}>
                {copied ? "Copied" : "Copy log"}
              </Button>
            )}
          </div>
          <p className={styles.small}>A still hand holds, a fist cuts off. Frames stay in this browser; nothing is recorded.</p>
        </aside>
      </div>
    </main>
  );
}
