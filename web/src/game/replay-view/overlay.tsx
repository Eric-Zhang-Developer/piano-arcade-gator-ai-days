"use client";
// The Watch replay button and its full-screen overlay (spec: replay-view): core's highway, drawn at the replay clock,
// with each press as a marker in its lane and its key lit while held. Read-only: nothing is judged or recorded.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, Results, Take } from "../../contracts";
import { drawHighway, makeLayout } from "../core/highway";
import { settings } from "../core/settings";
import { Button } from "../duo-tokens";
import { getReplayState, pianoOutSettings, startReplay, stopReplay } from "../piano-out";
import { highwayAt, replayChartTime, replaySpan } from ".";

type Props = { chart: Chart; take: Take; results: Results };

declare global {
  interface Window {
    // For verify: when the replay started and each press marker's crossing of the judgment line, in performance.now().
    __replayView?: { startPerf: number; sound: boolean; crossings: { pitch: number; atPerf: number; framePerf: number }[] };
  }
}

export function ReplayButton(props: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []); // stable, so a re-render of the results doesn't restart the replay
  return (
    <>
      <Button kind="secondary" data-testid="watch-replay" onClick={() => setOpen(true)}>
        Watch replay
      </Button>
      {open && <ReplayOverlay {...props} onClose={close} />}
    </>
  );
}

function ReplayOverlay({ chart, take, results, onClose }: Props & { onClose(): void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [sound] = useState(() => getReplayState().canReplay);

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const span = replaySpan(chart, take);
    const presses = take.events.filter((e) => e.velocity > 0).sort((a, b) => a.timeMs - b.timeMs);
    const lead = pianoOutSettings.leadMs;
    // The clock opens one bar before the first press; the piano starts so its first note lands on that press.
    let startPerf = performance.now() + (span.firstPressMs - span.fromMs) - lead;
    const hook = { startPerf, sound, crossings: [] as { pitch: number; atPerf: number; framePerf: number }[] };
    window.__replayView = hook;
    const startTimer = sound
      ? setTimeout(() => {
          if (getReplayState().playing) stopReplay(); // "Replay on piano" already running: start ours in its place
          startPerf = hook.startPerf = performance.now();
          startReplay();
        }, Math.max(0, startPerf - performance.now()))
      : undefined;

    const dpr = window.devicePixelRatio || 1;
    c.width = innerWidth * dpr;
    c.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = makeLayout(chart, innerWidth, innerHeight, settings.perspective);
    const pxPerMs = L.judgmentLineY / settings.lookaheadMs;
    let crossed = 0;
    let raf = 0;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      onClose();
    };
    const frame = () => {
      const perf = performance.now();
      const t = replayChartTime(perf, startPerf, span.firstPressMs, lead);
      if (t > span.toMs) return close();
      drawHighway(ctx, L, chart, highwayAt(chart, take, results, t));
      // Press markers: a ring in the pitch's lane at the press's time.
      for (const e of presses) {
        if (e.timeMs < t - 300 || e.timeMs > t + settings.lookaheadMs) continue;
        const y = L.judgmentLineY - (e.timeMs - t) * pxPerMs;
        const k = L.keyX(e.pitch);
        const r = Math.max(5, Math.min(14, k.width * 0.3));
        ctx.beginPath();
        ctx.arc(L.project(k.x + k.width / 2, y), y, r, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
      while (crossed < presses.length && presses[crossed].timeMs <= t) {
        const e = presses[crossed++];
        hook.crossings.push({ pitch: e.pitch, atPerf: startPerf + lead + (e.timeMs - span.firstPressMs), framePerf: perf });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(startTimer);
      window.removeEventListener("keydown", onKey, { capture: true });
      if (sound) stopReplay();
    };
  }, [chart, take, results, sound, onClose]);

  return (
    <div data-testid="replay-overlay" style={{ position: "fixed", inset: 0, zIndex: 20, background: "#000" }}>
      <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 16, left: 0, right: 0, textAlign: "center", fontSize: 16, color: "rgba(255,255,255,0.8)" }}>
        Replay{sound ? " on the piano" : ": no piano connected, so it's silent"} · Esc to stop
      </div>
      <Button kind="secondary" data-testid="replay-stop" onClick={onClose} style={{ position: "absolute", top: 12, right: 16 }}>
        Stop
      </Button>
    </div>
  );
}
