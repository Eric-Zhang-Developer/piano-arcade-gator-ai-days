'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Brackets, Button, DuoScope, Panel } from '../../duo';
import { choices } from '../../theory';
import { curriculum } from '../curriculum';
import type { AttemptStore } from '../engine';
import { type PianoEvent, type PianoStatus, listenToPiano } from '../piano/capture';
import { scoreTake } from '../piano/score';
import { remoteStore } from '../remote/store';
import type { Attempt, PlayingItem, TheoryItem } from '../schema';
import { learnerId } from './learner';
import { nextItem, playingAttempt, shouldStop, theoryAttempt } from './model';
import { BEATS_PER_BAR, Passage } from './Passage';
import styles from './diagnostic.module.css';

// `now` is when the attempts were last read or added to: the stop rule's clock.
type Loaded = { learner: string; attempts: readonly Attempt[]; now: number };
type Heading = RefObject<HTMLHeadingElement | null>;
type Answer = (attempt: Attempt) => Promise<void>;

/**
 * The adaptive diagnostic at the real piano: one item at a time, chosen from the attempts so far, with no verdict
 * shown. Every answer is stored as it is given, so Stop keeps the progress and a later visit resumes where it left
 * off. When the stop rule holds, the map shows what it found. Only what the student needs to answer, play, stop or
 * recover is on screen: the engine picks every item, so there is nothing to choose.
 */
export function Diagnostic({ store: given }: { store?: AttemptStore }) {
  const router = useRouter();
  const store = useMemo(() => given ?? remoteStore(), [given]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [skip, setSkip] = useState<ReadonlySet<string>>(new Set());
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const learner = await learnerId();
      const attempts = await store.list(learner);
      if (!cancelled) setLoaded({ learner, attempts, now: Date.now() });
    })();
    return () => { cancelled = true; };
  }, [store]);

  const item = loaded ? nextItem(curriculum, loaded.attempts, skip) : null;
  const done = !!loaded && (!item || shouldStop(curriculum, loaded.attempts, loaded.now, skip));

  useEffect(() => {
    if (done) router.replace('/learn');
  }, [done, router]);

  useEffect(() => {
    if (loaded) requestAnimationFrame(() => heading.current?.focus());
  }, [loaded, item?.id]);

  async function answer(attempt: Attempt) {
    if (!loaded) return;
    await store.append(attempt);
    const attempts = [...loaded.attempts, attempt];
    const now = Date.now();
    setLoaded({ ...loaded, attempts, now });
  }

  return <DuoScope className={styles.screen}>
    <div className={styles.column}>
      <div className={styles.top}>
        <Link href="/learn" className={styles.stopLink}>Stop</Link>
      </div>
      {loaded && !done && item && <Brackets>
        <Panel style={{ padding: 40 }}>
          {item.type === 'theory'
            ? <Theory key={item.id} item={item} learner={loaded.learner} heading={heading} answer={answer}/>
            : <Playing key={item.id} item={item} learner={loaded.learner} heading={heading} answer={answer}
                skip={() => setSkip(new Set([...skip, item.id]))}/>}
        </Panel>
      </Brackets>}
    </div>
  </DuoScope>;
}

function Theory({ item, learner, heading, answer }: { item: TheoryItem; learner: string; heading: Heading; answer: Answer }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function next(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1 || !picked || saving) return;
    setSaving(true);
    await answer(theoryAttempt(learner, item, picked));
  }
  return <>
    <h1 id="diagnostic-item" ref={heading} tabIndex={-1} className={styles.prompt}>{item.prompt}</h1>
    <fieldset className={styles.options} aria-labelledby="diagnostic-item">
      {choices(item).map((choice) => <div key={choice.id} className={styles.option} data-picked={picked === choice.id || undefined}>
        <label className={styles.choice}>
          <input type="radio" name={`answer-${item.id}`} value={choice.id} checked={picked === choice.id} disabled={saving}
            onChange={() => setPicked(choice.id)}/>
          <span>{choice.text}</span>
        </label>
      </div>)}
    </fieldset>
    <div className={styles.actions}>
      <Button style={{ fontSize: 16 }} disabled={!picked || saving} onClick={next}>Next</Button>
    </div>
  </>;
}

