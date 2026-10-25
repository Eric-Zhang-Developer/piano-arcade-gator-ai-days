"use client";
// The dynamics results panel: a summary, one row per graded phrase, and the overall level (spec: dynamics).
import { summary, type DynamicsReport } from ".";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(Math.round(n))}`;

// A message report gets no panel (duo-details): dynamics' resultsPanel returns null for it.
export function DynamicsPanel({ report }: { report: Extract<DynamicsReport, { kind: "graded" }> }) {
  const graded = report.phrases.filter((p) => p.verdict !== null);
  return (
    <div data-testid="dynamics" style={{ fontSize: 16, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700 }}>Dynamics: {summary(report.phrases)}</div>
      {/* One row per graded phrase, wrapped into a compact grid so a long song doesn't push the results off screen. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 16px", maxWidth: 720, fontSize: 14 }}>
        {graded.map((p) => (
          <div key={p.fromBar} data-testid={`dynamics-bars-${p.fromBar}`} style={{ opacity: p.verdict === "ok" ? 0.5 : 1, fontWeight: p.verdict === "ok" ? 400 : 700 }}>
            Bars {p.fromBar}–{p.toBar}: {p.verdict}, {signed(p.diff!)}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, opacity: 0.6 }}>
        You played at velocity {Math.round(report.playedMean)} on average; the score averages {Math.round(report.chartMean)}
      </div>
    </div>
  );
}
