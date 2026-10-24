"use client";
// A take's initials entry (spec: records; record-moment shares it). The state lives here, per take, so every
// component showing the initials sees the same letters; only the one passed `listen` takes the keys.
import { useEffect, useSyncExternalStore } from "react";
import { browserStorage, loadRecords, saveRecords, setInitials } from "./store";

export interface Initials {
  letters: string[];
  done: boolean; // Enter pressed with three letters: the entry closes
  saved: boolean; // and the initials reached storage
}

const NONE: Initials = { letters: [], done: false, saved: false };
const takes = new Map<string, Initials>(); // by chartId and date: one take
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const set = (key: string, s: Initials) => {
  takes.set(key, s);
  for (const l of listeners) l();
};

const A = "A".charCodeAt(0);
const cycle = (letter: string | undefined, step: number) => String.fromCharCode(A + (((letter ?? "A").charCodeAt(0) - A + step + 26) % 26));

// What a key does to the letters: A–Z appends (up to three), ↑ ↓ cycle the last, Backspace removes it. Null: not ours.
export function nextLetters(letters: string[], key: string): string[] | null {
  if (/^[a-z]$/i.test(key)) return letters.length < 3 ? [...letters, key.toUpperCase()] : letters;
  if (key === "ArrowUp" || key === "ArrowDown") {
    const step = key === "ArrowUp" ? 1 : -1;
    return letters.length ? [...letters.slice(0, -1), cycle(letters.at(-1), step)] : [cycle(undefined, step === 1 ? 0 : -1)];
  }
  if (key === "Backspace") return letters.slice(0, -1);
  return null;
}

// One key for one take's entry, from whichever component listens. True: the key was the entry's (A–Z, ↑ ↓,
// Backspace, Enter); the caller then keeps it from reaching the page. Enter with three letters saves them.
export function pressKey(chartId: string, date: string, key: string): boolean {
  const id = `${chartId}|${date}`;
  const s = takes.get(id) ?? NONE;
  if (s.done) return false;
  const letters = nextLetters(s.letters, key);
  if (letters) set(id, { ...s, letters });
  else if (key === "Enter") {
    if (s.letters.length === 3) {
      const storage = browserStorage();
      const stored = loadRecords(storage);
      set(id, { ...s, done: true, saved: !!stored && saveRecords(storage, setInitials(stored, chartId, date, s.letters.join(""))) });
    }
  } else return false;
  return true;
}

export const initialsOf = (chartId: string, date: string): Initials => takes.get(`${chartId}|${date}`) ?? NONE;

export function useInitials(chartId: string, date: string, listen: boolean): Initials {
  const state = useSyncExternalStore(subscribe, () => initialsOf(chartId, date), () => NONE);

  useEffect(() => {
    if (!listen || state.done) return;
    // Capture phase, so Enter saves the initials instead of pressing the focused Retry button.
    const onKey = (e: KeyboardEvent) => {
      if (!pressKey(chartId, date, e.key)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [listen, state.done, chartId, date]);

  return state;
}
