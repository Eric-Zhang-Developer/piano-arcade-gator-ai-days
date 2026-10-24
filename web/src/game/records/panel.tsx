"use client";
// The records results panel: the initials entry and the top 5 (spec: records). NEW RECORD is record-moment's.
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
  // A NEW RECORD take's entry is record-moment's: the card then shows only the top 5, with the letters as they're
  // typed there. Any other top-5 take keeps its entry here.
  const { letters, done, saved } = useInitials(chartId, date, inTop && !newRecord);
  const entering = inTop && !done;
  const initials = (t: Entry) => (t.date !== date ? t.initials : entering ? letters.join("").padEnd(3, "_") : saved ? letters.join("") : t.initials);

  return (
    <div data-testid="records" style={{ fontSize: 16, lineHeight: 1.6 }}>
      {entering && !newRecord && (
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
    </div>
  );
}

const Line = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="records" style={{ fontSize: 14, opacity: 0.6 }}>
    {children}
  </div>
);
