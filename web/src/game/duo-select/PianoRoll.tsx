"use client";
// A song's opening as a glowing piano-roll thumbnail (spec: duo-select), from roll(). It fills its parent and redraws
// only when the roll or its size changes, never per frame. Decorative: the row's title says what the song is.
import { useEffect, useRef } from "react";
import { inkDim } from "../ui-tokens";
import type { Roll } from "./roll";

const PAD = 0.08; // of the height, kept clear above and below the notes
const SIDE = 0.03; // of the width, kept clear left and right, so the first and last notes don't touch the frame

export function PianoRoll({ roll, className }: { roll: Roll; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      paint(ctx, roll, width, height);
    };
    draw();
    const seen = new ResizeObserver(draw);
    seen.observe(canvas);
    return () => seen.disconnect();
  }, [roll]);

  return <canvas ref={ref} className={className} style={{ display: "block", width: "100%", height: "100%" }} aria-hidden data-piano-roll />;
}

function paint(ctx: CanvasRenderingContext2D, roll: Roll, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  // The grid: a hairline where each bar starts, and three faint pitch guides.
  ctx.strokeStyle = inkDim;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  const left = w * SIDE;
  const span = w - 2 * left;
  for (const x of roll.barLines) {
    const px = Math.round(left + x * span) + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
  }
  for (const y of [0.25, 0.5, 0.75]) {
    const py = Math.round(y * h) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  const top = h * PAD;
  const inner = h - 2 * top;
  const rowH = inner / roll.rows;
  // Thin, like the frame's: a song with few pitches would otherwise draw blocks a row tall.
  const thick = Math.max(2, Math.min(rowH * 0.8, h * 0.035));
  const gap = Math.min(3, span * 0.004); // between repeated notes, so they read as separate bars
  ctx.shadowBlur = thick * 1.5;
  for (const b of roll.bars) {
    const x = left + b.x * span + gap / 2;
    const y = top + inner - (b.row + 0.5) * rowH - thick / 2;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(thick, b.w * span - gap), thick, Math.min(2, thick / 2)); // a note: slight rounding
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
