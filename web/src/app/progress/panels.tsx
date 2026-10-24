"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatDuration, type SessionRow } from "../../data/progress";

// The profile's panels. Charts follow the dataviz method: one series per chart, recessive grid, a hover tooltip and
// a table view; identity is never color alone (judgments are labeled, hands are named). Colors are the game's own:
// the judgment tones from the results screen, the hands from the highway, cyan for "you".

const display = "var(--pa-font-display), system-ui, sans-serif";
export const panel: React.CSSProperties = {
  padding: "16px 18px",
  background: "var(--pa-panel)",
  border: "1px solid rgba(242,242,245,0.14)",
  borderRadius: 10,
};
export const panelTitle: React.CSSProperties = {
  margin: "0 0 12px",
  fontFamily: display,
  fontStyle: "italic",
  fontWeight: 800,
  fontSize: 16,
  letterSpacing: 1.5,
  textTransform: "uppercase",
};
const dim = "var(--pa-ink-dim)";
const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const longWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...panel, padding: "12px 16px" }}>
      <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: dim }}>{label}</div>
      <div
        style={{ fontFamily: display, fontStyle: "italic", fontWeight: 900, fontSize: value.length > 9 ? 20 : 30, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        title={value}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Accuracy per session, oldest to newest: one line, a dot per session, a crosshair tooltip, and a table view. */
export function AccuracyChart({ sessions }: { sessions: SessionRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const pts = [...sessions].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const W = 640, H = 200, L = 40, R = 12, T = 12, B = 26;
  const x = (i: number) => (pts.length < 2 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (a: number) => T + (1 - a) * (H - T - B);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(p.accuracy)).toFixed(1)}`).join(" ");
  const h = hover === null ? null : pts[hover];
  return (
    <section style={panel} data-testid="accuracy-chart">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={panelTitle}>Accuracy over time</h2>
        <button onClick={() => setAsTable(!asTable)} style={tableToggle}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      {asTable ? (
        <SimpleTable head={["When", "Song", "Accuracy", "Rank"]} rows={[...pts].reverse().map((p) => [longWhen(p.created_at), p.title, pct(Number(p.accuracy)), p.rank])} />
      ) : (
        <div style={{ position: "relative" }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Accuracy over ${pts.length} sessions`} style={{ display: "block", overflow: "visible" }}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - box.left) / box.width) * W;
              let best = 0;
              pts.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
              setHover(pts.length ? best : null);
            }}>
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="rgba(242,242,245,0.08)" strokeWidth={1} />
                <text x={L - 8} y={y(g) + 4} textAnchor="end" fontSize={11} fill="rgba(242,242,245,0.55)">{g * 100}%</text>
              </g>
            ))}
            {pts.length > 1 && <path d={path} fill="none" stroke="var(--pa-cyan)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
            {pts.map((p, i) => (
              <circle key={p.take_id} cx={x(i)} cy={y(Number(p.accuracy))} r={hover === i ? 6 : 4} fill="var(--pa-cyan)" stroke="#000" strokeWidth={2} />
            ))}
            {h && hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="rgba(242,242,245,0.35)" strokeWidth={1} strokeDasharray="3 3" />}
            {pts.length > 0 && (
              <>
                <text x={x(0)} y={H - 6} fontSize={11} fill="rgba(242,242,245,0.55)" textAnchor={pts.length > 1 ? "start" : "middle"}>{shortDate(pts[0].created_at)}</text>
                {pts.length > 1 && <text x={x(pts.length - 1)} y={H - 6} fontSize={11} fill="rgba(242,242,245,0.55)" textAnchor="end">{shortDate(pts[pts.length - 1].created_at)}</text>}
              </>
            )}
          </svg>
          {h && hover !== null && (
            <div role="status" style={{ ...tooltip, left: `${(x(hover) / W) * 100}%` }}>
              <strong>{pct(Number(h.accuracy))}</strong> · rank {h.rank}
              <div style={{ color: dim }}>{h.title}</div>
              <div style={{ color: dim }}>{longWhen(h.created_at)} · {formatDuration(h.duration_ms)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Minutes played per day, 12 weeks, Monday-first columns: one hue, darker = more. Hover a day for its numbers. */
export function PracticeCalendar({ days }: { days: { day: string; date: Date; minutes: number; sessions: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // On a narrow screen the calendar scrolls sideways: open on the latest weeks, not the oldest.
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [days.length]);
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const lead = (days[0].date.getDay() + 6) % 7; // blank cells before the first day so rows are weekdays
  const cells: (typeof days[number] | null)[] = [...Array(lead).fill(null), ...days];
  const weeks = Math.round(days.length / 7);
  const h = days.find((d) => d.day === hover);
  const total = days.reduce((a, d) => a + d.minutes, 0);
  const shade = (m: number) => (m <= 0 ? "rgba(242,242,245,0.06)" : `color-mix(in oklab, var(--pa-cyan) ${Math.round(30 + 70 * (m / max))}%, #000)`);
  return (
    <section style={panel} data-testid="practice-calendar">
      <h2 style={panelTitle}>Practice calendar</h2>
      <div ref={scroller} style={{ display: "flex", gap: 6, alignItems: "flex-start", overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "grid", gridTemplateRows: `repeat(7, ${CELL}px)`, gap: 4, fontSize: 11, color: dim }}>
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => <div key={i} style={{ lineHeight: `${CELL}px` }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoFlow: "column", gridAutoColumns: `${CELL}px`, gap: 4 }} onMouseLeave={() => setHover(null)}>
          {cells.map((c, i) =>
            c ? (
              <div key={c.day} onMouseEnter={() => setHover(c.day)} title={`${c.date.toDateString()}: ${c.minutes} min`}
                style={{ width: CELL, height: CELL, borderRadius: 4, background: shade(c.minutes), outline: hover === c.day ? "2px solid var(--pa-ink)" : "none" }} />
            ) : (
              <div key={`pad-${i}`} />
            ),
          )}
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: dim, minHeight: 18 }} role="status">
        {h ? `${h.date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${h.minutes} min, ${h.sessions} session${h.sessions === 1 ? "" : "s"}` : `${Math.round(total)} min over the last ${weeks} weeks`}
      </div>
    </section>
  );
}

const CELL = 20; // px per day square

const TONES = [
  { key: "perfect", label: "Perfect", color: "var(--pa-gold)" },
  { key: "great", label: "Great", color: "#5ef2c4" },
  { key: "good", label: "Good", color: "var(--pa-good)" },
  { key: "miss", label: "Miss", color: "var(--pa-miss)" },
] as const;

/** Every judged note, as one stacked bar in the results screen's judgment colors, labeled, with a legend. */
export function JudgmentBar({ mix }: { mix: { perfect: number; great: number; good: number; miss: number; notes: number } }) {
  return (
    <section style={panel} data-testid="judgment-mix">
      <h2 style={panelTitle}>Every note you played</h2>
      {mix.notes === 0 ? (
        <p style={{ color: dim, margin: 0 }}>No judged notes yet.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 2, height: 22, borderRadius: 4, overflow: "hidden" }} role="img"
            aria-label={TONES.map((t) => `${t.label} ${mix[t.key]}`).join(", ")}>
            {TONES.filter((t) => mix[t.key] > 0).map((t) => (
              <div key={t.key} title={`${t.label}: ${mix[t.key]} (${pct(mix[t.key] / mix.notes)})`} style={{ flex: mix[t.key], background: t.color, minWidth: 3 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 10, fontSize: 13 }}>
            {TONES.map((t) => (
              <span key={t.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: t.color, display: "inline-block" }} />
                {t.label} <strong>{mix[t.key]}</strong> <span style={{ color: dim }}>{pct(mix[t.key] / mix.notes)}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Left and right hand side by side: notes, hit rate, and timing in words (early / late, and how steady). */
export function HandsPanel({ hands }: { hands: { hand: "L" | "R"; notes: number; hitRate: number | null; meanOffset: number | null; spread: number | null }[] }) {
  const words = (off: number | null) => (off === null ? "no hits yet" : Math.abs(off) < 3 ? "right on the beat" : `${Math.abs(off)} ms ${off > 0 ? "late" : "early"} on average`);
  return (
    <section style={panel} data-testid="hands">
      <h2 style={panelTitle}>Your hands</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {hands.map((h) => (
          <div key={h.hand} style={{ borderLeft: `3px solid ${h.hand === "L" ? "var(--pa-hand-l)" : "var(--pa-hand-r)"}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: dim }}>{h.hand === "L" ? "Left hand" : "Right hand"}</div>
            {h.notes === 0 ? (
              <div style={{ color: dim, marginTop: 6 }}>Not played yet</div>
            ) : (
              <>
                <div style={{ fontFamily: display, fontStyle: "italic", fontWeight: 900, fontSize: 28 }}>{pct(h.hitRate)}</div>
                <div style={{ fontSize: 13, color: dim }}>hit · {h.notes} notes</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{words(h.meanOffset)}</div>
                {h.spread !== null && <div style={{ fontSize: 13, color: dim }}>spread ±{h.spread} ms</div>}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Each song you've played: sessions, time, best rank and accuracy, and whether you're improving. */
export function SongsTable({ songs }: { songs: ReturnType<typeof import("../../data/progress").songStats> }) {
  return (
    <section style={panel} data-testid="songs">
      <h2 style={panelTitle}>Your songs</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>{["Song", "Sessions", "Time", "Best", "Best accuracy", "Latest", "Since first", "Best combo", "Last played"].map((c) => <th key={c} style={th}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {songs.map((s) => (
              <tr key={s.song_id}>
                <td style={td}>
                  <Link href={`/progress?song=${encodeURIComponent(s.song_id)}`} style={{ color: "var(--pa-cyan)", textDecoration: "none" }}>{s.title}</Link>
                  <div style={{ fontSize: 12, color: dim }}>{s.composer}</div>
                </td>
                <td style={td}>{s.sessions}</td>
                <td style={td}>{formatDuration(s.totalMs)}</td>
                <td style={{ ...td, fontWeight: 800, color: "var(--pa-gold)" }}>{s.bestRank}</td>
                <td style={td}>{pct(s.bestAccuracy)}</td>
                <td style={td}>{pct(s.latestAccuracy)}</td>
                <td style={td}>{s.change === null ? <span style={{ color: dim }}>one session</span> : `${s.change >= 0 ? "▲ +" : "▼ "}${(s.change * 100).toFixed(1)} pts`}</td>
                <td style={td}>{s.bestCombo}</td>
                <td style={td}>{shortDate(s.lastPlayed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", maxHeight: 220 }}>
      <table style={tableStyle}>
        <thead><tr>{head.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export const tableStyle: React.CSSProperties = { borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", width: "100%", minWidth: 560 };
export const th: React.CSSProperties = { textAlign: "left", padding: "6px 16px 6px 0", color: dim, fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" };
export const td: React.CSSProperties = { padding: "8px 16px 8px 0", borderTop: "1px solid rgba(242,242,245,0.08)", whiteSpace: "nowrap", fontSize: 14 };
const tableToggle: React.CSSProperties = { border: "1px solid rgba(242,242,245,0.25)", background: "transparent", color: dim, borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer" };
const tooltip: React.CSSProperties = {
  position: "absolute", top: 0, transform: "translate(-50%, -105%)", pointerEvents: "none", whiteSpace: "nowrap",
  background: "#111118", border: "1px solid rgba(242,242,245,0.25)", borderRadius: 6, padding: "6px 10px", fontSize: 13, zIndex: 2,
};
