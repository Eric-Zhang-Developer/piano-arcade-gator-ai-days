"use client";

// /highlight (spike: highlight-reel): an edit bay for one take. The monitor shows the reel's frames, the timeline its
// three segments, and Render plays the reel into a WebM in real time (15 s); then the video and Save video.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chart } from "../../../contracts";
import { Brackets, Button, DataCell, kitButton, Panel } from "../../duo-tokens";
import { audioHash, renderAudio } from "./audio";
import { cut, expectedOnsetsMs, highlightSettings as S, takeTimeAt, type Edl } from "./cut";
import { hashBytes, reel, reelSize } from "./draw";
import { encode } from "./encode";
import { detectOnsets } from "./onsets";
import styles from "./highlight.module.css";
import { botTake, FALLBACK, isBot, loadLast, type Saved } from "./take";

type State = "loading" | "ready" | "rendering" | "done" | "no-reel" | "error";

declare global {
  interface Window {
    __highlightReel?: {
      state: State;
      edl: Edl | null;
      bestRun: Edl["run"] | null;
      expectedOnsetsMs: number[];
      framesRequested: number;
      framesLate: number;
      drawMs: { median: number; p95: number };
      frameHash(n: number): string;
      framePng(n: number): Promise<string>;
      audioHash: string | null;
      blobBytes: number;
      mimeType: string;
      takeTimeAt(n: number): number | null;
      // Without ffprobe (CI's runner): length, frame count and onsets from the browser itself.
      fallback(full: boolean): Promise<{ durationS: number; frames: number | null; onsetsMs: number[] | null }>;
    };
  }
}

const loadChart = async (id: string): Promise<Chart> => {
  if (!/^[\w-]+$/.test(id)) throw new Error(`No song called "${id}".`);
  const r = await fetch(`/songs/${id}/chart.json`);
  if (!r.ok) throw new Error(`No song called "${id}".`);
  return r.json();
};

// The take the URL asks for, and a note when it fell back.
async function takeFor(params: URLSearchParams): Promise<{ saved: Saved; note: string | null }> {
  const t = params.get("take") ?? "last";
  if (t.startsWith("bot:")) {
    const name = t.slice(4);
    if (!isBot(name)) throw new Error(`No bot called "${name}".`);
    return { saved: botTake(await loadChart(params.get("song") ?? FALLBACK.song), name), note: null };
  }
  const last = loadLast();
  if (last) return { saved: last, note: null };
  return { saved: botTake(await loadChart(FALLBACK.song), FALLBACK.bot), note: "No take saved yet: showing a scripted take" };
}

// The reel check's fallback where ffprobe is missing: the <video>'s duration (seeked to the end, as Chrome's WebM
// may carry none), and with full, its frames counted over a 1× playback and the decoded sound's onsets.
async function fallback(blob: Blob | null, full: boolean) {
  if (!blob) throw new Error("no video yet");
  const v = document.createElement("video");
  v.muted = true;
  v.src = URL.createObjectURL(blob);
  await new Promise((r) => (v.onloadedmetadata = r));
  if (!Number.isFinite(v.duration)) {
    v.currentTime = 1e9;
    await new Promise((r) => (v.ondurationchange = r));
  }
  const durationS = v.duration;
  if (!full) return { durationS, frames: null, onsetsMs: null };
  v.currentTime = 0;
  let frames = 0;
  const count = () => {
    frames++;
    v.requestVideoFrameCallback(count);
  };
  v.requestVideoFrameCallback(count);
  await v.play();
  await new Promise((r) => (v.onended = r));
  const ac = new AudioContext();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  const mono = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) buf.getChannelData(c).forEach((x, i) => (mono[i] += x / buf.numberOfChannels));
  await ac.close();
  return { durationS, frames, onsetsMs: detectOnsets(mono, buf.sampleRate) };
}

const seconds = (frames: number) => `${(frames / S.fps).toFixed(1)} s`;

