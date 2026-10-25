"use client";

// Spot the wrong note (spec: wrong-note-spike): its own page, linked from nowhere, so it stays off the demo path.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chart } from "../../contracts";
import { Brackets, Button, MonoLabel, kitButton, kitChip } from "../../game/duo-tokens";
import { HelpLink } from "../../game/help-overlay";
import { PIANO_NAME } from "../../game/laptop-sound";
import { melody } from "../../game/simon";
import { newSet, roundMessages, score, sendAhead, step, wrongNoteSettings, type WrongNoteEvent, type WrongNoteSet } from "../../game/wrong-note";
import styles from "../../game/wrong-note/wrong-note.module.css";

const SONGS = [
  ["twinkle", "Twinkle"],
  ["ode-to-joy", "Ode to Joy"],
  ["minuet-g", "Minuet in G"],
  ["fur-elise", "Für Elise"],
] as const;

// Without ?seed=, one per page load, shown on the page so the set can be replayed.
const PAGE_SEED = 1 + Math.floor(Math.random() * 9999);

// Browser-only: Web MIDI.
export default dynamic(() => Promise.resolve(WrongNote), { ssr: false });

function WrongNote() {
  const { song, seed0, shift } = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const s = q.get("song") ?? "twinkle";
    const seed = Number(q.get("seed"));
    return {
      song: /^[a-z0-9-]+$/.test(s) ? s : "twinkle",
      seed0: Number.isInteger(seed) && seed > 0 ? seed : PAGE_SEED,
      shift: q.get("shift") === "1" ? 1 : wrongNoteSettings.shift,
    };
  }, []);
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState("");
  const [set, setSet] = useState<WrongNoteSet | null>(null); // null until Start
  const [sets, setSets] = useState<WrongNoteSet[]>([]); // this session's finished sets
  const [lit, setLit] = useState<number | null>(null); // the pad sounding, 1–8
  const [outName, setOutName] = useState<string | null>(null);

  const tune = useMemo(() => (chart ? melody(chart) : []), [chart]);
  const setRef = useRef<WrongNoteSet | null>(null);
  const outRef = useRef<MIDIOutput | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    fetch(`/songs/${song}/chart.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No song called "${song}".`))))
      .then(setChart, (e: Error) => setError(e.message));
    navigator.requestMIDIAccess?.().then(
      (a) => {
        outRef.current = [...a.outputs.values()].find((o) => o.name?.includes(PIANO_NAME)) ?? null;
        setOutName(outRef.current?.name ?? "");
      },
      () => setOutName(""),
    );
  }, [song]);

  const silence = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopRef.current?.();
    stopRef.current = null;
    setLit(null);
  }, []);

  // The round as played, or as written for the reveal; the pads light with each note.
  const play = useCallback(
    (s: WrongNoteSet, written = false) => {
      if (!chart) return;
      silence();
      const now = performance.now();
      const msgs = roundMessages(chart, s.rounds[s.index], now + wrongNoteSettings.leadMs, written);
      if (outRef.current) stopRef.current = sendAhead(outRef.current, msgs);
      // Each note-off goes out its own pad, found by pitch: messages are in time order, releases first.
      const padOf = new Map<number, number>();
      let pad = 0;
      for (const m of msgs) {
        const on = m.bytes[0] === 0x90;
        const n = on ? ++pad : (padOf.get(m.bytes[1]) ?? 0);
        if (on) padOf.set(m.bytes[1], n);
        timers.current.push(setTimeout(() => setLit((l) => (on ? n : l === n ? null : l)), Math.max(0, m.atMs - now)));
      }
    },
    [chart, silence],
  );

  const dispatch = useCallback(
    (e: WrongNoteEvent) => {
      const prev = setRef.current;
      if (!prev) return;
      const next = step(prev, e);
      if (next === prev) return;
      setRef.current = next;
      setSet(next);
      if (e.type === "replay") play(next);
      else if (next.phase === "reveal") play(next, true);
      else if (next.phase === "ask") play(next);
      else {
        silence();
        setSets((all) => [...all, next]);
      }
    },
    [play, silence],
  );

  const start = useCallback(() => {
    if (!tune.length) return;
    const seed = setRef.current ? setRef.current.seed + 1 : seed0;
    const s = newSet(tune, seed, shift);
    setRef.current = s;
    setSet(s);
    if (s.phase === "ask") play(s);
  }, [tune, seed0, shift, play]);

  // 2–8 answer, R replays, Space or Enter moves on (Start, Next, Again). All Notes Off when the page goes away.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const phase = setRef.current?.phase;
      if (/^[2-8]$/.test(e.key)) dispatch({ type: "answer", note: Number(e.key) });
      else if (e.key === "r" || e.key === "R") dispatch({ type: "replay" });
      else if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault(); // a focused button would act twice
        if (phase === "reveal") dispatch({ type: "next" });
        else if (!phase || phase === "done") start();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", silence);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", silence);
      silence();
    };
  }, [dispatch, start, silence]);

  // For verify-wrong-note: the round in play, read-only.
  useEffect(() => {
    (window as unknown as { __wrongNote?: unknown }).__wrongNote = set && { phase: set.phase, index: set.index, changed: set.rounds[set.index]?.changed, seed: set.seed };
  }, [set]);

  const title = SONGS.find(([id]) => id === song)?.[1] ?? chart?.title ?? song;
  const answer = set?.phase === "reveal" ? set.answers[set.answers.length - 1] : null;

  return (
    <main className={styles.page} data-testid="wrong-note">
      <header className={styles.head}>
        <h1 className={styles.mark}>Spot the wrong note</h1>
        <nav className={styles.songs} aria-label="Songs">
          {SONGS.map(([id, name]) => (
            <a key={id} href={`/wrong-note?song=${id}${shift === 1 ? "&shift=1" : ""}`} aria-current={id === song ? "page" : undefined} {...kitChip(id === song)}>
              {name}
            </a>
          ))}
        </nav>
      </header>

      <section className={styles.stage} aria-live="polite">
        <div className={styles.callRow}>
          {set && set.phase !== "done" && (
            <MonoLabel style={{ fontSize: "inherit" }}>
              Round {set.index + 1} / {set.rounds.length}
            </MonoLabel>
          )}
          <p className={styles.call} data-testid="call" data-tone={answer ? (answer.answer === answer.changed ? "right" : "wrong") : undefined}>
            {error || callText(set, title, shift)}
          </p>
        </div>

        {/* An unknown song has nothing to play: no pads, and the Start below becomes a way to a known song. */}
        {error ? null : set?.phase === "done" ? (
          <p className={styles.score} data-testid="score">
            {score(set)} <span>/ {set.rounds.length}</span>
          </p>
        ) : (
          <Brackets tone={set ? "primary" : "line"} style={{ width: "min(92vw, 150vh)" }}>
            <ol className={styles.pads} aria-label="The phrase's 8 notes">
              {Array.from({ length: wrongNoteSettings.length }, (_, i) => {
                const n = i + 1;
                const state = !answer ? null : n === answer.changed ? "answer" : n === answer.answer ? "chosen" : null;
                return (
                  <li key={n}>
                    <button
                      className={styles.pad}
                      data-testid={`pad-${n}`}
                      data-lit={lit === n || undefined}
                      data-state={state ?? undefined}
                      disabled={n === 1 || set?.phase !== "ask"}
                      onClick={() => dispatch({ type: "answer", note: n })}
                      aria-label={n === 1 ? "Note 1, never the changed one" : `Note ${n}`}
                    >
                      <span className={styles.num}>{n}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Brackets>
        )}

        <div className={styles.actions}>
          {error ? (
            <a {...kitButton("primary")} style={{ ...kitButton("primary").style, ...big }} href={`/wrong-note?song=${SONGS[0][0]}${shift === 1 ? "&shift=1" : ""}`}>
              Play {SONGS[0][1]} instead
            </a>
          ) : !set || set.phase === "done" ? (
            <Button style={big} onClick={start} disabled={!tune.length} title={`${set ? "Again" : "Start"} (Space)`} aria-keyshortcuts="Space Enter" data-testid="start">
              {set ? "Again" : "Start"}
            </Button>
          ) : (
            <>
              {set.phase === "ask" && (
                <Button kind="secondary" style={big} onClick={() => dispatch({ type: "replay" })} title="Replay (R)" aria-keyshortcuts="R" data-testid="replay">
                  Replay
                </Button>
              )}
              {set.phase === "reveal" && (
                <Button style={big} onClick={() => dispatch({ type: "next" })} title={`${set.index + 1 < set.rounds.length ? "Next" : "Score"} (Space)`} aria-keyshortcuts="Space Enter" data-testid="next">
                  {set.index + 1 < set.rounds.length ? "Next" : "Score"}
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      <footer className={styles.foot}>
        <HelpLink />
        {/* The seed shows in the set list below, which is what gets copied into FINDINGS.md (#1039: no debug line). */}
        <p>{outName === null ? "Looking for the piano" : outName ? `On ${outName}` : "No piano output: nothing will sound"}</p>
        {sets.length > 0 && (
          <ol className={styles.sets} aria-label="This session's sets" data-testid="sets">
            {sets.map((s, i) => (
              <li key={i}>
                {song} · shift {s.shift} · seed {s.seed} · {score(s)}/{s.rounds.length} · {s.answers.map((a) => `${a.changed}:${a.answer}${a.replays ? `+${a.replays}r` : ""}`).join(" ")}
              </li>
            ))}
          </ol>
        )}
      </footer>
    </main>
  );
}

// The kit's buttons are 14px; on this page they sit beside 112px pads, so they scale with the screen.
const big = { fontSize: "clamp(14px, 1.1vw, 22px)", padding: "0.85em 1.7em", minWidth: "12em" }; // /simon's Start width

function callText(set: WrongNoteSet | null, title: string, shift: number): string {
  if (!set) return `${title}: eight notes, one moved ${shift === 1 ? "a half step" : "a whole step"}. Which one?`;
  if (set.phase === "done") return "Set done";
  if (set.phase === "ask") return "Which note was wrong?";
  const a = set.answers[set.answers.length - 1];
  return a.answer === a.changed ? "Right" : `It was note ${a.changed}`;
}
