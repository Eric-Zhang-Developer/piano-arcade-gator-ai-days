"use client";

// The quiet way into /lab (spec: lab): one small link in the select's footer, and X (decision lab-key). Same shape as
// first-run's link: not in the Tab order of the song list, hidden in capture mode, and the key waits while the Options
// drawer is open or a field has focus.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./lab.module.css";

export const LAB_KEY = "x";

export function LabLink() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== LAB_KEY || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.target instanceof Element && e.target.closest("dialog, input, textarea, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      router.push("/lab");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <Link href="/lab" className={styles.footerLink} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} data-capture-hide data-testid="lab-link">
      Lab <kbd className={styles.kbd}>X</kbd>
    </Link>
  );
}
