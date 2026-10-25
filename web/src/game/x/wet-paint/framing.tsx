// The framed painting (wet-paint-polish, #1196 and #1197): the gallery dialog, what the LED strip does around it, where
// focus goes, and what a screen reader hears. Kept apart from WetPaint.tsx so the tests can render and call it without
// WebGL or MIDI.
import type { Ref } from "react";
import { Brackets, Button, Panel } from "../../duo-tokens";
import { CLEAR, keyOff, keyOn, type Message, type Rgb } from "../../leds/messages";
import styles from "./wet-paint.module.css";

export interface Framed {
  url: string; // the frozen canvas
  ms: number; // the session's length
  notes: number;
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const caption = (f: Pick<Framed, "ms" | "notes">) => `Free play · ${clock(f.ms)} · ${f.notes} notes · after Scriabin`;

// What the polite status region says when the painting is framed, by hand or after the minute.
export const frameAnnouncement = (f: Pick<Framed, "ms" | "notes">) => `Framed. ${caption(f)}`;

// The strip's side of the page. It remembers the keys it lit, because framing stops play() before their key-offs
// arrive. send() is the serial link's, which drops everything unless the strip is connected.
export function stripLights(send: (m: Message) => void) {
  const lit = new Set<number>();
  return {
    on(pitch: number, color: Rgb) {
      lit.add(pitch);
      send(keyOn(pitch, color));
    },
    off(pitch: number) {
      lit.delete(pitch);
      send(keyOff(pitch));
    },
    frame() {
      for (const p of lit) send(keyOff(p));
      lit.clear();
    },
    // Again, unmount and pagehide: everything off, whatever this page thinks is lit.
    clear() {
      lit.clear();
      send(CLEAR);
    },
  };
}

// Where focus goes when the painting is framed or let go: Save PNG on framing, the page on Again, else nowhere.
export const focusAfter = (wasFramed: boolean, framed: boolean): "save" | "page" | null =>
  framed && !wasFramed ? "save" : wasFramed && !framed ? "page" : null;

// A polite live region, present before it has anything to say, so the first announcement is heard.
export function Live({ text }: { text: string }) {
  return (
    <p className={styles.srOnly} role="status" aria-live="polite" data-testid="paint-announce">
      {text}
    </p>
  );
}

export function FramedPainting({ framed, onSave, onAgain, dialogRef }: { framed: Framed; onSave: () => void; onAgain: () => void; dialogRef?: Ref<HTMLDivElement> }) {
  return (
    <div ref={dialogRef} className={styles.gallery} role="dialog" aria-modal="true" aria-label="Your painting" data-testid="framed">
      <Brackets style={{ maxWidth: "min(84vw, 132vh)" }}>
        <Panel paper style={{ padding: "clamp(16px, 2.4vw, 44px)", paddingBottom: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the canvas, not an asset */}
          <img src={framed.url} alt={caption(framed)} className={styles.painting} />
          <p className={styles.caption} data-testid="caption">
            {caption(framed)}
          </p>
        </Panel>
      </Brackets>
      <div className={styles.actions}>
        <Button onClick={onSave} data-testid="save-png">
          Save PNG
        </Button>
        <Button kind="secondary" onClick={onAgain} data-testid="again">
          Again
        </Button>
      </div>
    </div>
  );
}
