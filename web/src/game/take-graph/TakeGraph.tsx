"use client";
// The take graph: every note's offset over the song in bars, per hand, on the judge's bands, with each hand's rolling
// median labelled at its end, velocity in its own strip, and a crosshair readout the arrow keys step. Plain SVG, no
// chart library (specs: take-graph, take-graph-pass).
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Chart, Results, Take } from "../../contracts";
import { handColor } from "../hand-colors";
import { Button } from "../duo-tokens";
import { hudSettings } from "../hud";
import { fontData, ink, inkDim, line, miss, panel, wrong as wrongInk } from "../ui-tokens";
import {
  bands,
  barTicks,
  clipOffset,
  describePoint,
  graphPoints,
  judgeWindows,
  rollingMedian,
  sensesVelocity,
  stepTo,
  timeOrder,
  trendLabel,
  velocityStrip,
  wrongMarks,
  type GraphPoint,
  type Windows,
} from "./graph";

const VEL_H = 34;
const GAP = 22; // between the plot and the velocity strip: the miss row
const M = { top: 16, right: 164, bottom: 26, left: 52 };
const HEAD = 0.18; // headroom past GOOD, as a share of it: where a clipped mark sits
const DRAW_MS = 600;
const c = hudSettings.judgmentColors;
const mono = { fontFamily: fontData, fontSize: 12 };

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function TakeGraph({ chart, take, results, windows = judgeWindows }: { chart: Chart; take: Take; results: Results; windows?: Windows }) {
  const [table, setTable] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const [width, setWidth] = useState(900);
  const [drawn, setDrawn] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const points = useMemo(() => graphPoints(chart, take, results), [chart, take, results]);
  const order = useMemo(() => timeOrder(points), [points]);
  const wrong = wrongMarks(chart, take, results);
  const velocity = sensesVelocity(take);
  const trends = (["R", "L"] as const).map((hand) => ({ hand, line: rollingMedian(points, hand) }));

  // The card's width is the viewBox's, so type stays at its px size at 1280 and at 1920.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);

  // One draw-in, left to right, the first time the graph is on screen; at once under reduced motion.
  useEffect(() => {
    const el = box.current;
    if (!el || drawn) return;
    if (reducedMotion()) return setDrawn(true);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setDrawn(true);
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [drawn, table]);

  const plotW = width - M.left - M.right;
  const plotH = Math.round(Math.min(260, Math.max(196, width * 0.14))); // taller on a wide card, so it never reads flat
  const H = M.top + plotH + GAP + VEL_H + M.bottom;
  const bars = Math.max(1, Math.ceil(Math.max(...points.map((p) => p.x)) + 1e-9));
  const ticks = barTicks(bars, plotW);
  const span = windows.good * (1 + HEAD);
  const x = (b: number) => M.left + (b / bars) * plotW;
  const y = (ms: number) => M.top + plotH / 2 - (ms / span) * (plotH / 2);
  const vTop = M.top + plotH + GAP;
  const missY = M.top + plotH + GAP / 2 + 2; // a MISS has no offset, so it gets its own row, not the zero line
  const clipY = (sign: number) => y(sign * windows.good * (1 + HEAD * 0.6)); // past GOOD: in the headroom, at the edge
  const markY = (p: GraphPoint) => {
    if (p.offsetMs === null) return missY;
    const { ms, clipped } = clipOffset(p.offsetMs, windows);
    return clipped ? clipY(Math.sign(ms)) : y(ms);
  };
  const vy = (v: number) => vTop + VEL_H - (v / 127) * VEL_H;

  // The trend labels sit at their line's last value; two that would touch move apart and keep a leader to their line.
  const ends = trends
    .filter((t) => t.line.length)
    .map((t) => {
      const at = y(Math.max(-span, Math.min(span, t.line[t.line.length - 1].ms)));
      return { hand: t.hand, label: trendLabel(t.line, t.hand)!, at, ly: at };
    })
    .sort((a, b) => a.at - b.at);
  if (ends.length === 2 && ends[1].at - ends[0].at < 18) {
    const mid = (ends[0].at + ends[1].at) / 2;
    [ends[0].ly, ends[1].ly] = [mid - 9, mid + 9];
  }

  const focused = focus === null ? null : points[focus];
  const readout = focused ? describePoint(focused, velocity) : null;

  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const py = ((e.clientY - r.top) / r.height) * H;
    let best: number | null = null;
    let d = Infinity;
    points.forEach((p, i) => {
      const dd = (x(p.x) - px) ** 2 + ((markY(p) - py) / 4) ** 2; // x matters most: the crosshair finds the time
      if (dd < d) [best, d] = [i, dd];
    });
    return best;
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setFocus((f) => stepTo(order, f, e.key));
  };

  return (
    // The card's full width: duo-details spans it across the grid, on the card's solid panel.
    <section data-testid="take-graph" style={{ width: "100%", boxSizing: "border-box", color: ink, fontSize: 14, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: inkDim }}>
          Timing per note, late up and early down · <span style={{ color: handColor("R") }}>●</span> right hand{" "}
          <span style={{ color: handColor("L") }}>■</span> left hand · line: the median of 8 notes
        </span>
        <Button kind="secondary" type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} style={{ padding: "6px 12px" }}>
          {table ? "Show as graph" : "Show as table"}
        </Button>
      </div>
      {table ? (
        <table data-testid="take-graph-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: "left", color: inkDim }}>
              <th>Bar</th><th>Beat</th><th>Hand</th><th>Judgment</th><th>Offset</th>{velocity && <th>Velocity</th>}
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.noteId}>
                <td>{p.bar}</td>
                <td>{Math.round(p.beat * 100) / 100}</td>
                <td>{p.hand === "R" ? "Right" : "Left"}</td>
                <td style={{ color: c[p.judgment] }}>{p.judgment}</td>
                <td>{p.offsetMs === null ? "—" : `${p.offsetMs > 0 ? "+" : ""}${Math.round(p.offsetMs)} ms`}</td>
                {velocity && <td>{p.velocity ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          ref={box}
          data-testid="take-graph-plot"
          tabIndex={0}
          role="group"
          aria-label={readout ?? "Timing of every note over the song. Arrow keys step through the notes."}
          aria-describedby="take-graph-readout"
          onKeyDown={onKey}
          onFocus={() => setFocus((f) => f ?? order[0] ?? null)}
          style={{ position: "relative", marginTop: 8, outlineOffset: 4 }}
        >
          <svg
            viewBox={`0 0 ${width} ${H}`}
            width="100%"
            aria-hidden
            style={{ display: "block", touchAction: "pan-y" }}
            onPointerMove={(e) => setFocus(nearest(e))}
            onPointerLeave={() => setFocus(null)}
          >
            {/* The judge's bands, quiet, and their edges as ticks on the left. */}
            {bands(windows).map((b, i) => (
              <rect key={b.judgment} x={M.left} y={y(b.ms)} width={plotW} height={y(-b.ms) - y(b.ms)} fill={c[b.judgment]} opacity={[0.05, 0.07, 0.1][i]} />
            ))}
            {[windows.good, windows.great, windows.perfect, 0, -windows.perfect, -windows.great, -windows.good].map((ms) => (
              <text key={ms} x={M.left - 8} y={y(ms)} fill={inkDim} {...mono} fontSize={11} textAnchor="end" dominantBaseline="middle">
                {ms === 0 ? "0" : `${ms > 0 ? "+" : "−"}${Math.abs(ms)}`}
              </text>
            ))}
            {/* Which way is which, between 0 and the PERFECT edge where the ticks leave room. */}
            <text x={M.left - 8} y={(y(0) + y(windows.perfect)) / 2} fill={inkDim} {...mono} fontSize={11} textAnchor="end" dominantBaseline="middle">late</text>
            <text x={M.left - 8} y={(y(0) + y(-windows.perfect)) / 2} fill={inkDim} {...mono} fontSize={11} textAnchor="end" dominantBaseline="middle">early</text>
            {wrong.length > 0 && (
              <text x={M.left - 8} y={M.top + 2} fill={inkDim} {...mono} fontSize={11} textAnchor="end" dominantBaseline="middle">wrong</text>
            )}
            <text x={M.left - 8} y={missY} fill={inkDim} {...mono} fontSize={11} textAnchor="end" dominantBaseline="middle">miss</text>
            {/* Bars: a hairline per bar line, a number at every label step. */}
            {ticks.lines.map((b) => (
              <line key={b} x1={x(b)} x2={x(b)} y1={M.top} y2={vTop + VEL_H} stroke={line} strokeWidth={1} opacity={ticks.labels.some((l) => l.at === b) ? 1 : 0.45} />
            ))}
            {ticks.labels.map((l) => (
              <text key={l.bar} x={x(l.at) + 3} y={H - 8} fill={inkDim} {...mono} fontSize={11}>{l.bar}</text>
            ))}
            <text x={M.left - 8} y={H - 8} fill={inkDim} {...mono} fontSize={11} textAnchor="end">bar</text>
            <line x1={M.left} x2={M.left + plotW} y1={y(0)} y2={y(0)} stroke={inkDim} strokeWidth={1} opacity={0.6} />

            <g
              data-testid="take-graph-marks"
              style={{
                clipPath: drawn ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
                transition: drawn && !reducedMotion() ? `clip-path ${DRAW_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : undefined,
              }}
            >
              {/* WRONG: a short tick in the wrong token at the top edge; quieter than any hit. */}
              {wrong.map((bx, i) => (
                <line key={`w${i}`} x1={x(bx)} x2={x(bx)} y1={M.top - 2} y2={M.top + 6} stroke={wrongInk} strokeWidth={1.5} opacity={0.8} />
              ))}
              {/* The notes, dimmed under the trend: a circle for the right hand, a square for the left. */}
              {points.map((p) => {
                const cx = x(p.x);
                const label = describePoint(p, velocity);
                if (p.offsetMs === null) {
                  const cy = missY;
                  return (
                    <g key={p.noteId} data-note={p.noteId} data-label={label} stroke={miss} strokeWidth={1.5} opacity={0.9}>
                      <line x1={cx - 3} x2={cx + 3} y1={cy - 3} y2={cy + 3} />
                      <line x1={cx - 3} x2={cx + 3} y1={cy + 3} y2={cy - 3} />
                    </g>
                  );
                }
                const { ms, clipped } = clipOffset(p.offsetMs, windows);
                const fill = handColor(p.hand);
                const cy = markY(p);
                if (clipped) {
                  // Past GOOD: a chevron at the edge, pointing the way it went.
                  const s = Math.sign(ms) * 5;
                  return (
                    <path key={p.noteId} data-note={p.noteId} data-label={label} data-clipped="" d={`M${cx - 5},${cy + s / 2} L${cx},${cy - s} L${cx + 5},${cy + s / 2} Z`} fill={fill} stroke={panel} strokeWidth={1.5} />
                  );
                }
                return p.hand === "R" ? (
                  <circle key={p.noteId} data-note={p.noteId} data-label={label} cx={cx} cy={cy} r={4} fill={fill} stroke={panel} strokeWidth={2} opacity={0.55} />
                ) : (
                  <rect key={p.noteId} data-note={p.noteId} data-label={label} x={cx - 4} y={cy - 4} width={8} height={8} fill={fill} stroke={panel} strokeWidth={2} opacity={0.55} />
                );
              })}
              {/* Each hand's trend over the dots, on a surface-colored ring so it reads where it crosses them. */}
              {trends.map(
                (t) =>
                  t.line.length > 1 && (
                    <g key={t.hand} data-trend={t.hand} fill="none" strokeLinejoin="round" strokeLinecap="round">
                      <polyline points={t.line.map((q) => `${x(q.x)},${y(Math.max(-span, Math.min(span, q.ms)))}`).join(" ")} stroke={panel} strokeWidth={5} />
                      <polyline points={t.line.map((q) => `${x(q.x)},${y(Math.max(-span, Math.min(span, q.ms)))}`).join(" ")} stroke={handColor(t.hand)} strokeWidth={2} />
                    </g>
                  ),
              )}
              {/* Velocity, its own strip on the same bars: a stem per hit. */}
              {velocity ? (
                velocityStrip(points).map((v, i) => (
                  <line key={i} x1={x(v.x)} x2={x(v.x)} y1={vTop + VEL_H} y2={vy(v.velocity)} stroke={handColor(v.hand)} strokeWidth={1.5} opacity={0.5} />
                ))
              ) : (
                <text x={M.left + 8} y={vTop + VEL_H / 2} fill={inkDim} {...mono} fontSize={11} dominantBaseline="middle">laptop keys sense no velocity</text>
              )}
            </g>
            <text x={M.left - 8} y={vTop + VEL_H / 2} fill={inkDim} {...mono} fontSize={11} textAnchor="end" dominantBaseline="middle">vel</text>
            {/* Direct labels at the right end, in ink, keyed by a short stroke of the hand's color. */}
            {ends.map((e) => {
              const { ly } = e;
              const x0 = M.left + plotW;
              return (
                <g key={e.hand} data-trend-label={e.hand}>
                  {ly !== e.at && <polyline points={`${x0},${e.at} ${x0 + 6},${ly} ${x0 + 10},${ly}`} fill="none" stroke={inkDim} strokeWidth={1} />}
                  <line x1={x0 + 10} x2={x0 + 22} y1={ly} y2={ly} stroke={handColor(e.hand)} strokeWidth={2} strokeLinecap="round" />
                  <text x={x0 + 28} y={ly} fill={ink} {...mono} dominantBaseline="middle">{e.label}</text>
                </g>
              );
            })}
            {/* The crosshair on the focused note. */}
            {focused && (
              <g pointerEvents="none">
                <line x1={x(focused.x)} x2={x(focused.x)} y1={M.top} y2={vTop + VEL_H} stroke={ink} strokeWidth={1} opacity={0.5} />
                <circle
                  cx={x(focused.x)}
                  cy={markY(focused)}
                  r={7}
                  fill="none"
                  stroke={ink}
                  strokeWidth={1.5}
                />
              </g>
            )}
          </svg>
          <div
            id="take-graph-readout"
            data-testid="take-graph-readout"
            aria-live="polite"
            style={{
              position: "absolute",
              top: 0,
              left: focused ? `clamp(0px, calc(${((x(focused.x) / width) * 100).toFixed(2)}% - 120px), calc(100% - 300px))` : 0,
              visibility: focused ? "visible" : "hidden",
              background: "#141a28",
              color: ink,
              ...mono,
              padding: "6px 10px",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {readout}
          </div>
        </div>
      )}
    </section>
  );
}
