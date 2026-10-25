"use client";

import { useEffect } from "react";
import { APP_NAME } from "../../game/app-name";

// The tab names the song, and says Sheet so the popup and the game tab tell apart (#953). SheetView loads the same
// chart.json; this second fetch is the browser cache's.
export function SheetTitle() {
  useEffect(() => {
    const song = new URLSearchParams(window.location.search).get("song");
    if (!song || !/^[a-z0-9][a-z0-9_/-]*$/i.test(song)) return;
    fetch(`/songs/${song}/chart.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { title?: unknown } | null) => {
        if (typeof c?.title === "string") document.title = `${c.title} · Sheet · ${APP_NAME}`;
      })
      .catch(() => {});
  }, []);
  return null;
}
