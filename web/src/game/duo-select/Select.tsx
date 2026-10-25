"use client";
// The music select's two pieces in the Duo look (spec: duo-select, frame F-duo-1): the focused song's bracketed panel
// and one song row, built from the Duo kit (duo-tokens). select-layout places them and owns the keys and links; these
// only draw, and say when PLAY or PRACTICE is pressed.
import { useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { nextForKey, type NextFor } from "../duo-results/scores";
import { Brackets, Button, DataCell, MonoLabel, Panel } from "../duo-tokens";
import { nextForText, nextForUrl, readNextFor } from "./next-for";
import { PianoRoll } from "./PianoRoll";
import type { Roll } from "./roll";
import styles from "./select.module.css";

const lv = (n: number) => String(n).padStart(2, "0");

export interface FocusPanelProps {
  id: string;
  title: string;
  composer: string;
  catalog?: string;
  roll: Roll;
  level: number;
  notes: number;
  best?: { accuracy: number }; // records' best for this level; absent if never played
  onPlay: () => void;
  onPractice: (() => void) | null; // null until the chart is in (adaptive practice needs its phrases)
  children?: ReactNode; // under the buttons: the level toggle, the preview's options and status
}

const fill: CSSProperties = { display: "flex", flexDirection: "column", minHeight: 0 };

export function FocusPanel(p: FocusPanelProps) {
  const next = useNextFor(p.id);
  return (
    <Brackets style={{ ...fill, flex: "0 1 auto" }}>
      <Panel style={{ ...fill, flex: "0 1 auto", padding: "clamp(14px, 1.4vw, 26px)" }}>
        <section className={styles.panel} aria-live="polite" data-testid="focus-panel">
          <div className={styles.roll} style={{ viewTransitionName: "stage-jacket" }}>
            <PianoRoll roll={p.roll} />
          </div>
          <h2 className={styles.title}>{p.title}</h2>
          <MonoLabel style={{ fontSize: "clamp(14px, 1.1vw, 21px)" }}>
            <span className={styles.composer}>
              {p.composer}
              {p.catalog && ` · ${p.catalog}`}
            </span>
          </MonoLabel>
          <Panel style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: "2.2vh", flex: "none" }}>
            <DataCell label="LV" value={<span data-testid="cell-lv">{lv(p.level)}</span>} style={{ borderLeft: "none" }} />
            <DataCell label="NOTES" value={<span data-testid="cell-notes">{p.notes}</span>} />
            <DataCell label="BEST" value={<span data-testid="cell-best">{p.best ? `${(p.best.accuracy * 100).toFixed(1)}%` : "—"}</span>} />
          </Panel>
          {next && (
            <a className={styles.next} href={nextForUrl(next)} data-testid="next-for-you">
              <Panel style={{ display: "flex", alignItems: "center", gap: "1.1em", padding: "0.9vh 1em" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG */}
                <img src="/learning/companion-gator.svg" alt="" />
                <MonoLabel dim={false} style={{ fontSize: "clamp(13px, 1vw, 19px)", textTransform: "none", letterSpacing: "0.04em" }}>
                  {nextForText(next)}
                </MonoLabel>
              </Panel>
            </a>
          )}
          <div className={styles.buttons}>
            <Button kind="primary" onClick={p.onPlay} data-testid="select-play" style={buttonSize}>
              PLAY
            </Button>
            <Button kind="secondary" onClick={p.onPractice ?? undefined} disabled={!p.onPractice} data-testid="select-practice" style={buttonSize}>
              PRACTICE
            </Button>
          </div>
          {p.children && <div className={styles.extras}>{p.children}</div>}
        </section>
      </Panel>
    </Brackets>
  );
}

const buttonSize: CSSProperties = { fontSize: "clamp(15px, 1.2vw, 23px)", padding: "1.5vh 0", letterSpacing: "0.16em" };

// The browser's storage, read as a snapshot (none on the server), so the strip appears after hydration.
const noop = () => () => {};
function useNextFor(id: string): NextFor | null {
  const raw = useSyncExternalStore(
    noop,
    () => {
      try {
        return localStorage.getItem(nextForKey(id));
      } catch {
        return null; // storage blocked: no suggestion
      }
    },
    () => null,
  );
  return useMemo(() => readNextFor({ getItem: () => raw }, id), [raw, id]);
}

export function SongRow({ title, composer, level, roll, focused }: { title: string; composer: string; level: number; roll: Roll; focused: boolean }) {
  return (
    <Panel style={focused ? { border: "1px solid var(--pa-primary)", background: "color-mix(in srgb, var(--pa-primary) 7%, var(--pa-panel))", boxShadow: "inset 4px 0 0 var(--pa-primary)" } : undefined}>
      <div className={styles.row} data-focused={focused || undefined}>
        <div className={styles.rowRoll}>
          <PianoRoll roll={roll} />
        </div>
        <div className={styles.rowText}>
          <div className={styles.rowTitle} title={title}>
            {title}
          </div>
          <MonoLabel style={{ fontSize: "clamp(12px, 0.9vw, 17px)" }}>
            <span className={styles.rowComposer}>{composer}</span>
          </MonoLabel>
        </div>
        <div className={styles.rowLevel}>
          <MonoLabel style={{ fontSize: "clamp(12px, 0.85vw, 16px)" }}>LV</MonoLabel> <b>{lv(level)}</b>
        </div>
      </div>
    </Panel>
  );
}
