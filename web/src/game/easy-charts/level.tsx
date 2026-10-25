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

// Two halves in song-preview's LEARN / PRACTICE outline and type, stacked; the level in force is lit in the primary blue
// (Duo: zero radius, hairline frames), the other dimmed. Stacked so it fits beside the stats without a row of its own: a row
// pushed the panel's last line onto the first-run link at 1280×720 (#532).
const box: CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "0.35em",
  padding: 0,
  font: "inherit",
  fontSize: "clamp(13px, 1vw, 20px)" /* song-options' chips, beside it */,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "var(--pa-ink-dim)",
  background: "none",
  border: "none",
  cursor: "pointer",
};
const half: CSSProperties = { padding: "0.25em 0.75em", borderRadius: 0, border: "1px solid var(--pa-line)", color: "var(--pa-ink-dim)" };
const lit: CSSProperties = { ...half, border: "1px solid var(--pa-primary)", background: "color-mix(in srgb, var(--pa-primary) 14%, transparent)", color: "var(--pa-primary)" };

// NORMAL Lv n · EASY Lv m; the lit half is the level in force. m waits for the focused chart.
export function LevelToggle({ normal, chart }: { normal: number; chart: Chart | null }) {
  const [l, set] = useLevel();
  const easy = useMemo(() => (chart ? difficulty(easyChart(chart)).level : null), [chart]);
  return (
    <button type="button" data-testid="level-toggle" aria-pressed={l === "easy"} style={box} onClick={() => set(l === "easy" ? "normal" : "easy")}>
      <span style={l === "normal" ? lit : half}>NORMAL Lv {normal}</span>
      <span style={l === "easy" ? lit : half}>EASY Lv {easy ?? "…"}</span>
    </button>
  );
}
