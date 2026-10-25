"use client";

// Simon Says (spec: simon-says-spike): its own page, linked from nowhere, so it stays off the demo path.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chart, ChartNote, InputEvent } from "../../contracts";
import { keyMap, keysDevice, midiDevice } from "../../game/core/input";
import { laptopKey } from "../../game/laptop-sound";
import { allNotesOff } from "../../game/piano-out";
import { laptopReach, melody, newRun, phrase, phraseMessages, simonSettings, step, type Run, type SimonEvent } from "../../game/simon";
import styles from "../../game/simon/simon.module.css";
import { HelpLink } from "../../game/help-overlay";
import { tone } from "../../game/sound";

const SONGS = [
  ["twinkle", "Twinkle"],
  ["ode-to-joy", "Ode to Joy"],
  ["minuet-g", "Minuet in G"],
  ["fur-elise", "Für Elise"],
] as const;
const isBlack = (p: number) => [1, 3, 6, 8, 10].includes(p % 12);
const hz = (p: number) => 440 * 2 ** ((p - 69) / 12);
const letter = (code: string) => (code === "Semicolon" ? ";" : code.slice(3));

// Browser-only: Web MIDI and Web Audio.
export default dynamic(() => Promise.resolve(Simon), { ssr: false });

function Simon() {
  const song = useMemo(() => {
    const s = new URLSearchParams(location.search).get("song") ?? "twinkle";
    return /^[a-z0-9-]+$/.test(s) ? s : "twinkle";
  }, []);
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState("");
  const [run, setRun] = useState<Run | null>(null); // null until Start
  const [lit, setLit] = useState<ReadonlySet<number>>(new Set()); // sounding in the phrase, or the key you missed
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set());
  const [runs, setRuns] = useState<{ round: number; won: boolean }[]>([]);
  const [midiStatus, setMidiStatus] = useState("");

  const tune = useMemo(() => (chart ? melody(chart) : []), [chart]);
  const runRef = useRef<Run | null>(null);
  const outRef = useRef<MIDIOutput | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dispatchRef = useRef<(e: SimonEvent) => void>(() => {}); // playRound and dispatch call each other

  useEffect(() => {
    fetch(`/songs/${song}/chart.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`No song called "${song}".`))))
      .then(setChart, (e: Error) => setError(e.message));
  }, [song]);

  const silence = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const out = outRef.current;
    if (out) {
      (out as MIDIOutput & { clear?(): void }).clear?.(); // drops queued sends where Chrome has it
      for (const m of allNotesOff(performance.now())) out.send(m.bytes, m.atMs);
    }
    setLit(new Set());
  }, []);

  const later = (ms: number, f: () => void) => timers.current.push(setTimeout(f, Math.max(0, ms)));

  const playRound = useCallback(
    (round: number, delayMs: number) => {
      if (!chart) return;
      const now = performance.now();
      const msgs = phraseMessages(chart, phrase(tune, round), now + delayMs);
      const out = outRef.current;
      const audio = audioRef.current;
      for (const m of msgs) {
        const [cmd, pitch] = m.bytes;
        if (out) out.send(m.bytes, m.atMs);
        else if (audio && cmd === 0x90) {
          const off = msgs.find((x) => x.bytes[0] === 0x80 && x.bytes[1] === pitch && x.atMs > m.atMs)!.atMs;
          tone(audio, audio.destination, "triangle", hz(pitch), audio.currentTime + (m.atMs - now) / 1000, (off - m.atMs) / 1000, 0.25);
        }
        later(m.atMs - now, () =>
          setLit((s) => {
            const next = new Set(s);
            if (cmd === 0x90) next.add(pitch);
            else next.delete(pitch);
            return next;
          }),
        );
      }
      later(msgs[msgs.length - 1].atMs + simonSettings.turnGapMs - now, () => dispatchRef.current({ type: "turn" }));
    },
    [chart, tune],
  );

  const dispatch = useCallback(
    (e: SimonEvent) => {
      const prev = runRef.current;
      if (!prev) return;
      const next = step(prev, e, tune);
      if (next === prev) return;
      runRef.current = next;
      setRun(next);
      if (next.phase === "over" || next.phase === "won") {
        setRuns((r) => [...r, { round: next.round, won: next.phase === "won" }]);
        if (next.phase === "over") setLit(new Set([phrase(tune, next.round)[next.pos].pitch]));
      } else if (next.round !== prev.round) playRound(next.round, simonSettings.nextRoundMs);
    },
    [tune, playRound],
  );
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  const start = useCallback(() => {
    if (!tune.length) return;
    silence();
    // Created inside the press, so the laptop tone may sound.
    if (!outRef.current && !audioRef.current) audioRef.current = new AudioContext();
    void audioRef.current?.resume().catch(() => {});
    runRef.current = newRun();
    setRun(runRef.current);
    playRound(1, simonSettings.leadMs);
  }, [tune, silence, playRound]);

  // Both inputs at once, so the laptop keys work without the piano. The laptop sounds its own presses; the piano does.
  useEffect(() => {
    if (!tune.length) return;
    const lowest = Math.min(...tune.map((n) => n.pitch));
    const onEvent = (e: InputEvent) => {
      setHeld((s) => {
        const next = new Set(s);
        if (e.type === "on") next.add(e.pitch);
        else next.delete(e.pitch);
        return next;
      });
      if (e.type === "on" && !outRef.current && audioRef.current && runRef.current?.phase === "turn")
        tone(audioRef.current, audioRef.current.destination, "triangle", hz(e.pitch), audioRef.current.currentTime, 0.4, 0.25);
      dispatch(e.type === "on" ? { type: "on", pitch: e.pitch } : { type: "off" });
    };
    const [midi, keys] = [midiDevice(setMidiStatus), keysDevice(lowest)];
    void midi.start(onEvent);
    void keys.start((e) => {
      laptopKey(e.type, e.pitch, e.velocity); // sounds only while laptop sound is the piano
      onEvent(e);
    });
    navigator.requestMIDIAccess?.().then(
      (a) => (outRef.current = [...a.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null),
      () => {},
    );
    return () => [midi, keys].forEach((d) => d.stop());
  }, [tune, dispatch]);

  // Space or Enter starts a run when none is going; All Notes Off when the page goes away.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== "Space" && e.code !== "Enter") || e.repeat) return;
      const phase = runRef.current?.phase;
      if (phase === "listen" || phase === "turn") return;
      e.preventDefault(); // a focused Again button would start a second run
      start();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", silence);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", silence);
      silence();
    };
  }, [start, silence]);

  const reach = laptopReach(tune);
  const title = SONGS.find(([id]) => id === song)?.[1] ?? chart?.title ?? song;

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.mark}>SIMON SAYS</h1>
        <nav className={styles.songs}>
          {SONGS.map(([id, name]) => (
            <a key={id} href={`/simon?song=${id}`} aria-current={id === song ? "page" : undefined}>
              {name}
            </a>
          ))}
        </nav>
      </header>

      <section className={styles.stage} aria-live="polite">
        {error ? <p className={styles.call}>{error}</p> : <Call run={run} title={title} total={tune.length} />}
        {run?.phase === "turn" && <Dots done={run.pos} of={phrase(tune, run.round).length} />}
        {chart && <Keys tune={tune} lit={lit} held={held} wrong={run?.phase === "over" ? run.wrong : null} />}
        {(!run || run.phase === "over" || run.phase === "won") && chart && (
          <button className={styles.again} onClick={start} title={`${run ? "Again" : "Start"} (Space)`} aria-keyshortcuts="Space Enter">
            {run ? "Again" : "Start"}
          </button>
        )}
      </section>

      <footer className={styles.foot}>
        <HelpLink />
        {reach !== null && <p>Laptop keys reach round {reach} on this song</p>}
        <p>{midiStatus}</p>
        {runs.length > 0 && (
          <ol className={styles.runs} aria-label="This session's runs">
            {runs.map((r, i) => (
              <li key={i}>
                {song} · {r.won ? `won at round ${r.round}` : `round ${r.round}`}
              </li>
            ))}
          </ol>
        )}
      </footer>
    </main>
  );
}

function Call({ run, title, total }: { run: Run | null; title: string; total: number }) {
  if (!run) return <p className={styles.call}>{title}: listen, then play it back. One wrong note ends the run.</p>;
  if (run.phase === "listen") return <p className={styles.call}>Round {run.round} · Listen</p>;
  if (run.phase === "turn") return <p className={`${styles.call} ${styles.turn}`}>Your turn</p>;
  if (run.phase === "won") return <p className={`${styles.call} ${styles.won}`}>The whole melody: {total} notes</p>;
  return <p className={`${styles.call} ${styles.over}`}>Run over · round {run.round}</p>;
}

function Dots({ done, of }: { done: number; of: number }) {
  return (
    <p className={styles.dots} aria-label={`${done} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} data-done={i < done || undefined} />
      ))}
    </p>
  );
}

// A plain DOM key row over the melody's range; each key the laptop reaches shows its letter.
function Keys({ tune, lit, held, wrong }: { tune: ChartNote[]; lit: ReadonlySet<number>; held: ReadonlySet<number>; wrong: number | null }) {
  const pitches = tune.map((n) => n.pitch);
  let lo = Math.min(...pitches);
  if (isBlack(lo)) lo--;
  let hi = Math.max(...pitches);
  if (isBlack(hi)) hi++;
  const codes = new Map([...keyMap(Math.min(...pitches))].map(([code, p]) => [p, code]));
  const key = (p: number) => ({
    "data-pitch": p,
    "data-code": codes.get(p),
    "data-lit": lit.has(p) || undefined,
    "data-held": held.has(p) || undefined,
    "data-wrong": wrong === p || undefined,
  });
  const label = (p: number) => codes.has(p) && <span>{letter(codes.get(p)!)}</span>;
  const whites = [];
  for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites.push(p);
  return (
    <div className={styles.keys}>
      {whites.map((p) => (
        <div key={p} className={styles.white} {...key(p)}>
          {label(p)}
          {isBlack(p + 1) && p + 1 <= hi && (
            <div className={styles.black} {...key(p + 1)}>
              {label(p + 1)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
