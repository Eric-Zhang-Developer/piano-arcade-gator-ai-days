"use client";
// The song rows. Each row is a link, so click and Enter work natively; up/down arrows move between rows.
import Link from "next/link";
import { useMemo, useSyncExternalStore, type KeyboardEvent } from "react";
import { browserStorage, loadRecords, RECORDS_KEY } from "../records/store";
import type { Song } from "./load";

// The records JSON as stored (a stable string, so React can compare snapshots); null before hydration or when blocked.
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const readRecords = () => {
  try {
    return browserStorage()?.getItem(RECORDS_KEY) ?? null;
  } catch {
    return null;
  }
};

export function SongList({ songs }: { songs: Song[] }) {
  const raw = useSyncExternalStore(subscribe, readRecords, () => null);
  const records = useMemo(() => (raw === null ? {} : (loadRecords({ getItem: () => raw }) ?? {})), [raw]);
  function onKeyDown(e: KeyboardEvent<HTMLOListElement>) {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const rows = [...e.currentTarget.querySelectorAll("a")];
    const i = rows.indexOf(document.activeElement as HTMLAnchorElement);
    rows[Math.min(rows.length - 1, Math.max(0, i + step))]?.focus();
  }

  return (
    <ol onKeyDown={onKeyDown} style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {songs.map((s, i) => (
        <li key={s.id}>
          <Link href={`/play?song=${s.id}`} autoFocus={i === 0} className="song-row" data-testid={`song-${s.id}`}>
            <span>
              <strong style={{ fontSize: 22 }}>{s.title}</strong>
              <br />
              <span style={{ opacity: 0.7 }}>
                {s.composer}
                {s.catalog && ` · ${s.catalog}`}
              </span>
            </span>
            <span style={{ textAlign: "right", opacity: 0.7, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {s.noteCount} notes
              <br />
              Lv {s.level}
              {records[s.id]?.best && (
                <>
                  <br />
                  <span data-testid={`best-${s.id}`} style={{ opacity: 1, fontWeight: 700 }}>
                    Best {records[s.id].best.rank} · {(records[s.id].best.accuracy * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
