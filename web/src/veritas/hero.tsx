"use client";

// /veritas's hero: five test players, each on a real library song, judged in the browser by judgeTake, the judge
// /play uses. A playhead sweeps each take in 4 s, one after another; the judge's marks appear as it passes. All the
// motion is CSS (veritas.module.css), so reduced motion shows the end state at once and Replay just remounts.
import { type CSSProperties, useEffect, useState } from "react";
import type { Chart } from "../contracts";
import styles from "../app/veritas/veritas.module.css";
import { judgeTake, noteTimeMs } from "../game/core/judge";
import { msPerBeat } from "../game/core/settings";
import { chordRoller, fumbler, golden, jitter, rusher, tally, type Run, type Tally } from "./players";

export const RUSHER_ISSUE = 545;

const RUNS = [
  { key: "golden", name: "Golden", song: "fur-elise", does: "Presses a semitone off on exactly two notes: the writeup's golden test.", play: golden },
  { key: "rusher", name: "Rusher", song: "twinkle", does: "Plays the whole song at 115% speed.", play: rusher },
  { key: "jitter", name: "Jitter", song: "ode-to-joy", does: "Plays each note up to 60 ms early or late, from a fixed seed.", play: jitter },
  { key: "fumbler", name: "Fumbler", song: "fur-elise", does: "Presses every 10th note a semitone off.", play: fumbler },
  { key: "chordRoller", name: "Chord Roller", song: "chopin-prelude-4", does: "Rolls each chord low to high over 60 ms.", play: chordRoller },
] as const;

type Done = { chart: Chart; run: Run; tally: Tally };
type State = Record<string, Done | "failed">;

const vars = (v: Record<string, number>) => Object.fromEntries(Object.entries(v).map(([k, n]) => [`--${k}`, n])) as CSSProperties;

export function Hero() {
  const [state, setState] = useState<State>({});
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    const charts = new Map<string, Promise<Chart>>();
    const load = (id: string) => charts.get(id) ?? charts.set(id, fetch(`/songs/${id}/chart.json`).then((r) => r.json())).get(id)!;
    for (const r of RUNS) {
      load(r.song).then(
        (chart) => {
          const run = r.play(chart);
          const done = { chart, run, tally: tally(chart, run, judgeTake(chart, run.take)) };
          if (live) setState((s) => ({ ...s, [r.key]: done }));
        },
        () => live && setState((s) => ({ ...s, [r.key]: "failed" })),
      );
    }
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className={styles.hero} aria-label="The judge against planted mistakes">
      <div key={round} className={styles.runs}>
        {RUNS.map((r, i) => (
          <RunView key={r.key} index={i} name={r.name} id={r.key} does={r.does} done={state[r.key]} />
        ))}
      </div>
      <p className={styles.note}>
        Computed in your browser by the judge /play uses.{" "}
        <button type="button" className={styles.replay} onClick={() => setRound((n) => n + 1)}>
          Replay
        </button>
      </p>
    </section>
  );
}

function RunView({ index, name, id, does, done }: { index: number; name: string; id: string; does: string; done: Done | "failed" | undefined }) {
  const head = (
    <header className={styles.runHead}>
      <h2 className={styles.player}>{name}</h2>
      <p className={styles.does}>{does}</p>
    </header>
  );
  if (done === "failed") return <article className={styles.run} data-run={id}>{head}<p className={styles.dim}>Couldn&apos;t load this song&apos;s chart.</p></article>;
  if (!done) return <article className={styles.run} data-run={id}>{head}<p className={styles.dim}>Loading…</p></article>;

  const { chart, run, tally: t } = done;
  const notes = chart.notes.map((n) => noteTimeMs(chart, n));
  const presses = run.take.events.map((e) => e.timeMs);
  const span = Math.max(...notes, ...presses) + msPerBeat(chart.bpm);
  const pitches = chart.notes.map((n) => n.pitch);
  const [lo, hi] = [Math.min(...pitches), Math.max(...pitches)];
  const y = (p: number) => (hi === lo ? 0.5 : 0.9 - (0.8 * (p - lo)) / (hi - lo));
  const ringed = new Set(run.planted.flatMap((p) => (p.kind === "rolled" ? p.notes : p.kind === "tempo" ? [] : [p.note])));
  const tempo = run.planted.some((p) => p.kind === "tempo");
  const marks = t.marks.flatMap((m, k) => {
    if (!m.found) return [];
    const p = m.plant;
    if (p.kind === "wrong") return [{ k, x: notes[p.note] / span, label: "✕", kind: "wrong" }];
    if (p.kind === "early" || p.kind === "late") return [{ k, x: notes[p.note] / span, label: p.kind.toUpperCase(), kind: p.kind }];
    if (p.kind === "rolled") return [{ k, x: (p.beat * msPerBeat(chart.bpm)) / span, label: "ROLLED", kind: "rolled" }];
    return [];
  });

  return (
    <article
      className={styles.run}
      data-run={id}
      data-planted={t.planted}
      data-found={t.found ?? "none"}
      data-false-alarms={t.falseAlarms}
      style={vars({ i: index })}
    >
      {head}
      <p className={styles.song}>
        {chart.title} · {chart.composer}
      </p>
      <div className={styles.strip} aria-hidden="true">
        {notes.map((ms, n) => (
          <i key={n} className={ringed.has(n) ? `${styles.tick} ${styles.planted}` : styles.tick} style={vars({ x: ms / span, y: y(chart.notes[n].pitch) })} />
        ))}
        {presses.map((ms, n) => (
          <i key={`p${n}`} className={styles.press} style={vars({ x: ms / span })} />
        ))}
        {marks.map((m, n) => (
          <b key={m.k} className={`${styles.mark} ${styles[m.kind]}`} style={vars({ x: m.x, row: n % 3 })}>
            {m.label}
          </b>
        ))}
        <span className={styles.playhead} />
      </div>
      <p className={styles.tally}>
        <span className={styles.num}>{t.planted}</span> planted,{" "}
        {tempo ? (
          <span className={styles.dim}>no rushing flag yet (#{RUSHER_ISSUE})</span>
        ) : (
          <>
            <span className={styles.num}>{t.found}</span> found
          </>
        )}
        , <span className={styles.num}>{t.falseAlarms}</span> false alarm{t.falseAlarms === 1 ? "" : "s"}
      </p>
    </article>
  );
}
