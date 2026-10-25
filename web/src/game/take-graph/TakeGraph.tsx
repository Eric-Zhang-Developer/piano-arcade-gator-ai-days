"use client";
// The take graph: every note's offset over the song, per hand, with the judging bands and a velocity line. Plain
// SVG, no chart library (spec: take-graph).
import { useState } from "react";
import type { Chart, Results, Take } from "../../contracts";
import { GOOD_MS, GREAT_MS, PERFECT_MS } from "../core/settings";
import { handColor } from "../hand-colors";
import { Button } from "../duo-tokens";
import { hudSettings } from "../hud";
import { gold, ink, inkDim } from "../ui-tokens";
import { describePoint, graphPoints, sensesVelocity, wrongMarks, type GraphPoint } from "./graph";

const W = 900;
const H = 196; // with the header, the panel stays under results-layout's 240 px at 900 wide
const M = { top: 14, right: 44, bottom: 24, left: 64 };
const plotW = W - M.left - M.right;
const plotH = H - M.top - M.bottom;
const c = hudSettings.judgmentColors;

export function TakeGraph({ chart, take, results }: { chart: Chart; take: Take; results: Results }) {
  const [table, setTable] = useState(false);
  const points = graphPoints(chart, take, results);
  const wrong = wrongMarks(chart, take, results);
  const velocity = sensesVelocity(take);
  const bars = Math.max(1, Math.ceil(Math.max(...points.map((p) => p.x)) + 1e-9));
  const x = (bars_: number) => M.left + (bars_ / bars) * plotW;
  const y = (ms: number) => M.top + plotH / 2 - (Math.max(-GOOD_MS, Math.min(GOOD_MS, ms)) / GOOD_MS) * (plotH / 2);
  const vy = (v: number) => M.top + plotH - ((v - 1) / 126) * plotH;
  const labelEvery = Math.ceil(bars / 16);
  const hits = points.filter((p): p is GraphPoint & { offsetMs: number } => p.offsetMs !== null);
  const vLine = hits.filter((p) => p.velocity !== null).sort((a, b) => a.x - b.x);

  const band = (ms: number, color: string, alpha: number) => (
    <rect x={M.left} y={y(ms)} width={plotW} height={y(-ms) - y(ms)} fill={color} opacity={alpha} />
  );

  return (
    // The card's full width: duo-details spans it across the grid, on the card's solid panel.
    <section data-testid="take-graph" style={{ width: "100%", boxSizing: "border-box", color: ink, fontSize: 14, textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span style={{ color: inkDim }}>
          Timing per note · <span style={{ color: handColor("R") }}>●</span> right hand{" "}
          <span style={{ color: handColor("L") }}>■</span> left hand{velocity ? " · line: velocity" : " · laptop keys sense no velocity"}
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
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Timing of every note over the song" style={{ display: "block" }}>
          {band(GOOD_MS, c.GOOD, 0.06)}
          {band(GREAT_MS, c.GREAT, 0.1)}
          {band(PERFECT_MS, c.PERFECT, 0.14)}
          {[GOOD_MS, -GOOD_MS].map((ms) => (
            <line key={ms} x1={M.left} x2={M.left + plotW} y1={y(ms)} y2={y(ms)} stroke={c.GOOD} strokeDasharray="4 4" opacity={0.6} />
          ))}
          <line x1={M.left} x2={M.left + plotW} y1={y(0)} y2={y(0)} stroke={inkDim} />
          {[GOOD_MS, GREAT_MS, PERFECT_MS, 0, -PERFECT_MS, -GREAT_MS, -GOOD_MS].map((ms) => (
            <text key={ms} x={M.left - 6} y={y(ms)} fill={inkDim} fontSize={11} textAnchor="end" dominantBaseline="middle">
              {ms === 0 ? "0" : `${ms > 0 ? "+" : "−"}${Math.abs(ms)}`}
            </text>
          ))}
          <text x={8} y={M.top + 4} fill={inkDim} fontSize={11} dominantBaseline="hanging">late</text>
          <text x={8} y={M.top + plotH - 4} fill={inkDim} fontSize={11}>early</text>
          {Array.from({ length: bars + 1 }, (_, b) => (
            <g key={b}>
              <line x1={x(b)} x2={x(b)} y1={M.top + plotH} y2={M.top + plotH + 4} stroke={inkDim} />
              {b < bars && b % labelEvery === 0 && (
                <text x={x(b + 0.5)} y={H - 8} fill={inkDim} fontSize={11} textAnchor="middle">{b + 1}</text>
              )}
            </g>
          ))}
          {velocity && vLine.length > 1 && (
            <>
              <polyline points={vLine.map((p) => `${x(p.x)},${vy(p.velocity!)}`).join(" ")} fill="none" stroke={gold} strokeWidth={1} opacity={0.5} />
              {[1, 64, 127].map((v) => (
                <text key={v} x={W - M.right + 6} y={vy(v)} fill={inkDim} fontSize={11} dominantBaseline="middle">{v}</text>
              ))}
            </>
          )}
          {wrong.map((bx, i) => (
            <line key={`w${i}`} x1={x(bx)} x2={x(bx)} y1={M.top - 10} y2={M.top} stroke={c.wrong} strokeWidth={2}>
              <title>WRONG note</title>
            </line>
          ))}
          {points.map((p) => {
            const label = describePoint(p, velocity);
            const cx = x(p.x);
            if (p.offsetMs === null) {
              const cy = y(0);
              return (
                <g key={p.noteId} tabIndex={0} role="img" aria-label={label} stroke={c.MISS} strokeWidth={2}>
                  <title>{label}</title>
                  <line x1={cx - 4} x2={cx + 4} y1={cy - 4} y2={cy + 4} />
                  <line x1={cx - 4} x2={cx + 4} y1={cy + 4} y2={cy - 4} />
                </g>
              );
            }
            const cy = y(p.offsetMs);
            return (
              <g key={p.noteId} tabIndex={0} role="img" aria-label={label} fill={handColor(p.hand)}>
                <title>{label}</title>
                {p.hand === "R" ? <circle cx={cx} cy={cy} r={3.5} /> : <rect x={cx - 3.5} y={cy - 3.5} width={7} height={7} />}
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
