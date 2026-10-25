"use client";

import { useState } from "react";
import { checkHandle, HANDLE_MAX } from "../../../data/account";
import styles from "./welcome.module.css";

// The one screen after a first Google sign-in: "Name" (a handle to save, or skip). Every sign-in then goes straight
// on; the profile button says hi on the next page.

// Black keys sit after these white keys in each octave (C#, D#, F#, G#, A#).
const BLACK_AFTER = [0, 1, 3, 4, 5];

function Keyboard() {
  const whites = Array.from({ length: 14 }, (_, i) => i);
  const blacks = whites.filter((i) => BLACK_AFTER.includes(i % 7) && i < 13);
  return (
    <div className={styles.keyboard} aria-hidden="true" data-testid="welcome-keyboard">
      {whites.map((i) => (
        <div key={i} className={styles.white} style={{ "--i": i } as React.CSSProperties} />
      ))}
      {blacks.map((i) => (
        <div key={`b${i}`} className={styles.black} style={{ "--i": i, left: `${((i + 1) / 14) * 100}%` } as React.CSSProperties} />
      ))}
    </div>
  );
}

/** First sign-in: one field, "Name", filled with a suggestion. Save stores it as the handle; Skip goes on without. */
export function NamePrompt({
  suggestion,
  onSave,
  onSkip,
}: {
  suggestion: string;
  onSave: (name: string) => Promise<string | null>; // resolves to an error to show, or null when saved
  onSkip: () => void;
}) {
  const [value, setValue] = useState(suggestion);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const checked = checkHandle(value);
    if (!checked.ok) return setError(checked.reason);
    setBusy(true);
    const err = await onSave(checked.handle);
    setBusy(false);
    if (err) setError(err);
  };
  return (
    <main className={styles.page} data-testid="name-prompt">
      <div className={styles.card}>
        <Keyboard />
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          <label className={styles.label} htmlFor="name">
            Name
          </label>
          <input
            id="name"
            className={styles.input}
            value={value}
            maxLength={HANDLE_MAX}
            autoFocus
            autoComplete="nickname"
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
          />
          <p className={styles.hint}>Shown on the menu and your profile. Letters, numbers, spaces and _.</p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.row}>
            <button className={styles.primary} type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className={styles.plain} type="button" onClick={onSkip}>
              Skip
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
