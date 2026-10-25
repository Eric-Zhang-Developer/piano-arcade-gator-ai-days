"use client";

// /stage (stage-view): the audience's highway. It listens to /play's take on sheet-view's channel, read-only, and draws
// it on NOSTALGIA's hill. No controls show during a take; between takes, a quiet line and the full screen button. No
// key yet (decision stage-view-look): a key needs a line on help-overlay's card, and #965 has keys.ts open.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "../duo-tokens";
import { SHEET_CHANNEL, type SheetMessage } from "../sheet-view/plugin";
import { whenDisplayFontReady } from "../ui-tokens";
import { drawStage, lookup, type Lookup } from "./draw";
import { emptyStage, reduceStage, type StageState } from "./state";
import styles from "./stage.module.css";

const fullScreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

// The kit's 14 px is a desk control; this one is read from across a room, so it scales with the page like the line.
const fullSize = { fontSize: "clamp(1rem, 2.25vh, 1.6rem)", padding: "0.75em 1.5em" };

export function StageView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<StageState>(emptyStage);
  const lookRef = useRef<Lookup | null>(null);
  const [live, setLive] = useState(false); // a take is on: hide the controls and the cursor
  const [waiting, setWaiting] = useState(true); // no take yet

  useEffect(() => {
    const ch = new BroadcastChannel(SHEET_CHANNEL);
    ch.onmessage = ({ data: m }: MessageEvent<SheetMessage>) => {
      const before = stateRef.current.chart;
      const s = (stateRef.current = reduceStage(stateRef.current, m, performance.now()));
      if (s.chart && s.chart !== before) lookRef.current = lookup(s.chart);
      setLive(!!s.chart && !s.ended);
      setWaiting(!s.chart);
    };
    ch.postMessage({ type: "hello" } satisfies SheetMessage); // a take already playing answers with its chart
    return () => ch.close();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const size = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    const frame = () => {
      drawStage(ctx, canvas.width, canvas.height, stateRef.current, lookRef.current, performance.now());
      raf = requestAnimationFrame(frame);
    };
    size();
    window.addEventListener("resize", size);
    void whenDisplayFontReady().then(() => (raf = requestAnimationFrame(frame)));
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  return (
    <main className={styles.stage} data-live={live || undefined} data-testid="stage">
      <canvas ref={canvasRef} className={styles.canvas} aria-label="The live take, for the audience" />
      {!live && (
        <div className={styles.idle} data-testid="stage-idle">
          {waiting && (
            <div className={styles.wait}>
              <h1 className={styles.title}>Stage</h1>
              <p className={styles.line}>Play a song on the main screen and it shows here.</p>
              <Link href="/" className={styles.songs} data-testid="stage-songs">
                Pick a song →
              </Link>
            </div>
          )}
          <Button kind="secondary" className={styles.full} style={fullSize} onClick={() => void fullScreen()} data-testid="stage-fullscreen">
            Full screen
          </Button>
        </div>
      )}
    </main>
  );
}
