"use client";
// The song rows. Each row is a link, so click and Enter work natively; up/down arrows move between rows.
import Link from "next/link";
import type { KeyboardEvent } from "react";
import type { Song } from "./load";

export function SongList({ songs }: { songs: Song[] }) {
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
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
