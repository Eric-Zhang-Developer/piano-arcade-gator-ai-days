"use client";
// The music select's two pieces in the Duo look (spec: duo-select, frame F-duo-1): the focused song's bracketed panel
// and one song row. select-layout places them and owns the keys and links; these only draw.
// ponytail: brackets, buttons and data cells are local CSS on main's tokens until duo-tokens' kit (#655) lands; then
// they move onto the kit.
import { useMemo, useSyncExternalStore, type MouseEvent, type ReactNode } from "react";
import { nextForKey, type NextFor } from "../duo-results/scores";
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
  playHref: string;
  practiceHref: string | null; // null until the chart is in (adaptive practice needs its phrases)
  onPlay?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children?: ReactNode; // under the buttons: the level toggle, the preview's options and status
}

export function FocusPanel(p: FocusPanelProps) {
  const next = useNextFor(p.id);
  return (
    <section className={styles.panel} aria-live="polite" data-testid="focus-panel">
      <div className={styles.roll} style={{ viewTransitionName: "stage-jacket" }}>
        <PianoRoll roll={p.roll} />
      </div>
      <h2 className={styles.title}>{p.title}</h2>
      <p className={styles.composer}>
        {p.composer}
        {p.catalog && ` · ${p.catalog}`}
      </p>
      <dl className={styles.cells}>
        <div>
          <dt>LV</dt>
          <dd data-testid="cell-lv">{lv(p.level)}</dd>
        </div>
        <div>
          <dt>NOTES</dt>
          <dd data-testid="cell-notes">{p.notes}</dd>
        </div>
        <div>
          <dt>BEST</dt>
          <dd data-testid="cell-best">{p.best ? `${(p.best.accuracy * 100).toFixed(1)}%` : "—"}</dd>
        </div>
      </dl>
      {next && (
        <a className={styles.next} href={nextForUrl(next)} data-testid="next-for-you">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small static SVG */}
          <img src="/learning/companion-gator.svg" alt="" />
          <span>{nextForText(next)}</span>
        </a>
      )}
      <div className={styles.buttons}>
        <a className={styles.play} href={p.playHref} onClick={p.onPlay} data-testid="select-play">
          PLAY
        </a>
        {p.practiceHref ? (
          <a className={styles.practice} href={p.practiceHref} data-testid="select-practice">
            PRACTICE
          </a>
        ) : (
          <span className={styles.practice} aria-disabled>
            PRACTICE
          </span>
        )}
      </div>
      {p.children && <div className={styles.extras}>{p.children}</div>}
    </section>
  );
}

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
    <div className={styles.row} data-focused={focused || undefined}>
      <div className={styles.rowRoll}>
        <PianoRoll roll={roll} />
      </div>
      <div className={styles.rowText}>
        <div className={styles.rowTitle} title={title}>
          {title}
        </div>
        <div className={styles.rowComposer}>{composer}</div>
      </div>
      <div className={styles.rowLevel}>
        <span>LV</span> <b>{lv(level)}</b>
      </div>
    </div>
  );
}
