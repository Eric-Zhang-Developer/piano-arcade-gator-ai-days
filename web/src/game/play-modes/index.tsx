"use client";
// Play modes (spec: play-modes): LEARN → FLOW → PERFORM for each song. On /play's start screen and results the current
// mode is lit and the next step is a link to the same song and bars; the select's panel shows the furthest step
// reached, which this plugin writes when a Learn take finishes, a Flow take graduates or a Perform take counts as a
// record.
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Chart, GamePlugin } from "../../contracts";
import { difficulty, difficultySettings } from "../difficulty";
import { FlowJudge } from "../flow-mode/judge";
import { steadiness } from "../flow-mode/steady";
import { loadRecords, practiceReason, recordKey } from "../records/store";
import { MODES, graduates, modeHref, modeName, playMode, reachLadder, readLadder, type PlayMode } from "./modes";
import styles from "./ladder.module.css";

const storage = () => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // storage blocked
  }
};

// The test ids the old links had (wait-mode's Learn it first and Play it judged, flow-mode's Play in Flow), so the
// checks that click them keep working. Any other rung is ladder-<mode>.
function testId(at: "start" | "results", from: PlayMode, to: PlayMode): string {
  if (at === "start" && to === "learn") return "learn-first";
  if (at === "start" && to === "flow") return "play-flow";
  if (at === "results" && from === "learn" && to === "flow") return "play-judged";
  return `ladder-${to}`;
}

const nextOf = (m: PlayMode): PlayMode | null => MODES[MODES.indexOf(m) + 1] ?? null;

export function Ladder({ params, at, focus }: { params: URLSearchParams; at: "start" | "results"; focus?: PlayMode | null }) {
  const now = playMode(params);
  const next = nextOf(now);
  const ref = useRef<HTMLAnchorElement>(null);
  // After Start's autoFocus, as chunk-practice's links do: an effect runs after it, so the focused rung wins.
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <nav aria-label="Play mode" data-testid="ladder" data-mode={now}>
      <ol className={styles.ladder}>
        {MODES.map((m, i) => {
          const label = modeName[m];
          return [
            i > 0 && (
              <li key={`${m}-chev`} className={styles.chev} aria-hidden>
                →
              </li>
            ),
            <li key={m} style={{ display: "contents" }}>
              {m === now ? (
                <span className={`${styles.rung} ${styles.current}`} aria-current="step" data-testid={`ladder-${m}`}>
                  {label}
                </span>
              ) : (
                <a
                  ref={m === focus ? ref : undefined}
                  className={`${styles.rung} ${m === next || m === focus ? styles.next : ""}`} // a focused step shows as the way on too
                  href={modeHref(params, m)}
                  data-testid={testId(at, now, m)}
                  title={title[m]}
                >
                  {label}
                </a>
              )}
            </li>,
          ];
        })}
      </ol>
    </nav>
  );
}

const title: Record<PlayMode, string> = {
  learn: "Learn: the song waits for each note. Not scored.",
  flow: "Flow: follows your tempo, scored on right notes, slips and steadiness",
  perform: "Perform: on the beat, ranked",
};

// The select's mark: the furthest step reached on this song, read-only. An empty key lights nothing.
// With `on`, each rung with an action is a button (select-calm, #1411): the select's Practice panel, where the ladder
// is the way into Learn and Flow. Learn and Flow keep the select's old button ids, so checks find them there.
const rungId: Record<PlayMode, string> = { learn: "select-learn", flow: "select-practice", perform: "ladder-perform" };
const rungKey: Record<PlayMode, string> = { learn: "L", flow: "P", perform: "Enter" };
export function LadderMark({ song, on }: { song: string; on?: Partial<Record<PlayMode, () => void>> }) {
  const raw = useSyncExternalStore(
    noop,
    () => readLadder(storage(), song),
    () => null,
  );
  const reached = raw ? MODES.indexOf(raw) : -1;
  return (
    <ol className={`${styles.ladder} ${styles.mark}`} aria-label={raw ? `Reached ${modeName[raw]}` : "Not played yet"} data-testid="ladder-mark" data-reached={raw ?? ""}>
      {MODES.map((m, i) => [
        i > 0 && (
          <li key={`${m}-chev`} className={styles.chev} aria-hidden>
            →
          </li>
        ),
        on ? (
          <li key={m} className={styles.cell}>
            <button
              type="button"
              className={`${styles.rung} ${i === reached ? styles.current : i < reached ? styles.reached : ""}`}
              onClick={on[m]}
              disabled={!on[m]}
              aria-keyshortcuts={rungKey[m]}
              data-testid={rungId[m]}
            >
              {modeName[m]}
            </button>
          </li>
        ) : (
          <li key={m} className={`${styles.rung} ${i === reached ? styles.current : i < reached ? styles.reached : ""}`}>
            {modeName[m]}
          </li>
        ),
      ])}
    </ol>
  );
}
const noop = () => () => {};

// A first time on a hard song (the WARNING level, no record yet): the start screen focuses Flow; Perform stays one
// click and Start still plays Perform.
export function hardFirstTime(chart: Chart, params: URLSearchParams, records = loadRecords(storage())): boolean {
  if (playMode(params) !== "perform" || difficulty(chart).level < difficultySettings.warnFrom) return false;
  return !records?.[recordKey(chart.id, params)];
}

// The furthest step this take reached, or null. A bot, demo or cabinet demo reaches nothing.
export function reachedBy(params: URLSearchParams, flow: { deviations: readonly number[]; held: number | null } | null): PlayMode | null {
  if (params.has("bot") || params.has("demo") || params.get("cabinet") === "demo") return null;
  const m = playMode(params);
  if (m === "learn") return "learn";
  if (m === "flow") return flow && graduates(steadiness(flow.deviations), flow.held) ? "flow" : null;
  return practiceReason(params) ? null : "perform";
}

export function playModes(): GamePlugin {
  let params = new URLSearchParams();
  let song = "";
  return {
    id: "play-modes",
    transformChart(chart, p) {
      params = p;
      song = p.get("song") ?? chart.id;
      return chart;
    },
    onEvent(e) {
      if (e.type !== "songEnd") return;
      const j = FlowJudge.live;
      const step = reachedBy(params, playMode(params) === "flow" && j ? { deviations: j.deviations, held: j.heldTempo } : null);
      if (step) reachLadder(storage(), song, step);
    },
    startPanel: ({ chart, params: p }) => <Ladder params={p} at="start" focus={hardFirstTime(chart, p) ? "flow" : null} />,
    resultsPanel: ({ params: p }) => <Ladder params={p} at="results" />,
  };
}