export function Highlight() {
  const params = useSearchParams();
  const monitor = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"rendering" | "done" | "error" | null>(null); // the render's, once started
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [frame, setFrame] = useState(0);
  const [video, setVideo] = useState<{ url: string; bytes: number; late: number } | null>(null);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    takeFor(new URLSearchParams(params.toString()))
      .then(({ saved, note }) => {
        setSaved(saved);
        setNote(note);
      })
      .catch((e: Error) => {
        setError(e.message);
        setPhase("error");
      });
  }, [params]);

  const edl = useMemo(() => (saved ? cut(saved.chart, saved.take, saved.results) : null), [saved]);
  const drawer = useMemo(() => (saved && edl ? reel(saved.chart, saved.take, saved.results, edl) : null), [saved, edl]);
  const state: State = phase ?? (!saved ? "loading" : edl ? "ready" : "no-reel");

  // The test hook, rebuilt as the take arrives; render() fills in the encode's numbers.
  useEffect(() => {
    if (!saved) return;
    const scratch = () => new OffscreenCanvas(reelSize.width, reelSize.height).getContext("2d")!;
    window.__highlightReel = {
      state: edl ? "ready" : "no-reel",
      edl,
      bestRun: edl?.run ?? null,
      expectedOnsetsMs: edl ? expectedOnsetsMs(edl, saved.take) : [],
      framesRequested: 0,
      framesLate: 0,
      drawMs: { median: 0, p95: 0 },
      frameHash(n) {
        const ctx = scratch();
        drawer?.drawFrame(ctx, n);
        return hashBytes(ctx.getImageData(0, 0, reelSize.width, reelSize.height).data);
      },
      async framePng(n) {
        const ctx = scratch();
        drawer?.drawFrame(ctx, n);
        const blob = await (ctx.canvas as OffscreenCanvas).convertToBlob({ type: "image/png" });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let s = "";
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(s);
      },
      audioHash: null,
      blobBytes: 0,
      mimeType: "",
      takeTimeAt: (n) => (edl ? takeTimeAt(edl, n) : null),
      fallback: (full) => fallback(blobRef.current, full),
    };
  }, [saved, edl, drawer]);

  // The monitor's poster: the middle of the slow-motion hold.
  useEffect(() => {
    const ctx = monitor.current?.getContext("2d");
    if (ctx && drawer && state === "ready") drawer.drawFrame(ctx, Math.round(S.slowFrames / 2));
  }, [drawer, state]);

  const render = async () => {
    if (!saved || !edl || !drawer || !monitor.current) return;
    const hook = window.__highlightReel!;
    const ctx = monitor.current.getContext("2d")!;
    setPhase("rendering");
    hook.state = "rendering";
    try {
      const sound = await renderAudio(edl, saved.take);
      hook.audioHash = audioHash(sound);
      const out = await encode(monitor.current, sound, (n) => drawer.drawFrame(ctx, n), (n) => n % 6 === 0 && setFrame(n));
      blobRef.current = out.blob;
      Object.assign(hook, { framesRequested: out.framesRequested, framesLate: out.framesLate, drawMs: out.drawMs, blobBytes: out.blob.size, mimeType: out.mimeType, state: "done" });
      setVideo({ url: URL.createObjectURL(out.blob), bytes: out.blob.size, late: out.framesLate });
      setFrame(S.frames);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
      hook.state = "error";
    }
  };

  const [slow, finish, title] = edl?.segments ?? [];
  const chart = saved?.chart;
  return (
    <main className={styles.page} data-testid="highlight">
      <header className={styles.head}>
        <h1 className={styles.title}>Highlight reel</h1>
        <p className={styles.sub}>{chart ? `${chart.title} · ${chart.composer}` : "Loading the take…"}</p>
        <Link href="/lab" className={styles.back}>
          Lab
        </Link>
      </header>
      {note && (
        <p className={styles.note} data-testid="highlight-note">
          {note}
        </p>
      )}
      {error && (
        <p className={styles.note} role="alert">
          {error}
        </p>
      )}
      {state === "no-reel" && (
        <p className={styles.note} data-testid="highlight-none">
          This take has no hits, so it makes no reel.
        </p>
      )}
      <div className={styles.bay}>
        <Brackets>
          <div className={styles.monitor}>
            {video ? (
              <video src={video.url} controls autoPlay muted={false} className={styles.screen} data-testid="highlight-video" />
            ) : (
              <canvas ref={monitor} width={reelSize.width} height={reelSize.height} className={styles.screen} />
            )}
          </div>
        </Brackets>
        <aside className={styles.side}>
          <Panel>
            <div className={styles.cells}>
              <DataCell label={edl?.run.kind === "hits" ? "Hits in a row" : "Perfect in a row"} value={edl ? edl.run.count : "—"} size={64} />
              <DataCell label="Rank" value={saved?.results.rank ?? "—"} size={64} />
              <DataCell label="Accuracy" value={saved ? `${(saved.results.accuracy * 100).toFixed(1)}%` : "—"} size={64} />
            </div>
          </Panel>
          {state === "done" && video ? (
            <a href={video.url} download={`${chart?.id ?? "take"}-highlight.webm`} {...kitButton("primary")} data-testid="highlight-save">
              Save video
            </a>
          ) : (
            <Button onClick={render} disabled={state !== "ready"} data-testid="highlight-render">
              {state === "rendering" ? `Recording ${(frame / S.fps).toFixed(1)} s` : "Render reel"}
            </Button>
          )}
          <p className={styles.small}>
            {state === "done" && video
              ? `${(video.bytes / 1e6).toFixed(1)} MB WebM · ${video.late} late frames`
              : "Plays the reel once in real time to record it: 15 seconds."}
          </p>
        </aside>
      </div>
      {edl && (
        <ol className={styles.timeline} aria-label="The reel's segments">
          {[
            [slow, "Cold open", `best run at 0.5×`],
            [finish, "Finish", "real time"],
            [title, "Title card", `${saved?.results.rank} · ${edl.run.count} in a row`],
          ].map(([g, name, line]) => {
            const s = g as Edl["segments"][number];
            const done = Math.max(0, Math.min(1, (frame - s.fromFrame) / s.frames));
            return (
              <li key={s.kind} className={styles.segment} style={{ flexGrow: s.frames }} data-kind={s.kind}>
                <span className={styles.fill} style={{ transform: `scaleX(${state === "rendering" || state === "done" ? done : 0})` }} />
                <span className={styles.segName}>{name as string}</span>
                <span className={styles.segLine}>
                  {seconds(s.frames)} · {line as string}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
