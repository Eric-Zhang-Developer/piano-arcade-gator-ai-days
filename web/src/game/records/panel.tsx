"use client";
// The records results panel: NEW RECORD, the initials entry and the top 5 (spec: records).
import { useInitials } from "./initials";
import { NO_INITIALS, type Entry } from "./store";

export type Outcome =
  | { kind: "practice" }
  | { kind: "blocked" }
  | { kind: "recorded"; chartId: string; date: string; newRecord: boolean; inTop: boolean; top: Entry[] };

export function RecordsPanel({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "practice") return <Line>Practice takes aren&apos;t recorded</Line>;
  if (outcome.kind === "blocked") return <Line>Records can&apos;t be saved in this browser</Line>;
  return <Recorded {...outcome} />;
}

function Recorded({ chartId, date, newRecord, inTop, top }: Extract<Outcome, { kind: "recorded" }>) {
  const { letters, done, saved } = useInitials(chartId, date, inTop);
  const entering = inTop && !done;
  const initials = (t: Entry) => (t.date !== date ? t.initials : entering ? letters.join("").padEnd(3, "_") : saved ? letters.join("") : t.initials);

  return (
    <div data-testid="records" style={{ fontSize: 16, lineHeight: 1.6 }}>
      {newRecord && (
        <div data-testid="new-record" style={{ fontSize: 28, fontWeight: 800, color: "#ffd84a", animation: "records-flash 0.5s steps(2) infinite" }}>
          NEW RECORD
        </div>
      )}
      {entering && (
        <div data-testid="initials-entry">
          Your initials:{" "}
          <span style={{ fontFamily: "monospace", fontSize: 24, letterSpacing: 6 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ borderBottom: i === letters.length ? "2px solid #fff" : "2px solid transparent" }}>
                {letters[i] ?? "_"}
              </span>
            ))}
          </span>
          <div style={{ fontSize: 13, opacity: 0.6 }}>Type A–Z or ↑ ↓, Backspace to fix, Enter to save</div>
        </div>
      )}
      <table data-testid="top5" style={{ margin: "4px auto 0", fontSize: 14, borderSpacing: "16px 0", fontVariantNumeric: "tabular-nums" }}>
        <tbody>
          {top.map((t, i) => (
            <tr key={t.date} data-testid={t.date === date ? "top5-this-take" : undefined} style={{ fontWeight: t.date === date ? 700 : 400, opacity: t.date === date ? 1 : 0.7 }}>
              <td>{i + 1}.</td>
              <td style={{ fontFamily: "monospace" }}>{initials(t) || NO_INITIALS}</td>
              <td style={{ textAlign: "right" }}>{t.score.toLocaleString("en-US")}</td>
              <td>{t.rank}</td>
              <td style={{ textAlign: "right" }}>{(t.accuracy * 100).toFixed(1)}%</td>
              <td>{t.date === date ? "← this take" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style>{"@keyframes records-flash { 50% { opacity: 0.3 } }"}</style>
    </div>
  );
}

const Line = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="records" style={{ fontSize: 14, opacity: 0.6 }}>
    {children}
  </div>
);
