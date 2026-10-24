"use client";
// The dynamics results panel: a summary, one row per graded phrase, and the overall level (spec: dynamics).
import { summary, type DynamicsReport } from ".";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(Math.round(n))}`;

export function DynamicsPanel({ report }: { report: DynamicsReport }) {
  if (report.kind === "message") {
    return (
      <div data-testid="dynamics" style={{ fontSize: 14, opacity: 0.6 }}>
        Dynamics: {report.text}
      </div>
    );
  }
  const graded = report.phrases.filter((p) => p.verdict !== null);
  return (
    <div data-testid="dynamics" style={{ fontSize: 16, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 700 }}>Dynamics: {summary(report.phrases)}</div>
      {/* One row per graded phrase, wrapped into a compact grid so a long song doesn't push the results off screen. */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 16px", maxWidth: 720, margin: "0 auto", fontSize: 14 }}>
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
