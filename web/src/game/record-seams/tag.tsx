"use client";
// The tail's tag (spec: record-seams): while the song's own recording plays on under the results, a lower-third slate
// says what it will do, with Stop music; a faint glow on the field breathes on its bar lines. audio-track renders it
// from its resultsPanel. It's portalled to the page, pinned in the first view, since the panel's own card sits in the
// details (results-layout's lists are #600's file).
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button, MonoLabel } from "../duo-tokens";
import styles from "./tag.module.css";

export interface TailView {
  kind: "fade" | "play-out";
  bar: number | null; // the bar line the fade ends on; null when it plays out
  startPerf: number; // performance.now() at songEnd
  endPerf: number; // … and when the tail ends
  barMs: number;
  barPhaseMs: number; // how far into its bar songEnd fell
}

export const tagText = (v: Pick<TailView, "kind" | "bar">) => (v.kind === "fade" ? `Fades at bar ${v.bar}` : "Plays out");

// The tag while audio-track's store says a tail plays; nothing once it ends.
export function TailPanel({ subscribe, get, onStop }: { subscribe: (l: () => void) => () => void; get: () => TailView | null; onStop: () => void }) {
  const view = useSyncExternalStore(subscribe, get, () => null);
  return view && <SeamTag view={view} onStop={onStop} />;
}

const read: CSSProperties = { fontSize: "clamp(16px, 1.25vw, 24px)" };
const noSubscribe = () => () => {};

export function SeamTag({ view, onStop }: { view: TailView; onStop: () => void }) {
  // Portals need the page; the server render (and the tests) get the tag in place.
  const body = useSyncExternalStore(noSubscribe, () => document.body, () => null);
  // The drain and the pulse are set from the mount, which is a little after songEnd: both start part-way in.
  const [mountPerf] = useState(() => (typeof performance === "undefined" ? view.startPerf : performance.now()));
  const left = Math.max(0, view.endPerf - mountPerf);
  const phase = view.barPhaseMs + mountPerf - view.startPerf;
  // Flush with the results card's right edge (its bottom band, the tutor's panel); the stylesheet's spot otherwise.
  const tagRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const align = () => {
      const card = document.querySelector('[data-testid="results"] [data-landing-after]')?.closest('[data-kit="panel"]');
      if (card && tagRef.current) tagRef.current.style.right = `${Math.max(0, window.innerWidth - card.getBoundingClientRect().right)}px`;
    };
    align();
    window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, []);
  const tag = (
    <>
      {/* ponytail: a plain bar-line pulse from the chart's bpm; once highway-field (#1122) lands, drive it from its downbeat. */}
      <div className={styles.pulse} aria-hidden data-testid="seam-pulse" style={{ animationDuration: `${view.barMs}ms`, animationDelay: `${-phase}ms` }} />
      <div ref={tagRef} className={styles.tag} role="status" data-testid="seam-tag">
        <span className={styles.note} aria-hidden>
          ♪
        </span>
        <MonoLabel dim={false} style={{ ...read, letterSpacing: "0.08em" }}>
          {tagText(view)}
        </MonoLabel>
        <Button kind="secondary" data-testid="stop-music" onClick={onStop} style={{ ...read, padding: "0.35em 1em" }}>
          Stop music
        </Button>
        <span className={styles.drain} aria-hidden style={{ animationDuration: `${left}ms` }} />
      </div>
    </>
  );
  return body ? createPortal(tag, body) : tag;
}
