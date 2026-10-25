"use client";
// Song options (spec: song-options): Hands and Speed per song, in localStorage, read by the preview's controls, the
// cards' hrefs and L through one store so they never disagree. Blocked storage keeps them for the page only.
import { useSyncExternalStore } from "react";
import type { Chart } from "../../contracts";
import type { HandsSetting } from "../hand-mode/hands";

export type Speed = 50 | 70 | 100;
export interface SongOptions {
  hands: HandsSetting;
  speed: Speed;
}
export type OptionsBySong = Record<string, SongOptions>;

export const SPEEDS: Speed[] = [50, 70, 100];
export const HANDS: HandsSetting[] = ["both", "R", "L"];
export const defaults: SongOptions = { hands: "both", speed: 100 };

const KEY = "pianoArcade.songOptions";
let all: OptionsBySong | null = null; // null until first read
const listeners = new Set<() => void>();
const empty: OptionsBySong = {};

// Drops anything that isn't a known value, so a hand-edited or old entry can't send a bad param.
function clean(raw: unknown): OptionsBySong {
  const out: OptionsBySong = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, o] of Object.entries(raw as Record<string, Partial<SongOptions>>)) {
    const hands = HANDS.includes(o?.hands as HandsSetting) ? (o.hands as HandsSetting) : "both";
    const speed = SPEEDS.includes(o?.speed as Speed) ? (o.speed as Speed) : 100;
    if (hands !== "both" || speed !== 100) out[id] = { hands, speed };
  }
  return out;
}

export function readOptions(): OptionsBySong {
  if (all) return all;
  try {
    const s = localStorage.getItem(KEY);
    all = s ? clean(JSON.parse(s)) : {};
  } catch (e) {
    if (e instanceof SyntaxError) console.warn(`${KEY}: not JSON, reading as empty`);
    all = {};
  }
  return all;
}

// A song set back to Both and 100% drops its entry.
export function setOptions(id: string, o: SongOptions): void {
  const next = { ...readOptions() };
  if (o.hands === "both" && o.speed === 100) delete next[id];
  else next[id] = o;
  all = next;
  try {
    if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
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

export function useSongOptions(): OptionsBySong {
  return useSyncExternalStore(subscribe, readOptions, () => empty);
}

// Adds hands and tempo when they aren't the defaults and removes them when they are, keeping the rest of the URL.
export function withOptions(href: string, o: SongOptions = defaults): string {
  const [path, query = ""] = href.split("?");
  const p = new URLSearchParams(query);
  if (o.hands === "both") p.delete("hands");
  else p.set("hands", o.hands);
  if (o.speed === 100) p.delete("tempo");
  else p.set("tempo", String(o.speed));
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

// Records' practiceReason counts both as practice, so the panel says so.
export const isPractice = (o: SongOptions) => o.hands !== "both" || o.speed !== 100;

export const hasBothHands = (chart: Chart) => chart.notes.some((n) => n.hand === "L") && chart.notes.some((n) => n.hand === "R");

type Key = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat">;
// The focused song's keys: H cycles Both → Right → Left (two-hand charts only); ← and → step Speed, stopping at the
// ends. Null when the key isn't ours or changes nothing.
export function keyOptions(o: SongOptions, e: Key, twoHands: boolean): SongOptions | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  if ((e.key === "h" || e.key === "H") && twoHands) return { ...o, hands: HANDS[(HANDS.indexOf(o.hands) + 1) % HANDS.length] };
  const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  const i = SPEEDS.indexOf(o.speed) + d;
  return d && i >= 0 && i < SPEEDS.length ? { ...o, speed: SPEEDS[i] } : null;
}
