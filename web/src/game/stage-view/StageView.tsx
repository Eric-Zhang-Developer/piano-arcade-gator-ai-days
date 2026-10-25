"use client";

// /stage (stage-view): the audience's highway. It listens to /play's take on sheet-view's channel, read-only, and draws
// it on NOSTALGIA's hill. No controls show during a take; between takes, a quiet line and the full screen button. No
// key yet (decision stage-view-look): a key needs a line on help-overlay's card, and #965 has keys.ts open.
import { useEffect, useRef, useState } from "react";
import { Button } from "../duo-tokens";
import { SHEET_CHANNEL, type SheetMessage } from "../sheet-view/plugin";
import { whenDisplayFontReady } from "../ui-tokens";
import { drawStage, lookup, type Lookup } from "./draw";
import { emptyStage, reduceStage, type StageState } from "./state";
import styles from "./stage.module.css";

const fullScreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

export function StageView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<StageState>(emptyStage);
  const lookRef = useRef<Lookup | null>(null);
  const [live, setLive] = useState(false); // a take is on: hide the controls and the cursor
  const [waiting, setWaiting] = useState(true); // no take yet

  useEffect(() => {
    const ch = new BroadcastChannel(SHEET_CHANNEL);
    ch.onmessage = ({ data: m }: MessageEvent<SheetMessage>) => {
      const s = (stateRef.current = reduceStage(stateRef.current, m, performance.now()));
      if (m.type === "take") lookRef.current = lookup(m.chart);
      setLive(!!s.chart && !s.ended);
      setWaiting(!s.chart);
    };
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
            <p className={styles.wait}>
              <span className={styles.title}>Stage</span>
              <span className={styles.line}>Start a take on /play. This screen follows it.</span>
            </p>
          )}
          <Button kind="secondary" className={styles.full} onClick={() => void fullScreen()} data-testid="stage-fullscreen">
            Full screen
          </Button>
        </div>
      )}
    </main>
  );
}
