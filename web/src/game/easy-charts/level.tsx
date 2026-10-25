"use client";
// The select's level (spec: easy-charts): global, in localStorage, read by the toggle, the E key and the cards' hrefs
// through one store so they never disagree. Blocked storage keeps it for the page only.
import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import type { Chart } from "../../contracts";
import { difficulty } from "../difficulty/difficulty";
import { easyChart } from "./chart";

export type Level = "normal" | "easy";

const KEY = "pianoArcade.level";
let level: Level | null = null; // null until first read
const listeners = new Set<() => void>();

function read(): Level {
  if (level) return level;
  try {
    level = localStorage.getItem(KEY) === "easy" ? "easy" : "normal";
  } catch {
    level = "normal";
  }
  return level;
}

export function setLevel(next: Level): void {
  level = next;
  try {
    if (next === "easy") localStorage.setItem(KEY, "easy");
    else localStorage.removeItem(KEY);
  } catch {
    // blocked storage: this page only
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLevel(): [Level, (l: Level) => void] {
  return [useSyncExternalStore(subscribe, read, () => "normal"), setLevel];
}

// Adds &level=easy for Easy and removes any level for Normal, keeping the rest of the URL as it was.
export function withLevel(href: string, l: Level): string {
  const [path, query = ""] = href.split("?");
  const p = new URLSearchParams(query);
  if (l === "easy") p.set("level", "easy");
  else p.delete("level");
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

// Two chips in song-preview's LEARN / PRACTICE outline and type, side by side, each its own button (mouse-first: click
// the level you want; E still switches); the level in force is lit in the primary blue (Duo: zero radius, hairline
// frames), the other dimmed. The select places them beside the song's source, under Hands and Speed (duo-select):
// stacked in a column of their own, they narrowed Hands and Speed to a third row at 1280×720 (#863).
const box: CSSProperties = {
  display: "inline-flex",
  alignItems: "stretch",
  gap: "0.35em",
  fontSize: "clamp(13px, 1vw, 20px)" /* song-options' chips, beside it */,
};
const half: CSSProperties = {
  padding: "0.25em 0.75em",
  borderRadius: 0,
  border: "1px solid var(--pa-line)",
  background: "none",
  font: "inherit",
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--pa-ink-dim)",
  cursor: "pointer",
};
const lit: CSSProperties = { ...half, border: "1px solid var(--pa-primary)", background: "color-mix(in srgb, var(--pa-primary) 14%, transparent)", color: "var(--pa-primary)" };

// NORMAL Lv n · EASY Lv m; the lit half is the level in force. m waits for the focused chart.
export function LevelToggle({ normal, chart }: { normal: number; chart: Chart | null }) {
  const [l, set] = useLevel();
  const easy = useMemo(() => (chart ? difficulty(easyChart(chart)).level : null), [chart]);
  return (
    <div role="group" aria-label="Level" data-testid="level-toggle" style={box}>
      <button type="button" data-testid="level-normal" aria-pressed={l === "normal"} title="Normal (E switches)" aria-keyshortcuts="E" style={l === "normal" ? lit : half} onClick={() => set("normal")}>
        NORMAL Lv {normal}
      </button>
      <button type="button" data-testid="level-easy" aria-pressed={l === "easy"} title="Easy (E switches)" aria-keyshortcuts="E" style={l === "easy" ? lit : half} onClick={() => set("easy")}>
        EASY Lv {easy ?? "…"}
      </button>
    </div>
  );
}
