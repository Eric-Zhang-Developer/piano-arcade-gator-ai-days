"use client";
// First run (spec: first-run): /play?song=twinkle&firstrun=1&labels=keys, a guided Twinkle. A start panel says what to
// do, and short text cues show at the moments they apply. Inert without ?firstrun=1. <FirstRunLink /> on / opens it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Chart, GameEvent, GamePlugin } from "../../contracts";
import { settings } from "../core/settings";
import { hudBottom, hudLayout } from "../hud";
import { ink, panel, whenDisplayFontReady } from "../ui-tokens";
import { cueAlpha, cueAt, cueBand, cuesFor, firstRunUrl, isFirstRun, type Cue, type CueId } from "./cues";
import styles from "./first-run.module.css";

export { firstRunUrl } from "./cues";

declare global {
  interface Window {
    __pianoArcadeFirstRun?: { cue: CueId | null; seen: CueId[] }; // verify-first-run.mjs
  }
}

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

export function firstRun(): GamePlugin & { cue(nowMs: number): Cue | null } {
  let chart: Chart | null = null;
  let events: GameEvent[] = [];
  let cues: Cue[] = [];
  let seen: CueId[] = [];
  let lastCtx: CanvasRenderingContext2D | null = null;
  let display = "system-ui, sans-serif";
  if (typeof document !== "undefined")
    void whenDisplayFontReady().then(() => {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--pa-font-display").trim();
      if (family) display = `${family}, system-ui, sans-serif`;
    });
  const cue = (nowMs: number) => (chart ? cueAt(cues, nowMs) : null);
  return {
    id: "first-run",
    cue,
    transformChart(c, params) {
      chart = isFirstRun(params) ? c : null;
      return c;
    },
    startPanel: ({ params }) => (isFirstRun(params) ? <StartLine /> : null),
    onEvent(e) {
      if (!chart) return;
      if (e.type === "songStart") events = seen = [];
      events.push(e);
      cues = cuesFor(chart, events);
      if (e.type === "songEnd" || e.type === "quit") lastCtx?.clearRect(0, 0, lastCtx.canvas.width, lastCtx.canvas.height);
    },
    draw(ctx, f) {
      if (!chart) return;
      lastCtx = ctx;
      const c = cue(f.nowMs);
      if (c && !seen.includes(c.id)) seen = [...seen, c.id];
      window.__pianoArcadeFirstRun = { cue: c?.id ?? null, seen };
      if (!c) return;
      const { top, bottom } = cueBand(hudBottom(hudLayout(f.width, f.judgmentLineY)), f.judgmentLineY, settings.lookaheadMs);
      const size = Math.max(24, Math.round(f.height * 0.03));
      const y = (top + bottom) / 2;
      ctx.save();
      ctx.globalAlpha = cueAlpha(c, f.nowMs, reducedMotion());
      ctx.font = `italic 800 ${size}px ${display}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const w = ctx.measureText(c.text).width + size * 1.4;
      const h = size * 1.8;
      ctx.fillStyle = panel;
      ctx.beginPath();
      ctx.roundRect(f.width / 2 - w / 2, y - h / 2, w, h, 8);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.fillText(c.text, f.width / 2, y);
      ctx.restore();
    },
  };
}

function StartLine() {
  return (
    <p className={styles.start} data-testid="first-run-start">
      Your first song · about 30 seconds · press the key shown on each note as it touches the line
    </p>
  );
}

// "First time?" on /: never takes focus, and F (no modifier, no repeat, not in a dialog or a text field) opens it too.
export function FirstRunLink() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "f" || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.target instanceof Element && e.target.closest("dialog, input, textarea, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return; // the Options drawer is open
      router.push(firstRunUrl);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <Link href={firstRunUrl} className={styles.link} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} data-capture-hide data-testid="first-run-link">
      First time? 30-second first song <kbd className={styles.kbd}>F</kbd>
    </Link>
  );
}
