"use client";
// Record moment (spec: record-moment): once the rank has stamped, NEW RECORD stamps in gold and the initials entry
// reads like an arcade high-score table, three big cells with the current one lit. The keys are records' entry
// (useInitials), live from the first frame, so letters typed during the reveal are kept.
import type { CSSProperties } from "react";
import type { GamePlugin } from "../../contracts";
import { stampKeyframes } from "../rank-stamp";
import { takeOutcome, useInitials } from "../records";
import styles from "./record-moment.module.css";
import { momentSettings, momentTimes, showsMoment } from "./timing";

export function RecordMoment({ chartId, date }: { chartId: string; date: string }) {
  const { letters, done, saved } = useInitials(chartId, date, true);
  const t = momentTimes();
  const vars = { "--rm-start": `${t.startMs}ms`, "--rm-stamp": `${momentSettings.stampMs}ms`, "--rm-cells": `${t.cellsAtMs}ms`, "--rm-rise": `${momentSettings.cellsMs}ms` } as CSSProperties;
  return (
    <section className={styles.moment} style={vars} data-testid="record-moment">
      <style>{stampKeyframes("record-moment-stamp")}</style>
      <div className={styles.stamp} data-testid="new-record">
        NEW RECORD
      </div>
      <InitialsSaid letters={letters} done={done} saved={saved} />
      {done ? (
        <div className={styles.saved} data-testid="initials-saved">
          {letters.join("")} · {saved ? "saved" : "couldn't be saved"}
        </div>
      ) : (
        <div className={styles.entry} data-testid="initials-entry">
          <div className={styles.cells} role="group" aria-label={`Your initials: ${letters.join(" ") || "none yet"}`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i === letters.length ? `${styles.cell} ${styles.lit}` : styles.cell}>
                {letters[i] ?? ""}
              </span>
            ))}
          </div>
          <div className={styles.hint}>A–Z or ↑ ↓ · Backspace · Enter saves</div>
        </div>
      )}
    </section>
  );
}

// One polite live region for the entry (#1247): the letters so far, then the saved line. Visually hidden: the cells and
// the line above already show it, and the look doesn't change.
export function InitialsSaid({ letters, done, saved }: { letters: string[]; done: boolean; saved: boolean }) {
  const text = done ? `${letters.join("")} · ${saved ? "saved" : "couldn't be saved"}` : letters.length ? `Initials: ${letters.join(" ")}` : "";
  return (
    <p className={styles.said} role="status" aria-live="polite" data-testid="initials-said">
      {text}
    </p>
  );
}

// Not in layers.ts yet: records' fix moves the entry here and registers this in one merge (the spec's Plan).
export function recordMoment(): GamePlugin {
  return {
    id: "record-moment",
    resultsPanel: () => {
      const o = takeOutcome();
      return showsMoment(o) ? <RecordMoment chartId={o.chartId} date={o.date} /> : null;
    },
  };
}
