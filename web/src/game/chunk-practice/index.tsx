// Chunk practice (spec: chunk-practice): walk a song 4 bars at a time, learn each in wait mode, then play it judged at
// 70%, and move on at 85%. Every step is a URL bar-loop and wait-mode already read; this plugin only links them.
import { createElement, useEffect, useRef } from "react";
import type { GamePlugin, Results } from "../../contracts";
import { barsLabel, chunkSettings, chunksOf, isPlainTake, nextAfter, practiceStep, stepUrl, wholeSongUrl, type Chunk, type Step } from "./chunks";
import styles from "./chunk-practice.module.css";

export interface ChunkHook {
  from: number;
  to: number;
  step: Step;
  chunk: number; // 1-based
  of: number;
}

declare global {
  interface Window {
    __pianoArcadeChunk?: ChunkHook | null;
  }
}

// Registered before barLoop, so transformChart sees the whole chart. It returns the chart unchanged.
export function chunkPractice(): GamePlugin {
  let list: Chunk[] = [];
  let at: { index: number; step: Step } | null = null;
  return {
    id: "chunk-practice",
    transformChart(chart, params) {
      list = chunksOf(chart, params.get("hands"));
      at = practiceStep(params, list);
      if (typeof window !== "undefined")
        window.__pianoArcadeChunk = at && { ...list[at.index], step: at.step, chunk: at.index + 1, of: list.length };
      return chart;
    },
    startPanel: ({ params }) => {
      if (at) return createElement(StepLine, { index: at.index, of: list.length, step: at.step });
      if (!isPlainTake(params) || !list.length) return null;
      return (
        <a data-testid="chunk-start" className={styles.ghost} href={stepUrl(params, list[0], "learn")}>
          Practice in chunks
        </a>
      );
    },
    resultsPanel: ({ params, results }) =>
      at?.step === "play" ? createElement(AfterPlay, { params, results, list, index: at.index }) : null,
  };
}

function StepLine({ index, of, step }: { index: number; of: number; step: Step }) {
  return (
    <div className={styles.step} data-testid="chunk-step">
      <ol className={styles.pips} aria-hidden>
        {Array.from({ length: of }, (_, k) => (
          <li key={k} className={k < index ? styles.done : k === index ? styles.here : undefined} />
        ))}
      </ol>
      <p className={styles.line} data-testid="chunk-line">
        Chunk {index + 1} of {of} · {step === "learn" ? "learn" : `play at ${chunkSettings.tempo}%`}
      </p>
    </div>
  );
}

function AfterPlay({ params, results, list, index }: { params: URLSearchParams; results: Results; list: Chunk[]; index: number }) {
  const go = nextAfter(list, index, results.accuracy);
  const ref = useRef<HTMLAnchorElement>(null);
  // An effect runs after Retry's autoFocus, so the way on takes focus and Enter moves on.
  const moveOn = go !== null;
  useEffect(() => {
    if (moveOn) ref.current?.focus();
  }, [moveOn]);
  const pct = `${(results.accuracy * 100).toFixed(1)}%`;
  const gate = `${Math.round(chunkSettings.passAccuracy * 100)}%`;
  if (go)
    return (
      <div className={styles.after} data-testid="chunk-after">
        <p className={styles.verdict}>
          <span className={styles.clear}>Chunk {index + 1} clear</span> <span className={styles.dim}>{pct}</span>
        </p>
        <a ref={ref} data-testid="chunk-next" className={styles.next} href={"next" in go ? stepUrl(params, go.next, "learn") : wholeSongUrl(params)}>
          {"next" in go ? `Next: ${barsLabel(go.next)}` : "Play the whole song"}
        </a>
      </div>
    );
  return (
    <div className={styles.after} data-testid="chunk-after">
      <p className={styles.verdict}>
        <span data-testid="chunk-accuracy">{pct}</span> <span className={styles.dim}>· {gate} moves you on</span>
      </p>
      <a data-testid="chunk-again" className={styles.ghost} href={stepUrl(params, list[index], "learn")}>
        Learn {barsLabel(list[index])} again
      </a>
    </div>
  );
}
