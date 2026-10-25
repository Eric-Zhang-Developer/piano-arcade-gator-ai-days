"use client";
// /sonata (spec: build-sonata): the night as a roll you can read. Each mark is a merged PR, placed where the sonata
// plays it; hover or arrow keys pick one and the readout names it. Listen sends the bot demo to the DGX.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { kitButton } from "../../duo-tokens";
import s from "./sonata.module.css";
import snapshot from "./snapshot.json";
import { buildSonata, etLabel, REGISTER, type Lane, type Snapshot } from "./sonata";

const SONG = "x/build-sonata";
const LINKS = {
  listen: `/play?song=${SONG}&bot=perfect&audible=1&demo=1&x=build-sonata`,
  easy: `/play?song=${SONG}&level=easy&x=build-sonata`,
  full: `/play?song=${SONG}&x=build-sonata`,
};

// Each lane's kit color: the game in the primary blue, learning in the secondary violet, the backend in sun, and the
// plan/contract/docs bell in paper.
export const LANE_COLOR: Record<Lane, string> = { game: "#2b9bff", learning: "#a07cff", backend: "#ffb02e", bell: "#f2ede3" };
export const LANE_NAME: Record<Lane, string> = { game: "Game", bell: "Plans and contracts", learning: "Learning", backend: "Backend" };
const RED = "#ff4d5e";
// Each lane gets a band of the roll's height, top to bottom in register order, pitch up inside it: still a piano roll,
// with the empty octaves between lanes taken out.
const BAND: Record<Lane, [number, number]> = { bell: [0.1, 0.2], game: [0.29, 0.61], learning: [0.7, 0.8], backend: [0.88, 0.97] };
const yOf = (lane: Lane, pitch: number) => {
  const [lo, hi] = REGISTER[lane];
  const [top, bottom] = BAND[lane];
  return bottom - ((pitch - lo) / (hi - lo)) * (bottom - top); // 0–1 of the roll's height
};

