"use client";
// Help overlay (spec: help-overlay): ? opens one card with every control, on /, /simon, /wrong-note and /play's start
// screen and results. On /, /simon and /wrong-note the keys are listed only here, behind the quiet HelpLink (spec:
// mouse-first).
// Not during a take or its pause menu: /play's own Esc listener would see the Esc that closes the card and resume.
// A native <dialog> (showModal): Esc, the focus trap and the inert page are the browser's.
import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { GamePlugin } from "../../contracts";
import styles from "./help-overlay.module.css";
import { helpGroups } from "./keys";

let taking = false; // a take is running on /play

// One line in layers.ts: the plugin only keeps that flag.
export function helpOverlay(): GamePlugin {
  return {
    id: "help-overlay",
    transformChart(chart) {
      taking = false; // a new /play, even after leaving mid-take
      return chart;
    },
    onEvent(e) {
      if (e.type === "songStart") taking = true;
      else if (e.type === "songEnd" || e.type === "quit") taking = false;
    },
  };
}

const OPEN = "pa-help-open"; // HelpLink's click, as a window event: the card lives in the layout, the link on a page

const isHelpKey = (e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">) =>
  e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey;

export function HelpOverlay() {
  const ref = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const path = usePathname();
  const here = path === "/" || path === "/play" || path === "/simon" || path === "/wrong-note";

  useEffect(() => {
    if (!here) return;
    const show = () => {
      if (taking || document.querySelector("dialog[open]")) return; // Options is up
      back.current = document.activeElement as HTMLElement | null;
      ref.current?.showModal();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isHelpKey(e) || e.repeat || taking || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN, show);
    };
  }, [here]);

  // Keys inside the card stay in it: the page's window listeners (O, F, E, Z / X) would act behind it.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDialogElement>) => {
    e.stopPropagation();
    if (!isHelpKey(e)) return;
    e.preventDefault();
    ref.current?.close();
  };

  if (!here) return null;
  return (
    <dialog
      ref={ref}
      className={styles.card}
      data-testid="help"
      aria-labelledby="help-title"
      onKeyDown={onKeyDown}
      onClose={() => back.current?.focus({ preventScroll: true })}
    >
      <header className={styles.head}>
        <h2 id="help-title" className={styles.title}>
          Controls
        </h2>
        <button type="button" className={styles.close} onClick={() => ref.current?.close()}>
          Close <kbd className={styles.kbd}>Esc</kbd>
        </button>
      </header>
      <div className={styles.groups}>
        {helpGroups.map((g) => (
          <section key={g.screen} className={styles.group}>
            <h3 className={styles.screen}>{g.screen}</h3>
            <dl className={styles.lines}>
              {g.lines.map((l) => (
                <div key={`${l.keys.join()}-${l.what}`} className={styles.line}>
                  <dt className={styles.keys}>
                    {l.keys.map((k) => (
                      <kbd key={k} className={styles.kbd}>
                        {k}
                      </kbd>
                    ))}
                  </dt>
                  <dd className={styles.what}>
                    {l.what}
                    {l.where && <span className={styles.where}> · {l.where}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  );
}

// The one way to the card by mouse on /, /simon and /wrong-note: quiet, so it never competes with the song list or Start.
export function HelpLink() {
  return (
    <button
      type="button"
      className={styles.link}
      onClick={() => window.dispatchEvent(new Event(OPEN))}
      aria-keyshortcuts="?"
      title="Controls (?)"
      data-capture-hide
      data-testid="help-link"
    >
      <span className={styles.linkMark} aria-hidden="true">
        ?
      </span>
      Controls
    </button>
  );
}
