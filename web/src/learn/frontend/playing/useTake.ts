'use client';
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { counts } from '../mastery/engine';
import { learnerId } from '../mastery/diagnostic/learner';
import { listenToPiano, type PianoEvent, type PianoStatus } from '../mastery/piano/capture';
import { type HelpSegment, helpShare, scoreTake, type Verdict } from '../mastery/piano/score';
import { remoteStore } from '../mastery/remote';
import type { Attempt, PlayingItem } from '../mastery/schema';
import { type Hands, notesFor, passageBeats, playingAttempt } from './attempt';

export type TakePhase = 'ready' | 'listening' | 'countin' | 'playing' | 'result';
/** The help that can switch on and off mid-take. Tempo and hands are set before a take and help it whole. */
export type Aids = { demo: boolean; guide: boolean };
/** A key the learner pressed, in beats from the passage's first beat. A key still down runs to the playhead. */
export type PlayedBar = { pitch: number; from: number; to: number };
/** `saved` is null while the attempt is still being appended. */
export type TakeResult = { verdict: Verdict; attempt: Attempt; counts: boolean; saved: boolean | null };
export type TakeOptions = { item: PlayingItem; hands: Hands; bpm: number; wholeHelp: boolean };

const countIn = 4;
const leadMs = 150;

/**
 * One recorded take on the piano: a four-beat count-in on a click, the passage while it records, then the score and
 * an appended `Attempt`. Help is timed while the take runs, so a demo heard for a bar is that bar's share of help.
 */
export function useTake() {
  const [phase, setPhase] = useState<TakePhase>('ready');
  const [status, setStatus] = useState<PianoStatus | null>(null);
  const [beat, setBeat] = useState(-1);
  const [aids, setAidsState] = useState<Aids>({ demo: false, guide: false });
  const [played, setPlayed] = useState<PlayedBar[]>([]);
  const [down, setDown] = useState<number[]>([]);
  const [result, setResult] = useState<TakeResult | null>(null);
  const [silent, setSilent] = useState(false);

  const context = useRef<AudioContext | null>(null);
  const demoBus = useRef<GainNode | null>(null);
  const voices = useRef<AudioScheduledSourceNode[]>([]);
  const frame = useRef(0);
  const generation = useRef(0);
  const aidsRef = useRef(aids);
  const segments = useRef<HelpSegment[]>([]);
  const take = useRef<{ startMs: number; beatMs: number; recording: boolean; events: PianoEvent[] } | null>(null);
  const listening = useRef<Promise<void>>(Promise.resolve());

  const onEvent = useCallback((e: PianoEvent) => {
    if (e.type === 'pedal') { if (take.current?.recording) take.current.events.push(e); return; }
    setDown((d) => e.type === 'on' ? [...d.filter((p) => p !== e.pitch), e.pitch] : d.filter((p) => p !== e.pitch));
    const t = take.current;
    if (!t?.recording || e.timeMs < t.startMs - t.beatMs / 2) return;
    t.events.push(e);
    setPlayed(bars(t.events, t.startMs, t.beatMs, e.timeMs));
  }, []);

  // One listener at a time: a remount waits for the last one to stop, so its stop can't undo the new one.
  useEffect(() => {
    let alive = true;
    let unlisten: (() => void) | null = null;
    listening.current = listening.current.then(async () => {
      if (!alive) return;
      const stop = await listenToPiano(onEvent, (s) => { if (alive) setStatus(s); });
      if (alive) unlisten = stop; else stop();
    });
    return () => { alive = false; unlisten?.(); };
  }, [onEvent]);

  const halt = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    voices.current.forEach((v) => { try { v.stop(); } catch { /* Already ended. */ } v.disconnect(); });
    voices.current = [];
    demoBus.current?.disconnect();
    demoBus.current = null;
    if (take.current) take.current.recording = false;
  }, []);

  useEffect(() => () => { halt(); void context.current?.close(); context.current = null; }, [halt]);

  /** Switches the demo or the guide keys. Inside a take this opens or closes a help segment at this moment. */
  const setAids = useCallback((next: Aids) => {
    const now = performance.now();
    const was = aidsRef.current.demo || aidsRef.current.guide;
    const is = next.demo || next.guide;
    if (take.current?.recording && was !== is) {
      if (is) segments.current.push({ startMs: now, endMs: Infinity });
      else segments.current.at(-1)!.endMs = now;
    }
    const ctx = context.current;
    if (ctx && demoBus.current) demoBus.current.gain.setTargetAtTime(next.demo ? 1 : 0, ctx.currentTime, .02);
    aidsRef.current = next;
    setAidsState(next);
  }, []);

  const run = useCallback(async ({ item, hands, bpm, wholeHelp }: TakeOptions, record: boolean) => {
    halt();
    const run = generation.current;
    setResult(null); setPlayed([]);
    const [ctx, learner] = await Promise.all([audio(context), learnerId()]);
    if (run !== generation.current) return;
    setSilent(!ctx);
    const notes = notesFor(item, hands);
    const beatMs = 60000 / bpm;
    const ends = passageBeats(notes) + .5;
    const lead = record ? countIn : 1;
    const now = performance.now();
    const startMs = now + leadMs + lead * beatMs;
    take.current = { startMs, beatMs, recording: record, events: [] };
    segments.current = record && (aidsRef.current.demo || aidsRef.current.guide) ? [{ startMs: now, endMs: Infinity }] : [];
    if (ctx) {
      const at = (ms: number) => ctx.currentTime + (ms - now) / 1000;
      const bus = ctx.createGain();
      bus.gain.value = record ? (aidsRef.current.demo ? 1 : 0) : 1;
      bus.connect(ctx.destination);
      demoBus.current = bus;
      if (record) {
        for (let b = -countIn; b < Math.ceil(ends - .5); b++) {
          tone(voices, ctx, ctx.destination, b === -countIn || b === 0 ? 96 : 89, at(startMs + b * beatMs), .05, b < 0 ? .1 : .05, 'square');
        }
      }
      notes.forEach((n) => tone(voices, ctx, bus, n.pitch, at(startMs + n.startBeat * beatMs), n.beats * beatMs / 1000, .12));
    }
    setPhase(record ? 'countin' : 'listening');
    const tick = () => {
      if (run !== generation.current) return;
      const t = performance.now();
      const b = (t - startMs) / beatMs;
      setBeat(b);
      if (record && b >= 0) setPhase('playing');
      if (b < ends) { frame.current = requestAnimationFrame(tick); return; }
      if (!record) { halt(); setBeat(-1); setPhase('ready'); return; }
      take.current!.recording = false;
      const events = take.current!.events;
      segments.current.forEach((s) => { if (s.endMs === Infinity) s.endMs = t; });
      const share = wholeHelp ? 1 : helpShare(segments.current, startMs, t);
      const verdict = scoreTake({ ...item, notes }, { startMs, bpm, events });
      const attempt = playingAttempt({ learnerId: learner, item, verdict, helpShare: share, id: crypto.randomUUID(), at: new Date().toISOString() });
      setPlayed(bars(events, startMs, beatMs, t));
      const shown = { verdict, attempt, counts: counts(attempt), saved: null };
      setResult(shown);
      setPhase('result');
      halt();
      const settled = generation.current;
      void remoteStore().append(attempt).catch(() => false).then((saved) => {
        if (settled === generation.current) setResult({ ...shown, saved });
      });
    };
    frame.current = requestAnimationFrame(tick);
  }, [halt]);

  const start = useCallback((o: TakeOptions) => run(o, true), [run]);
  const listen = useCallback((o: TakeOptions) => run(o, false), [run]);
  const stop = useCallback(() => { halt(); setBeat(-1); setPlayed([]); setPhase('ready'); }, [halt]);
  const reset = stop;

  return { phase, status, beat, aids, setAids, played, down, result, silent, start, listen, stop, reset };
}

