"use client";
// The music select's two pieces in the Duo look (spec: duo-select, frame F-duo-1): the focused song's bracketed panel
// and one song row, built from the Duo kit (duo-tokens). select-layout places them and owns the keys and links; these
// only draw, and say when PLAY, PRACTICE, LEARN or WATCH is pressed.
import { useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { nextForKey, type NextFor } from "../duo-results/scores";
import { Brackets, Button, DataCell, MonoLabel, Panel } from "../duo-tokens";
import { LadderMark } from "../play-modes";
import { nextForText, nextForUrl, readNextFor } from "./next-for";
import { PianoRoll } from "./PianoRoll";
import type { Roll } from "./roll";
import styles from "./select.module.css";

// The composer's name without its trailing note ("Traditional (French melody …)" → "Traditional"), for one-line
// labels; the full attribution stays in the line's tooltip and the chart's source (#884).
export const shortComposer = (composer: string) => composer.replace(/\s*\([^)]*\)\s*$/, "") || composer;

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
  onLearn?: () => void; // learn-from-select's L, as a button (mouse-first)
  onWatch?: () => void; // watch-demo's W, as a button (mouse-first)
  children?: ReactNode; // under the buttons: the level toggle, the preview's options and status
}

const fill: CSSProperties = { display: "flex", flexDirection: "column", minHeight: 0 };

export function FocusPanel(p: FocusPanelProps) {
  const next = useNextFor(p.id);
  return (
    <Brackets style={{ ...fill, flex: "1 1 auto" }}>
      <Panel style={{ ...fill, flex: "1 1 auto", padding: "clamp(14px, 1.4vw, 26px)" }}>
        <section className={styles.panel} aria-live="polite" data-testid="focus-panel">
          <div className={styles.roll} style={{ viewTransitionName: "stage-jacket" }}>
            <PianoRoll roll={p.roll} />
          </div>
          <h2 className={styles.title}>{p.title}</h2>
          <MonoLabel style={{ fontSize: "clamp(14px, 1.1vw, 21px)" }}>
            <span className={styles.composer} title={p.composer}>
              {shortComposer(p.composer)}
              {p.catalog && ` · ${p.catalog}`}
            </span>
          </MonoLabel>
          <Panel style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: "2.2vh", flex: "none" }}>
            <DataCell label={<span className={styles.cellLabel}>LV</span>} value={<span data-testid="cell-lv">{lv(p.level)}</span>} style={{ ...cell, borderLeft: "none" }} />
            <DataCell label={<span className={styles.cellLabel}>NOTES</span>} value={<span data-testid="cell-notes">{p.notes}</span>} style={cell} />
            <DataCell label={<span className={styles.cellLabel}>BEST</span>} value={<span data-testid="cell-best">{p.best ? `${(p.best.accuracy * 100).toFixed(1)}%` : "—"}</span>} style={cell} />
          </Panel>
          <LadderMark song={p.id} />
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
            {/* 2×2 (mouse-first): PLAY primary, then the three ways in that were keys only. Keys stay in title and aria. */}
            <Button kind="primary" onClick={p.onPlay} title="Play (Enter)" aria-keyshortcuts="Enter" data-testid="select-play" style={buttonSize}>
              PLAY
            </Button>
            <Button kind="secondary" onClick={p.onPractice ?? undefined} disabled={!p.onPractice} title="Practice (P)" aria-keyshortcuts="P" data-testid="select-practice" style={buttonSize}>
              PRACTICE
            </Button>
            {p.onLearn && (
              <Button kind="secondary" onClick={p.onLearn} title="Learn: the song waits for each note (L)" aria-keyshortcuts="L" data-testid="select-learn" style={buttonSize}>
                LEARN
              </Button>
            )}
            {p.onWatch && (
              <Button kind="secondary" onClick={p.onWatch} title="Watch the perfect bot play it (W)" aria-keyshortcuts="W" data-testid="select-watch" style={buttonSize}>
                WATCH
              </Button>
            )}
          </div>
          {p.children && <div className={styles.extras}>{p.children}</div>}
        </section>
      </Panel>
    </Brackets>
  );
}

// The kit's 10 px, in vh: about the same at 1080, and 6 px back at 720 (#863).
const cell: CSSProperties = { paddingTop: "1vh", paddingBottom: "1vh" };
const buttonSize: CSSProperties = { fontSize: "clamp(15px, 1.2vw, 23px)", padding: "1.2vh 0", letterSpacing: "0.16em" };

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

// A row's read text, in vh so a taller screen shows more rows rather than bigger ones (main-page): 16 px at 720, 24
// px at 1080 (visual-direction.md).
const rowRead = "clamp(16px, 2.25vh, 24px)";

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
          <MonoLabel style={{ fontSize: rowRead, minWidth: 0, flex: "1 1 0" }}>
            <span className={styles.rowComposer} title={composer}>
              {shortComposer(composer)}
            </span>
          </MonoLabel>
        </div>
        <div className={styles.rowLevel}>
          <MonoLabel style={{ fontSize: rowRead }}>LV</MonoLabel> <b>{lv(level)}</b>
        </div>
      </div>
    </Panel>
  );
}
