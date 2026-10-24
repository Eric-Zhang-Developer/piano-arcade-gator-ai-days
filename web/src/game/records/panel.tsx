"use client";
// The records results panel: NEW RECORD, the initials entry and the top 5 (spec: records).
import { useEffect, useState } from "react";
import { browserStorage, loadRecords, NO_INITIALS, saveRecords, setInitials, type Entry } from "./store";

export type Outcome =
  | { kind: "practice" }
  | { kind: "blocked" }
  | { kind: "recorded"; chartId: string; date: string; newRecord: boolean; inTop: boolean; top: Entry[] };

const A = "A".charCodeAt(0);
const cycle = (letter: string | undefined, step: number) => String.fromCharCode(A + (((letter ?? "A").charCodeAt(0) - A + step + 26) % 26));

export function RecordsPanel({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "practice") return <Line>Practice takes aren&apos;t recorded</Line>;
  if (outcome.kind === "blocked") return <Line>Records can&apos;t be saved in this browser</Line>;
  return <Recorded {...outcome} />;
}

function Recorded({ chartId, date, newRecord, inTop, top: initialTop }: Extract<Outcome, { kind: "recorded" }>) {
  const [top, setTop] = useState(initialTop);
  const [letters, setLetters] = useState<string[]>([]);
  const [entering, setEntering] = useState(inTop);

  useEffect(() => {
    if (!entering) return;
    // Capture phase, so Enter saves the initials instead of pressing the focused Retry button.
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^[a-z]$/i.test(k)) setLetters(letters.length < 3 ? [...letters, k.toUpperCase()] : letters);
      else if (k === "ArrowUp" || k === "ArrowDown") {
        const step = k === "ArrowUp" ? 1 : -1;
        setLetters(letters.length ? [...letters.slice(0, -1), cycle(letters.at(-1), step)] : [cycle(undefined, step === 1 ? 0 : -1)]);
      } else if (k === "Backspace") setLetters(letters.slice(0, -1));
      else if (k === "Enter") {
        if (letters.length === 3) {
          const storage = browserStorage();
          const stored = loadRecords(storage);
          if (stored) {
            const next = setInitials(stored, chartId, date, letters.join(""));
            if (saveRecords(storage, next)) setTop(next[chartId]?.top ?? top);
          }
          setEntering(false);
        }
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [entering, letters, chartId, date, top]);

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
              <td style={{ fontFamily: "monospace" }}>{t.date === date && entering ? letters.join("").padEnd(3, "_") : t.initials || NO_INITIALS}</td>
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