/** An AudioContext that is running, or null when the browser keeps it suspended. A silent take still scores. */
async function audio(context: RefObject<AudioContext | null>): Promise<AudioContext | null> {
  if (typeof AudioContext === 'undefined') return null;
  const ctx = context.current ?? new AudioContext();
  context.current = ctx;
  await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
  return ctx.state === 'running' ? ctx : null;
}

/** One enveloped note, kept in `voices` until it ends so a stop can cut it. */
function tone(voices: RefObject<AudioScheduledSourceNode[]>, ctx: AudioContext, out: AudioNode, pitch: number, at: number, seconds: number, level: number, type: OscillatorType = 'triangle') {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .008);
  gain.gain.exponentialRampToValueAtTime(.001, at + Math.max(.02, seconds * .9));
  oscillator.connect(gain); gain.connect(out);
  oscillator.start(at); oscillator.stop(at + seconds);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.current = voices.current.filter((v) => v !== oscillator); };
  voices.current.push(oscillator);
}

/** The take's key presses as bars in beats. A key still held runs to `nowMs`. */
function bars(events: readonly PianoEvent[], startMs: number, beatMs: number, nowMs: number): PlayedBar[] {
  const open = new Map<number, PlayedBar>();
  const out: PlayedBar[] = [];
  const at = (ms: number) => (ms - startMs) / beatMs;
  for (const e of events) {
    if (e.type === 'on') {
      const held = open.get(e.pitch);
      if (held) held.to = at(e.timeMs);
      const bar = { pitch: e.pitch, from: at(e.timeMs), to: Infinity };
      open.set(e.pitch, bar); out.push(bar);
    } else if (e.type === 'off') {
      const held = open.get(e.pitch);
      if (held) { held.to = at(e.timeMs); open.delete(e.pitch); }
    }
  }
  return out.map((b) => b.to === Infinity ? { ...b, to: at(nowMs) } : b);
}
