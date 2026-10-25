"use client";

import { useEffect, useRef } from "react";
import type { Chart } from "../../contracts";
import { validateChart } from "../../contracts";
import { settings } from "../../game/core/settings";

// The real Twinkle chart, falling onto the keys on a loop: a picture of the game, not a take, so it shows no score.

const CHART_URL = "/songs/twinkle/chart.json";
const LEAD_IN_MS = 2400; // empty highway before the first note reaches the line
const TAIL_MS = 1600; // after the last note, before the loop restarts
const HIT_FLASH_MS = 260;
const BLACK = new Set([1, 3, 6, 8, 10]);

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornMs: number;
}

interface Keyboard {
  lo: number;
  hi: number;
  whiteW: number;
  keyX(p: number): { x: number; w: number; black: boolean };
}

function makeKeyboard(chart: Chart, width: number): Keyboard {
  const pitches = chart.notes.map((n) => n.pitch);
  // Whole octaves, with one spare octave below the song so its notes fall on the right, clear of the headline.
  const lo = Math.floor(Math.min(...pitches) / 12) * 12 - 12;
  const hi = Math.max(Math.ceil((Math.max(...pitches) + 1) / 12) * 12 - 1, lo + 23);
  let whites = 0;
  for (let p = lo; p <= hi; p++) if (!BLACK.has(p % 12)) whites++;
  const whiteW = width / whites;
  const whiteIndex = (p: number) => {
    let i = 0;
    for (let q = lo; q < p; q++) if (!BLACK.has(q % 12)) i++;
    return i;
  };
  return {
    lo,
    hi,
    whiteW,
    keyX(p) {
      if (BLACK.has(p % 12)) {
        const w = whiteW * 0.6;
        return { x: whiteIndex(p) * whiteW - w / 2, w, black: true };
      }
      return { x: whiteIndex(p) * whiteW, w: whiteW, black: false };
    },
  };
}

export default function HeroHighway() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let stopped = false;
    let offResize = () => {};

    fetch(CHART_URL)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (stopped || validateChart(data).length > 0) return;
        const chart = data as Chart;
        const msPerBeat = 60000 / chart.bpm;
        const notes = chart.notes.map((n) => ({
          pitch: n.pitch,
          startMs: LEAD_IN_MS + n.beat * msPerBeat,
          endMs: LEAD_IN_MS + (n.beat + n.duration) * msPerBeat,
        }));
        const loopMs = notes[notes.length - 1].endMs + TAIL_MS;
        const sparks: Spark[] = [];
        let lastT = 0;
        let w = 0;
        let h = 0;
        let kb = makeKeyboard(chart, 1);
        const t0 = performance.now();

        const resize = () => {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          w = canvas.clientWidth;
          h = canvas.clientHeight;
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          kb = makeKeyboard(chart, w);
        };
        resize();

        const draw = (now: number) => {
          // A still frame lands mid-phrase, with notes on the way down.
          const t = still ? LEAD_IN_MS + 6 * msPerBeat : (now - t0) % loopMs;
          if (t < lastT) sparks.length = 0;
          const keysH = Math.min(h * 0.2, kb.whiteW * 4.2);
          const lineY = h - keysH;
          const pxPerMs = lineY / settings.lookaheadMs;

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, w, h);

          // Lane guides at every C and F, like the game's highway.
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 1;
          for (let p = kb.lo; p <= kb.hi; p++) {
            if (p % 12 !== 0 && p % 12 !== 5) continue;
            const x = Math.round(kb.keyX(p).x) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, lineY);
            ctx.stroke();
          }

          const lit = new Set<number>();
          for (const n of notes) {
            if (n.startMs <= t && t < n.endMs) lit.add(n.pitch);
            // A note crossing the line this frame throws sparks upward.
            if (!still && lastT < n.startMs && n.startMs <= t) {
              const k = kb.keyX(n.pitch);
              for (let i = 0; i < 14; i++) {
                sparks.push({
                  x: k.x + k.w / 2 + (Math.random() - 0.5) * k.w * 0.6,
                  y: lineY,
                  vx: (Math.random() - 0.5) * 0.08,
                  vy: -0.12 - Math.random() * 0.22,
                  bornMs: t,
                });
              }
            }
            const bottom = lineY - (n.startMs - t) * pxPerMs;
            const top = lineY - (n.endMs - t) * pxPerMs + settings.noteGapPx;
            if (top > lineY || bottom < 0) continue;
            const k = kb.keyX(n.pitch);
            const pad = k.w * 0.1;
            const y0 = Math.max(top, 0);
            const y1 = Math.min(bottom, lineY);
            ctx.save();
            ctx.shadowColor = settings.noteColor;
            ctx.shadowBlur = 18;
            ctx.fillStyle = settings.noteColor;
            ctx.beginPath();
            ctx.roundRect(k.x + pad, y0, k.w - pad * 2, Math.max(y1 - y0, 2), 6);
            ctx.fill();
            ctx.restore();
            if (bottom <= lineY) {
              ctx.fillStyle = settings.noteHeadColor;
              ctx.fillRect(k.x + pad, bottom - settings.noteHeadPx, k.w - pad * 2, settings.noteHeadPx);
            }
          }

          // Sparks rise and fade above the judgment line.
          for (let i = sparks.length - 1; i >= 0; i--) {
            const s = sparks[i];
            const age = t - s.bornMs;
            if (age > 700) {
              sparks.splice(i, 1);
              continue;
            }
            ctx.globalAlpha = 1 - age / 700;
            ctx.fillStyle = age < 120 ? "#ffffff" : settings.noteColor;
            ctx.fillRect(s.x + s.vx * age, s.y + s.vy * age, 2, 2);
          }
          ctx.globalAlpha = 1;

          // The judgment line glows brighter for a moment on every hit.
          const sinceHit = Math.min(...notes.map((n) => (t >= n.startMs ? t - n.startMs : Infinity)));
          const flash = sinceHit < HIT_FLASH_MS ? 1 - sinceHit / HIT_FLASH_MS : 0;
          ctx.save();
          ctx.shadowColor = settings.noteColor;
          ctx.shadowBlur = 12 + flash * 24;
          ctx.fillStyle = `rgba(94,242,196,${0.55 + flash * 0.45})`;
          ctx.fillRect(0, lineY - 1.5, w, 3);
          ctx.restore();

          // Keys: whites first, then blacks on top.
          for (const pass of [false, true]) {
            for (let p = kb.lo; p <= kb.hi; p++) {
              const k = kb.keyX(p);
              if (k.black !== pass) continue;
              const kh = k.black ? keysH * 0.62 : keysH;
              ctx.fillStyle = lit.has(p) ? settings.keyLitColor : k.black ? "#16161a" : "#e8e8ec";
              ctx.fillRect(k.x + 0.5, lineY + 2, k.w - 1, kh - 2);
            }
          }

          lastT = t;
          if (!still) raf = requestAnimationFrame(draw);
        };
        // Resizing clears the canvas, so a still frame has to be drawn again.
        const onResize = () => {
          resize();
          if (still) draw(performance.now());
        };
        window.addEventListener("resize", onResize);
        offResize = () => window.removeEventListener("resize", onResize);
        raf = requestAnimationFrame(draw);
      })
      .catch(() => {
        // No chart: the hero keeps its dark background and the text still reads.
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      offResize();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
