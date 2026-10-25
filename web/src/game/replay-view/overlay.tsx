"use client";
// The Watch replay button and its full-screen overlay (spec: replay-view): core's highway, drawn at the replay clock,
// with each press as a marker in its lane and its key lit while held. Read-only: nothing is judged or recorded.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chart, Results, Take } from "../../contracts";
import { drawHighway, makeLayout } from "../core/highway";
import { settings } from "../core/settings";
import { Button, MonoLabel } from "../duo-tokens";
import { wrong } from "../ui-tokens";
import { getReplayState, pianoOutSettings, startReplay, stopReplay } from "../piano-out";
import { highwayAt, latePresses, replayChartTime, replaySpan } from ".";

type Props = { chart: Chart; take: Take; results: Results };

declare global {
  interface Window {
    // For verify: when the replay started and each press marker's crossing of the judgment line, in performance.now().
    __replayView?: { startPerf: number; sound: boolean; crossings: { pitch: number; atPerf: number; framePerf: number }[] };
  }
}

export function ReplayButton(props: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLSpanElement>(null);
  const was = useRef(false);
  const close = useCallback(() => setOpen(false), []); // stable, so a re-render of the results doesn't restart the replay
  // Focus goes back to Watch replay once the dialog is gone (#1245): while it's open, the page behind is inert.
  useEffect(() => {
    if (was.current && !open) button.current?.querySelector("button")?.focus();
    was.current = open;
  }, [open]);
  return (
    <>
      <span ref={button} style={{ display: "contents" }}>
        <Button kind="secondary" data-testid="watch-replay" onClick={() => setOpen(true)}>
          Watch replay
        </Button>
      </span>
      {open && <ReplayOverlay {...props} onClose={close} />}
    </>
  );
}

// A native modal <dialog> (#1245), as the Controls card is: the page behind is inert and Tab stays on Stop. Esc is
// still ours (the keydown below), so the replay stops the same way whichever closes it.
export function ReplayOverlay({ chart, take, results, onClose }: Props & { onClose(): void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const stop = useRef<HTMLSpanElement>(null);
  const [sound] = useState(() => getReplayState().canReplay);

  useEffect(() => {
    const d = dialog.current!;
    if (!d.open) d.showModal();
    stop.current?.querySelector("button")?.focus();
    return () => d.close();
  }, []);

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const span = replaySpan(chart, take);
    const presses = take.events.filter((e) => e.velocity > 0).sort((a, b) => a.timeMs - b.timeMs);
    const late = new Set([...latePresses(results)].map((i) => take.events[i]));
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
      // Press markers: a ring in the pitch's lane at the press's time; a LATE press's ring glows red.
      for (const e of presses) {
        if (e.timeMs < t - 300 || e.timeMs > t + settings.lookaheadMs) continue;
        const y = L.judgmentLineY - (e.timeMs - t) * pxPerMs;
        const k = L.keyX(e.pitch);
        const slip = late.has(e);
        const r = Math.max(5, Math.min(14, k.width * 0.3)) * (slip ? 1.4 : 1);
        ctx.beginPath();
        ctx.arc(L.project(k.x + k.width / 2, y), y, r, 0, Math.PI * 2);
        if (slip) {
          ctx.shadowColor = wrong;
          ctx.shadowBlur = r * 2;
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = wrong;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.lineWidth = slip ? 4 : 3;
        ctx.strokeStyle = slip ? wrong : "#ffffff";
        ctx.stroke();
        ctx.shadowBlur = 0;
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

  // The caption reads on video (16 px at 1280, 24 at 1920) and carries no key hint: Stop's title does, and the ? card
  // lists Esc (#1246).
  return (
    <dialog ref={dialog} data-testid="replay-overlay" aria-labelledby="replay-caption" style={full}>
      <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <p id="replay-caption" style={{ position: "absolute", top: 16, left: 0, right: 0, margin: 0, textAlign: "center" }}>
        <MonoLabel dim={false} style={{ fontSize: "clamp(16px, 1.25vw, 24px)", textTransform: "none", letterSpacing: "0.04em" }}>
          Replay{sound ? " on the piano" : ": no piano connected, so it's silent"}
        </MonoLabel>
      </p>
      <span ref={stop} style={{ position: "absolute", top: 12, right: 16 }}>
        <Button kind="secondary" data-testid="replay-stop" onClick={onClose} title="Stop (Esc)" aria-keyshortcuts="Escape">
          Stop
        </Button>
      </span>
    </dialog>
  );
}

// The dialog covers the screen: the browser's own dialog box (border, padding, max sizes) is undone.
const full = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  maxWidth: "none",
  maxHeight: "none",
  margin: 0,
  padding: 0,
  border: "none",
  background: "#000",
  color: "var(--pa-ink)",
  zIndex: 20,
} as const;
