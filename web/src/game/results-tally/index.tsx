"use client";
// Results tally (spec: results-tally): the results counts count up one after another, all done within 1.2 s.
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./results-tally.module.css";

export const tallySettings = {
  totalMs: 1200, // visual-direction.md: the whole tally, first count's start to last count's end
  eachMs: 450, // one count's own run; the rest of totalMs staggers the starts
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;

// The number shown at progress t (0–1) of a run up to target: 0 at the start, target exactly at the end, never past it.
export function tally(t: number, target: number): number {
  return Math.round(target * easeOut(Math.min(1, Math.max(0, t))));
}

// Progress (0–1) of the index-th of `of` counts, elapsedMs after the tally starts.
export function tallyProgress(index: number, of: number, elapsedMs: number): number {
  const { totalMs, eachMs } = tallySettings;
  const start = of > 1 ? (index * (totalMs - eachMs)) / (of - 1) : 0;
  return Math.min(1, Math.max(0, (elapsedMs - start) / eachMs));
}

// results-landing (behind ?x=results-landing) drives the counts from its own timeline: the shown value of the count
// with this testid, or null to show the final one. null driver: today's own clock.
export type TallyDriver = { subscribe(cb: () => void): () => void; version(): number; value(testid: string, target: number): number | null };
let driver: TallyDriver | null = null;
export function setTallyDriver(d: TallyDriver | null): void {
  driver = d;
}
const noSubscribe = () => () => {};

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// One count. The visible number tallies; the testid'd number is the final one from the first frame, so scripts and
// screen readers read the result, never a frame of the count-up.
export function Tally({ value, index, of, testid }: { value: number; index: number; of: number; testid?: string }) {
  const [own] = useState(() => driver); // fixed for the count's life: the landing is set before the results mount
  useSyncExternalStore(own?.subscribe ?? noSubscribe, own?.version ?? (() => 0), () => 0);
  const [ticked, setShown] = useState(() => (reducedMotion() ? value : 0));
  const shown = own ? (own.value(testid ?? "", value) ?? value) : ticked;
  useEffect(() => {
    if (own || reducedMotion()) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = tallyProgress(index, of, now - t0);
      setShown(tally(t, value));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, index, of, own]);
  return (
    <>
      <span aria-hidden>{shown}</span>
      <span className={styles.final} data-testid={testid}>
        {value}
      </span>
    </>
  );
}
