"use client";
// The stamp's age, computed in the browser after mount and every minute, so a prerendered / never shows its build-time
// age and the server's HTML (the SHA alone) matches the first render.
import { useEffect, useState } from "react";
import { stampText } from "./stamp";
import styles from "./build-stamp.module.css";

export function StampAge({ sha, committedAt }: { sha: string; committedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get("debug") === "1") document.documentElement.dataset.debug = ""; // the stamp shows
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <>{sha}</>;
  const { text, stale } = stampText(sha, committedAt, now);
  return <span className={stale ? styles.stale : undefined}>{text}</span>;
}
