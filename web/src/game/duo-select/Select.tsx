"use client";
// The music select's two pieces in the Duo look (spec: duo-select, frame F-duo-1): the focused song's bracketed panel
// and one song row, built from the Duo kit (duo-tokens). select-layout places them and owns the keys and links; these
// only draw, and say when PLAY, PRACTICE, LEARN or WATCH is pressed.
import { useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { nextForKey, type NextFor } from "../duo-results/scores";
import { Brackets, Button, MonoLabel, Panel } from "../duo-tokens";
import { LadderMark } from "../play-modes";
import { panelFrames, useMoveAnimation } from "../select-motion";
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
  onPractice: (() => void) | null; // Flow: null until the chart is in (adaptive practice needs its phrases)
  onLearn?: () => void; // learn-from-select's L, as the ladder's first rung (mouse-first)
  children?: ReactNode; // in the Practice panel: the level toggle, the preview's options and source
}

const fill: CSSProperties = { display: "flex", flexDirection: "column", minHeight: 0 };

// One Play, one Practice (#1411, select-calm): the ladder, speed and level wait in the Practice panel, so the card
// reads as a song and a way in, not a control board.
export function FocusPanel(p: FocusPanelProps) {
  const next = useNextFor(p.id);
  const ref = useRef<HTMLElement>(null);
  const [practice, setPractice] = usePracticeOpen(); // stays open from song to song, and across a reload
  useMoveAnimation(ref, panelFrames); // select-motion: the panel stays mounted and moves with the focus
  return (
    <Brackets style={{ ...fill, flex: "1 1 auto" }}>
      <Panel style={{ ...fill, flex: "1 1 auto", padding: "clamp(14px, 1.4vw, 26px)" }}>
        <section ref={ref} className={styles.panel} data-practice={practice || undefined} data-testid="focus-panel">
          {/* An arrow step reads the song, not the whole panel and its buttons (#1236). */}
          <p className={styles.srOnly} aria-live="polite" data-testid="focus-live">
            {`${p.title}, ${shortComposer(p.composer)}, level ${p.level}`}
          </p>
          <div className={styles.roll} style={{ viewTransitionName: "stage-jacket" }}>
            <PianoRoll roll={p.roll} />
          </div>
          <h2 className={styles.title}>{p.title}</h2>
          <p className={styles.composer} title={p.composer}>
            {shortComposer(p.composer)}
            {p.catalog && ` · ${p.catalog}`}
          </p>
          <p className={styles.meta}>
            Lv <span data-testid="cell-lv">{p.level}</span> · <span data-testid="cell-notes">{p.notes}</span> notes · best{" "}
            <span data-testid="cell-best">{p.best ? `${(p.best.accuracy * 100).toFixed(1)}%` : "—"}</span>
          </p>
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
            <Button kind="primary" onClick={p.onPlay} title="Play (Enter)" aria-keyshortcuts="Enter" data-testid="select-play" style={buttonSize}>
              PLAY
            </Button>
            <Button
              kind="secondary"
              onClick={() => setPractice(!practice)}
              aria-expanded={practice}
              aria-controls="practice-panel"
              data-testid="practice-open"
              style={buttonSize}
            >
              PRACTICE {practice ? "▴" : "▾"}
            </Button>
          </div>
          <div id="practice-panel" className={styles.practice} hidden={!practice} data-testid="practice-panel">
            <LadderMark song={p.id} on={{ learn: p.onLearn, flow: p.onPractice ?? undefined, perform: p.onPlay }} />
            {p.children && <div className={styles.extras}>{p.children}</div>}
          </div>
        </section>
      </Panel>
    </Brackets>
  );
}

const buttonSize: CSSProperties = { fontSize: "clamp(15px, 1.2vw, 23px)", padding: "1.2vh 0", letterSpacing: "0.16em" };

// The Practice panel's open state, kept so a player who practises finds it open again. Storage that throws: closed.
const PRACTICE_KEY = "pianoArcade.practiceOpen";
const practiceListeners = new Set<() => void>();
function usePracticeOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    (l) => (practiceListeners.add(l), () => void practiceListeners.delete(l)),
    () => {
      try {
        return localStorage.getItem(PRACTICE_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(PRACTICE_KEY, v ? "1" : "0");
    } catch {}
    practiceListeners.forEach((l) => l());
  };
  return [open, set];
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

// A row's read text, in vh so a taller screen shows more rows rather than bigger ones (main-page): 16 px at 720, 24
// px at 1080 (visual-direction.md).
const rowRead = "clamp(16px, 2.25vh, 24px)";

// The focused row's look is select-motion's bar, which moves between rows; the row only says it's the one.
export function SongRow({ title, composer, level, roll, focused }: { title: string; composer: string; level: number; roll: Roll; focused: boolean }) {
  return (
    <Panel>
      <div className={styles.row} data-focused={focused || undefined}>
        {/* The roll only on the focused row (#1411): fifty small rolls read as noise; the column stays, so titles align. */}
        <div className={styles.rowRoll}>{focused && <PianoRoll roll={roll} />}</div>
        <div className={styles.rowText}>
          <div className={styles.rowTitle} title={title}>
            {title}
          </div>
          <span className={styles.rowComposer} title={composer} style={{ fontSize: rowRead }}>
            {shortComposer(composer)}
          </span>
        </div>
        <div className={styles.rowLevel}>
          <MonoLabel style={{ fontSize: rowRead }}>LV</MonoLabel> <b>{lv(level)}</b>
        </div>
      </div>
    </Panel>
  );
}
