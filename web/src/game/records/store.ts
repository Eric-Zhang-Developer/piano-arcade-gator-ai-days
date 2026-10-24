// The records store: each chart's best grade and a local top 5 (spec: records). Pure functions over a plain object,
// plus the one localStorage key they live under.
import type { Rank } from "../../contracts";

export const RECORDS_KEY = "pianoArcade.records";
export const NO_INITIALS = "---";
const RANKS: Rank[] = ["S", "A", "B", "C", "D"];

export interface Best {
  rank: Rank;
  accuracy: number; // 0–1
  score: number;
  date: string; // ISO
}

export interface Entry {
  initials: string; // 3 letters, or "---" until the player enters them
  score: number;
  accuracy: number;
  rank: Rank;
  maxCombo: number;
  date: string; // ISO; also the entry's identity within its chart
}

export type Records = Record<string, { best: Best; top: Entry[] }>;

// Score first, then accuracy, then the earlier date.
export const byScore = (a: Entry, b: Entry) => b.score - a.score || b.accuracy - a.accuracy || a.date.localeCompare(b.date);

// True when a beats b as a grade: a better rank, or the same rank with better accuracy.
export const betterGrade = (a: Pick<Best, "rank" | "accuracy">, b: Pick<Best, "rank" | "accuracy">) =>
  RANKS.indexOf(a.rank) < RANKS.indexOf(b.rank) || (a.rank === b.rank && a.accuracy > b.accuracy);

export interface Added {
  records: Records;
  newRecord: boolean; // beat the stored best score (or the first take of this chart)
  inTop: boolean; // made the top 5
}

export function addTake(records: Records, chartId: string, e: Omit<Entry, "initials">): Added {
  const prev = records[chartId];
  const entry: Entry = { initials: NO_INITIALS, ...e };
  const top = [...(prev?.top ?? []), entry].sort(byScore).slice(0, 5);
  const best: Best =
    prev && !betterGrade(e, prev.best) ? prev.best : { rank: e.rank, accuracy: e.accuracy, score: e.score, date: e.date };
  return {
    records: { ...records, [chartId]: { best, top } },
    newRecord: !prev?.top.length || e.score > Math.max(...prev.top.map((t) => t.score)),
    inTop: top.includes(entry),
  };
}

export function setInitials(records: Records, chartId: string, date: string, initials: string): Records {
  const rec = records[chartId];
  if (!rec) return records;
  return { ...records, [chartId]: { ...rec, top: rec.top.map((t) => (t.date === date ? { ...t, initials } : t)) } };
}

// A take's records key: an Easy take (easy-charts, ?level=easy) keeps its own best and top 5 under <id>@easy.
export function recordKey(chartId: string, params: URLSearchParams, version: 1 | 2 = 1): string {
  const key = params.get("level") === "easy" ? `${chartId}@easy` : chartId;
  return version === 2 ? `${key}@scoring-v2` : key;
}

// A practice take isn't a record: a loop, a slower tempo, a mode, a bot, versus, or one hand.
export function practiceReason(params: URLSearchParams): string | null {
  for (const k of ["from", "to", "tempo", "mode", "bot", "versus"]) if (params.has(k)) return k;
  const hands = params.get("hands");
  return hands !== null && hands !== "both" ? "hands" : null;
}

// Storage that can fail: blocked storage gives null (the panel says records can't be saved); corrupt JSON reads as
// empty, with one console line.
export function loadRecords(storage: Pick<Storage, "getItem"> | null): Records | null {
  let raw: string | null;
  try {
    if (!storage) return null;
    raw = storage.getItem(RECORDS_KEY);
  } catch {
    return null;
  }
  if (raw === null) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Records;
  } catch {
    // fall through
  }
  console.warn(`records: ${RECORDS_KEY} isn't valid records JSON; starting empty`);
  return {};
}

export function saveRecords(storage: Pick<Storage, "setItem"> | null, records: Records): boolean {
  try {
    if (!storage) return false;
    storage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

// The browser's localStorage, or null where touching it throws (blocked, sandboxed).
export function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
