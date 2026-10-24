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

const box: CSSProperties = {
  font: "inherit",
  fontSize: "0.85em",
  letterSpacing: "0.08em",
  color: "var(--pa-ink)",
  background: "var(--pa-panel)",
  border: "1px solid rgba(242, 242, 245, 0.25)",
  borderRadius: 6,
  padding: "0.35em 0.7em",
  cursor: "pointer",
};
const on: CSSProperties = { color: "var(--pa-cyan)", fontWeight: 700 };
const off: CSSProperties = { color: "var(--pa-ink)", opacity: 0.55 };

// NORMAL Lv n · EASY Lv m; the lit half is the level in force. m waits for the focused chart.
export function LevelToggle({ normal, chart }: { normal: number; chart: Chart | null }) {
  const [l, set] = useLevel();
  const easy = useMemo(() => (chart ? difficulty(easyChart(chart)).level : null), [chart]);
  return (
    <button type="button" data-testid="level-toggle" aria-pressed={l === "easy"} style={box} onClick={() => set(l === "easy" ? "normal" : "easy")}>
      <span style={l === "normal" ? on : off}>NORMAL Lv {normal}</span>
      {" · "}
      <span style={l === "easy" ? on : off}>EASY Lv {easy ?? "…"}</span>
    </button>
  );
}