type Phase = { name: 'ready' } | { name: 'counting'; startMs: number } | { name: 'listening'; startMs: number } | { name: 'saving' };

const beatMs = (bpm: number) => 60000 / bpm;
const passageBeats = (item: PlayingItem) => Math.max(0, ...item.notes.map((n) => n.startBeat + n.beats));

/** A click per beat of the count-in. Without audio the count still shows on screen. */
function countIn(bpm: number): () => void {
  try {
    const ctx = new AudioContext();
    for (let beat = 0; beat < BEATS_PER_BAR; beat++) {
      const at = ctx.currentTime + 0.05 + (beat * beatMs(bpm)) / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = beat === 0 ? 1320 : 880;
      gain.gain.setValueAtTime(0.25, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.07);
    }
    // Closed once, by the timer or by leaving the item, whichever comes first.
    const close = () => { if (ctx.state !== 'closed') void ctx.close(); };
    const timer = setTimeout(close, BEATS_PER_BAR * beatMs(bpm) + 500);
    return () => { clearTimeout(timer); close(); };
  } catch {
    return () => {};
  }
}

function Playing({ item, learner, heading, answer, skip }: {
  item: PlayingItem; learner: string; heading: Heading; answer: Answer; skip: () => void;
}) {
  const [piano, setPiano] = useState<PianoStatus | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'ready' });
  const [beat, setBeat] = useState(0);
  const events = useRef<PianoEvent[]>([]);
  const recording = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const silence = useRef<() => void>(() => {});
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stop: () => void = () => {};
    const pending = timers.current;
    listenToPiano(
      (e) => { if (recording.current) events.current.push(e); },
      (s) => { if (!cancelled) setPiano(s); },
    ).then((s) => { if (cancelled) s(); else stop = s; });
    return () => {
      cancelled = true;
      stop();
      pending.forEach(clearTimeout);
      silence.current();
    };
  }, []);

  async function finish(startMs: number) {
    if (finished.current) return;
    finished.current = true;
    recording.current = false;
    timers.current.forEach(clearTimeout);
    setPhase({ name: 'saving' });
    const verdict = scoreTake(item, { startMs, bpm: item.bpm, events: events.current });
    await answer(playingAttempt(learner, item, verdict));
  }

  function start(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 1 || phase.name !== 'ready') return;
    const beat = beatMs(item.bpm);
    const startMs = performance.now() + BEATS_PER_BAR * beat;
    events.current = [];
    recording.current = true;
    silence.current = countIn(item.bpm);
    setBeat(1);
    setPhase({ name: 'counting', startMs });
    for (let b = 1; b < BEATS_PER_BAR; b++) timers.current.push(setTimeout(() => setBeat(b + 1), b * beat));
    timers.current.push(setTimeout(() => setPhase({ name: 'listening', startMs }), BEATS_PER_BAR * beat));
    // The take ends a beat after the last note should have let go.
    timers.current.push(setTimeout(() => void finish(startMs), (BEATS_PER_BAR + passageBeats(item) + 1) * beat));
  }

  const startMs = phase.name === 'counting' || phase.name === 'listening' ? phase.startMs : undefined;
  const noPiano = piano?.state === 'no-piano';
  return <div data-start-ms={startMs} data-bpm={item.bpm} data-phase={phase.name}>
    <h1 ref={heading} tabIndex={-1} className={styles.prompt}>{item.prompt}</h1>
    <div className={styles.paper}>
      <Passage notes={item.notes} label={`The passage to play, ${item.notes.length} notes at ${item.bpm} beats a minute`}/>
    </div>
    <p className={styles.status} role="status">
      {phase.name === 'counting' ? `Count-in ${beat} of ${BEATS_PER_BAR}`
        : phase.name === 'listening' ? 'Play'
        : phase.name === 'ready' && piano?.state === 'no-piano' ? piano.reason
        : ''}
    </p>
    <div className={styles.actions}>
      {phase.name === 'ready' && <Button style={{ fontSize: 16 }} disabled={piano?.state !== 'piano'} onClick={start}>Start</Button>}
      {noPiano && phase.name === 'ready' && <Button kind="secondary" style={{ fontSize: 16 }} onClick={skip}>Skip this one</Button>}
    </div>
  </div>;
}