export function Sonata() {
  const snap = snapshot as Snapshot;
  const { notes } = useMemo(() => buildSonata(snap), [snap]);
  const end = useMemo(() => Math.max(...notes.map((n) => n.beat + n.duration)), [notes]);
  const [sel, setSel] = useState(notes.length - 1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const counts = useMemo(() => {
    const c: Record<Lane, number> = { game: 0, bell: 0, learning: 0, backend: 0 };
    for (const n of notes) c[n.lane]++;
    return c;
  }, [notes]);
  // Red-main stretches as beat spans: a run of red notes.
  const reds = useMemo(() => {
    const out: [number, number][] = [];
    notes.forEach((n, i) => {
      if (!n.red) return;
      const prev = notes[i - 1];
      if (prev?.red && out.length) out[out.length - 1][1] = n.beat + 0.5;
      else out.push([n.beat, n.beat + 0.5]);
    });
    return out;
  }, [notes]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width: w, height: h } = c.getBoundingClientRect();
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const x = (beat: number) => (beat / end) * w;
      const mark = Math.max(5, Math.round(h / 56)); // a note's height
      // Each lane's band, a tone step up from the panel, named at its left edge.
      for (const l of Object.keys(BAND) as Lane[]) {
        ctx.fillStyle = "rgba(125, 132, 150, 0.05)";
        ctx.fillRect(0, BAND[l][0] * h - mark, w, (BAND[l][1] - BAND[l][0]) * h + mark * 2);
      }
      for (const [a, b] of reds) {
        ctx.fillStyle = "rgba(255, 77, 94, 0.22)";
        ctx.fillRect(x(a), 0, Math.max(3, x(b) - x(a)), h);
      }
      for (const n of notes) {
        ctx.globalAlpha = n.kind === "pass" ? 0.55 : 1;
        ctx.fillStyle = n.red ? RED : LANE_COLOR[n.lane];
        const t = n.kind === "pass" ? Math.ceil(mark / 2) : mark;
        ctx.fillRect(x(n.beat), yOf(n.lane, n.pitch) * h - t / 2, Math.max(3, x(n.duration)), t);
      }
      ctx.globalAlpha = 1;
      const n = notes[sel];
      if (n) {
        const nx = x(n.beat);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(nx - 0.5, 0, 1, h);
        ctx.fillRect(nx - 3, yOf(n.lane, n.pitch) * h - mark, Math.max(8, x(n.duration)) + 6, mark * 2);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [notes, end, reds, sel]);

  // The nearest note to the pointer, by time first.
  const pick = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    let best = 0;
    let bestD = Infinity;
    notes.forEach((n, i) => {
      const d = Math.hypot((n.beat / end) * r.width - px, yOf(n.lane, n.pitch) * r.height - py * 1) + Math.abs((n.beat / end) * r.width - px) * 2;
      if (d < bestD) [best, bestD] = [i, d];
    });
    setSel(best);
  };
  const step = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const d = { ArrowLeft: -1, ArrowRight: 1, Home: -notes.length, End: notes.length }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    setSel((i) => Math.max(0, Math.min(notes.length - 1, i + d)));
  };

  const n = notes[sel];
  return (
    <main className={s.screen}>
      <header className={s.top}>
        <h1 className={s.wordmark}>The Build Sonata</h1>
        <Link className={s.back} href="/lab">
          Back to the Lab
        </Link>
      </header>

      <section className={s.count} aria-label="The night in numbers">
        <p className={s.number}>{snap.count}</p>
        <p className={s.what}>merged PRs, one note each</p>
        <p className={s.span}>
          {etLabel(snap.from)} to {etLabel(snap.to)} ET, played in {Math.round((end * 60) / 120)} s
        </p>
      </section>

      <section className={s.readout} aria-label="The selected merged PR">
        <div className={s.said} aria-live="polite" data-testid="sonata-said">
          <p className={s.meta}>
            <span className={s.lane} style={{ background: n.red ? RED : LANE_COLOR[n.lane] }} />
            {LANE_NAME[n.lane]} · PR #{n.pr} · {n.hash.slice(0, 7)} · {etLabel(n.time)} ET{n.red ? " · main was red" : ""}
          </p>
          <p className={s.subject}>{n.subject.replace(/\s*\(#\d+\)$/, "")}</p>
          <p className={s.music}>
            Note {sel + 1} of {notes.length} · chord {n.chord}
            {n.kind === "pass" ? ", a passing tone (a fix)" : n.kind === "resolve" ? ", the fix that turned main green" : ""}
          </p>
        </div>
        <nav className={s.actions} aria-label="Hear it or play it">
          <a {...kitButton("primary")} href={LINKS.listen} data-testid="sonata-listen">
            Listen on the piano
          </a>
          <a {...kitButton("secondary")} href={LINKS.easy}>
            Play it, Easy
          </a>
          <a {...kitButton("secondary")} href={LINKS.full}>
            Play it, full
          </a>
        </nav>
      </section>

      <figure className={s.rollWrap}>
        <div className={s.stage}>
          {(Object.keys(BAND) as Lane[]).map((l) => (
            <span key={l} className={s.laneName} aria-hidden style={{ top: `${BAND[l][0] * 100}%`, color: LANE_COLOR[l] }}>
              {LANE_NAME[l]} · {counts[l]}
            </span>
          ))}
          <canvas
            ref={canvas}
            className={s.roll}
            tabIndex={0}
            role="slider"
            aria-label="The night as a piano roll: arrow keys step through the merged PRs"
            aria-valuemin={1}
            aria-valuemax={notes.length}
            aria-valuenow={sel + 1}
            aria-valuetext={`Note ${sel + 1} of ${notes.length}, PR #${n.pr}`}
            onPointerMove={pick}
            onKeyDown={step}
            data-testid="sonata-roll"
          />
        </div>
        <figcaption className={s.legend}>
          <span>Long: a feature · short: a fix, as a passing tone</span>
          {snap.red !== null ? (
            <span>
              <span className={s.lane} style={{ background: RED }} />
              Main red: A minor until the fix
            </span>
          ) : (
            <span>Red-main data unavailable</span>
          )}
          <span>Point at the roll, or press ← →, to read a PR</span>
        </figcaption>
      </figure>
    </main>
  );
}
