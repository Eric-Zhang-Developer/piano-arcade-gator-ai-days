// Chunk practice (spec: chunk-practice): walk a song 4 bars at a time, learn each in wait mode, then play it judged at
// 70%, and move on at 85%. Every step is a URL bar-loop and wait-mode already read; this plugin only links them.
// Since adaptive-chunks, the way in starts an adaptive walk instead (practice=adapt): the window shrinks onto the
// phrases you miss and grows back as you pass. The fixed walk's practice=1 URLs still work.
import { createElement, useEffect, useRef, type CSSProperties } from "react";
import type { Chart, GamePlugin, Results, Take } from "../../contracts";
import { adaptSettings, adaptState, adaptUrl, next, songPhrases, start, takeResult, type AdaptState, type Step as AdaptStep } from "../adaptive-chunks/next";
import { Strip } from "../adaptive-chunks/Strip";
import { kitButton } from "../duo-tokens";
import { isWaitMode } from "../wait-mode";
import { scorePhrases, type Phrase } from "../weak-bars";
import { barsLabel, chunkSettings, chunksOf, isPlainTake, nextAfter, practiceStep, stepUrl, wholeSongUrl, type Chunk, type Step } from "./chunks";
import styles from "./chunk-practice.module.css";

export interface ChunkHook {
  from: number;
  to: number;
  step: Step;
  chunk: number; // 1-based
  of: number;
}

// An adaptive step, for headless checks: the window in bars, the search's state, and the song's phrases.
export interface AdaptHook {
  from: number;
  to: number;
  ok: number;
  ko: number;
  clean: number;
  phrases: { from: number; to: number }[];
}

declare global {
  interface Window {
    __pianoArcadeChunk?: ChunkHook | null;
    __pianoArcadeAdapt?: AdaptHook | null;
  }
}

// Registered before barLoop, so transformChart sees the whole chart. It returns the chart unchanged.
export function chunkPractice(): GamePlugin {
  let list: Chunk[] = [];
  let at: { index: number; step: Step } | null = null;
  let phraseList: Phrase[] = [];
  let adapt: AdaptState | null = null;
  return {
    id: "chunk-practice",
    transformChart(chart, params) {
      list = chunksOf(chart, params.get("hands"));
      at = practiceStep(params, list);
      phraseList = songPhrases(chart, params.get("hands"));
      adapt = phraseList.length ? adaptState(params, phraseList) : null;
      if (typeof window !== "undefined") {
        window.__pianoArcadeChunk = at && { ...list[at.index], step: at.step, chunk: at.index + 1, of: list.length };
        window.__pianoArcadeAdapt = adapt && {
          from: phraseList[adapt.from].from,
          to: phraseList[adapt.to].to,
          ok: adapt.ok,
          ko: adapt.ko,
          clean: adapt.clean,
          phrases: phraseList.map(({ from, to }) => ({ from, to })),
        };
      }
      return chart;
    },
    startPanel: ({ params }) => {
      if (adapt) return createElement(AdaptLine, { list: phraseList, state: adapt, learn: isWaitMode(params) });
      if (at) return createElement(StepLine, { index: at.index, of: list.length, step: at.step });
      if (!isPlainTake(params) || !phraseList.length) return null;
      return (
        <a data-testid="chunk-start" {...kitButton("secondary")} href={adaptUrl(params, phraseList, start(phraseList))}>
          Practice in chunks
        </a>
      );
    },
    resultsPanel: ({ chart, params, take, results }) => {
      if (adapt) return isWaitMode(params) ? null : createElement(AdaptAfter, { chart, params, take, results, list: phraseList, state: adapt });
      return at?.step === "play" ? createElement(AfterPlay, { params, results, list, index: at.index }) : null;
    },
  };
}

const windowLabel = (list: Phrase[], s: AdaptState) =>
  s.from === 0 && s.to === list.length - 1 ? "whole song" : barsLabel({ from: list[s.from].from, to: list[s.to].to });
