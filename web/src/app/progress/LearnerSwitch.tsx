"use client";

import { useEffect, useState } from "react";
import type { RosterEntry } from "../../data/synthetic/roster";

// The switch on top of /progress: show the page as one of the 200 synthetic learners, then come back. It only changes
// ?as= in the address; the signed-in session is never touched. Violet marks "someone else" the way cyan marks you.

const synthetic = "var(--pa-secondary)";

/** The learners the server offers, or null while loading and when the take store isn't set up (no switch then). */
export function useLearners(): RosterEntry[] | null {
  const [learners, setLearners] = useState<RosterEntry[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/progress/learners")
      .then((r) => (r.ok ? (r.json() as Promise<{ learners: RosterEntry[] }>) : null))
      .then((body) => live && body && setLearners(body.learners))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return learners;
}

export const inputName = (input: RosterEntry["input"]) => (input === "midi" ? "piano" : "laptop keys");

/** Starting levels in order of how well their learners play, so the list reads from beginner up. */
function byLevel(learners: RosterEntry[]): [string, RosterEntry[]][] {
  const groups = new Map<string, RosterEntry[]>();
  for (const l of learners) groups.set(l.level, [...(groups.get(l.level) ?? []), l]);
  const mean = (ls: RosterEntry[]) => ls.reduce((a, l) => a + l.accuracy, 0) / ls.length;
  return [...groups].sort((a, b) => mean(a[1]) - mean(b[1]));
}

export function LearnerSwitch({ learners, as, onPick }: { learners: RosterEntry[]; as: string | null; onPick: (id: string | null) => void }) {
  const picker = (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0, maxWidth: "100%" }}>
      <span style={{ color: as ? "var(--pa-ink-dim)" : "var(--pa-ink)", whiteSpace: "nowrap" }}>{as ? "Switch to" : "Try a synthetic learner"}</span>
      <select value={as ?? ""} onChange={(e) => onPick(e.target.value || null)} style={select} data-testid="learner-switch">
        {!as && <option value="">Pick one of {learners.length}…</option>}
        {byLevel(learners).map(([level, ls]) => (
          <optgroup key={level} label={`${level} (${ls.length})`}>
            {ls.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} · {l.takes} takes · {Math.round(l.accuracy * 100)}% · {inputName(l.input)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  if (!as)
    return (
      <div style={{ ...band, borderColor: "var(--pa-line)", borderLeftColor: synthetic }} data-testid="learner-band">
        {picker}
        <span style={{ color: "var(--pa-ink-dim)", fontSize: 13 }}>Simulated students who start at different levels. Your account stays as it is.</span>
      </div>
    );

  return (
    <div role="status" style={{ ...band, borderColor: synthetic, background: "color-mix(in oklab, var(--pa-secondary) 9%, var(--pa-panel))" }} data-testid="learner-band">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: synthetic, boxShadow: `0 0 10px ${synthetic}`, flex: "none" }} />
        <span>
          <strong style={{ color: synthetic, fontWeight: 700 }}>Synthetic learner</strong>, not a real student. Your account is unchanged.
        </span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginLeft: "auto", minWidth: 0, maxWidth: "100%" }}>
        {picker}
        <button type="button" onClick={() => onPick(null)} style={back} data-testid="learner-back">
          Back to your progress
        </button>
      </span>
    </div>
  );
}

const band: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "10px 24px",
  margin: "26px 0 6px", // clears the account chip, fixed top right
  padding: "10px 14px",
  border: "1px solid",
  borderLeftWidth: 3,
  borderRadius: 10,
  background: "var(--pa-panel)",
  fontSize: 14,
};
const select: React.CSSProperties = {
  colorScheme: "dark",
  flex: "0 1 auto",
  minWidth: 0,
  textOverflow: "ellipsis",
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid rgba(242,242,245,0.25)",
  background: "var(--pa-bg)",
  color: "var(--pa-ink)",
  font: "inherit",
  fontVariantNumeric: "tabular-nums",
  cursor: "pointer",
};
const back: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid var(--pa-cyan)",
  background: "transparent",
  color: "var(--pa-cyan)",
  font: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
