"use client";
// Each chart's best grade, for the music select (spec: records, Song select). Reads the store's raw JSON through
// useSyncExternalStore: the string is a stable snapshot, and another tab's save updates it. Nothing for a chart never
// played, or when storage is blocked or corrupt: the grade is never guessed.
import { useMemo, useSyncExternalStore } from "react";
import { browserStorage, loadRecords, RECORDS_KEY, type Best } from "./store";

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const read = () => {
  try {
    return browserStorage()?.getItem(RECORDS_KEY) ?? null;
  } catch {
    return null;
  }
};

export function useBestGrades(): Record<string, Pick<Best, "rank" | "accuracy">> {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => {
    const records = raw === null ? {} : (loadRecords({ getItem: () => raw }) ?? {});
    return Object.fromEntries(Object.entries(records).flatMap(([id, r]) => (r?.best ? [[id, { rank: r.best.rank, accuracy: r.best.accuracy }]] : [])));
  }, [raw]);
}