const tempoOf = (params: URLSearchParams) => Number(params.get("tempo")) || adaptSettings.tempo;

function AdaptLine({ list, state, learn }: { list: Phrase[]; state: AdaptState; learn: boolean }) {
  return (
    <div className={styles.step} data-testid="chunk-step">
      <Strip list={list} from={state.from} to={state.to} />
      <p className={styles.line} data-testid="adapt-line">
        {learn ? `Learn · ${windowLabel(list, state)}` : `Practice · ${windowLabel(list, state)} · clean ${state.clean} of ${adaptSettings.cleanToGrow}`}
      </p>
    </div>
  );
}

// The results of an adaptive step: the take on the strip, and the way on (focused, so Enter takes it).
function AdaptAfter(props: { chart: Chart; params: URLSearchParams; take: Take; results: Results; list: Phrase[]; state: AdaptState }) {
  const { chart, params, take, results, list, state } = props;
  const r = takeResult(results.accuracy, scorePhrases(chart, take, results), list[state.from].from);
  const { step, state: to } = next(list, state, r);
  const ref = useRef<HTMLAnchorElement>(null);
  // After Retry's autoFocus, as AfterPlay does: the panel is featured on a practice take, so focus scrolls nothing.
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const tempo = tempoOf(params);
  const url = (s: AdaptState, t = tempo) => adaptUrl(params, list, s, t);
  const learnUrl = () => {
    const q = new URLSearchParams(url(to).split("?")[1]);
    q.set("mode", "wait");
    return `/play?${q}`;
  };
  const label = (s: AdaptState) => barsLabel({ from: list[s.from].from, to: list[s.to].to });
  const links: Record<AdaptStep, [string, string]> = {
    again: [url(to), `Again: clean ${to.clean} of ${adaptSettings.cleanToGrow}`],
    grow: [url(to), `Next: ${label(to)}`],
    smaller: [url(to), `Smaller: ${label(to)}`],
    back: [url(to), `Back to ${label(to)}`],
    floor: [learnUrl(), `Learn ${label(to)}`],
    done: [wholeSongUrl(params), "You played the whole song"],
  };
  const [href, text] = links[step];
  const pass = results.accuracy >= adaptSettings.passAccuracy;
  const pct = `${(results.accuracy * 100).toFixed(1)}%`;
  return (
    <div className={styles.after} data-testid="chunk-after" data-step={step}>
      <p className={styles.verdict}>
        {pass ? <span className={styles.clear}>Clean</span> : <span data-testid="chunk-accuracy">{pct}</span>}{" "}
        <span className={styles.dim}>{pass ? pct : `· ${Math.round(adaptSettings.passAccuracy * 100)}% to pass`}</span>
      </p>
      <Strip list={list} from={state.from} to={state.to} scores={new Map(r.phrases.map((p) => [p.from, p.accuracy]))} />
      <a ref={ref} data-testid="adapt-next" className={styles.next} href={href}>
        {text}
      </a>
      {step === "floor" && tempo > adaptSettings.slowTempo && (
        <a data-testid="adapt-slower" className={styles.ghost} href={url(to, adaptSettings.slowTempo)}>
          Slower: {adaptSettings.slowTempo}%
        </a>
      )}
    </div>
  );
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
  // An effect runs after Retry's autoFocus, so the way on takes focus and Enter moves on. The panel is featured in the
  // first view on a practice take (results-layout, #294), so focus scrolls nothing.
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
      <div className={styles.meter} aria-hidden style={{ "--acc": results.accuracy, "--gate": chunkSettings.passAccuracy } as CSSProperties}>
        <span className={styles.fill} />
        <span className={styles.gate} />
      </div>
      <a data-testid="chunk-again" className={styles.ghost} href={stepUrl(params, list[index], "learn")}>
        Learn {barsLabel(list[index])} again
      </a>
    </div>
  );
}
