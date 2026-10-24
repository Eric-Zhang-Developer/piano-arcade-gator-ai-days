"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import styles from "./controls.module.css";
const subscribe = () => () => {};
// In the screen's own header/navigation flow; omit redundant iframe navigation.
export function Home() {
  const top = useSyncExternalStore(subscribe, () => window.top === window.self, () => false);
  return top ? <Link href="/" aria-label="Home — song selection" className={styles.home}>← Home</Link> : null;
}
