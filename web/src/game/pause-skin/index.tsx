"use client";
// Pause skin (spec: pause-skin): play-slots' Esc menu, styled and keyboard first, and a resume countdown that clicks
// each beat on the audio clock. /play renders it in place of play-slots' PauseOverlay; the pause logic stays there.
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { PauseMode } from "../play-slots";
import { uiSound } from "../ui-sounds";
import styles from "./pause-skin.module.css";
import { stepFocus, tickSchedule } from "./schedule";

export { stepFocus, tickSchedule } from "./schedule";

export function PauseMenu({
  mode,
  count,
  beatMs,
  onResume,
  onRetry,
  onQuit,
  onSkip,
}: {
  mode: PauseMode;
  count: number; // countdown beats left; the bar's beats when the countdown starts
  beatMs: number;
  onResume(): void;
  onRetry(): void;
  onQuit(): void;
  onSkip?(): void;
}) {
  // Every click of the countdown at once, when it shows: beatMs apart on the audio clock, not frame by frame. /play
  // sets count to the bar's beats as the countdown starts, so the first render of it has the right number.
  const scheduled = useRef(false);
  useEffect(() => {
    if (mode !== "countdown") {
      scheduled.current = false;
      return;
    }
    if (scheduled.current || count <= 0) return;
    scheduled.current = true;
    for (const t of tickSchedule(count, beatMs)) uiSound(t.accent ? "tickAccent" : "tick", t.atMs);
  }, [mode, count, beatMs]);

  if (mode === "countdown")
    return (
      <div data-testid="pause" className={styles.overlay}>
        <div data-testid="pause-countdown" key={count} className={styles.count}>
          {count}
        </div>
        {onSkip && <button onClick={onSkip}>Skip countdown</button>}
      </div>
    );
  if (mode !== "menu") return null;

  const items: [string, () => void][] = [
    ["Resume", onResume],
    ["Retry", onRetry],
    ["Home", onQuit],
  ];
  // ↑/↓ move the focus and stop at the ends; Esc sounds back here, and /play's own listener resumes.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") return uiSound("back");
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const buttons = [...e.currentTarget.querySelectorAll("button")];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = stepFocus(i, step, buttons.length);
    if (next === i) return;
    uiSound("move");
    buttons[next].focus();
  };
  return (
    <div data-testid="pause" className={styles.overlay}>
      <h2 className={styles.title}>Paused</h2>
      <div className={styles.menu} role="menu" onKeyDown={onKeyDown}>
        {items.map(([label, choose], i) => (
          <button
            key={label}
            type="button"
            role="menuitem"
            data-home={label === "Home" ? "" : undefined}
            className={styles.item}
            autoFocus={i === 0}
            // Hover moves the focus only on a real move: a mouse resting where the menu appears (on Start, say)
            // would otherwise take Resume's focus. Chrome's layout-change mousemoves have no movement.
            onMouseMove={(e) => (e.movementX || e.movementY) && e.currentTarget !== document.activeElement && e.currentTarget.focus()}
            onClick={() => {
              uiSound("confirm");
              choose();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        <b>↑ ↓</b> choose · <b>Enter</b> select · <b>Esc</b> resume
      </p>
    </div>
  );
}
