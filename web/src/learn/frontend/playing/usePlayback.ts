'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { music } from './model';

export function usePlayback() {
  const context = useRef<AudioContext | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const voices = useRef<OscillatorNode[]>([]);
  const [beat, setBeat] = useState(-1);
  const [active, setActive] = useState(false);
  const stop = useCallback(() => {
    generation.current++;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    voices.current.forEach((o) => { try { o.stop(); } catch { /* Voice already ended. */ } o.disconnect(); });
    voices.current = [];
    setActive(false); setBeat(-1);
  }, []);
  useEffect(() => () => {
    generation.current++;
    if (timer.current) clearInterval(timer.current);
    voices.current.forEach((o) => { try { o.stop(); } catch { /* Voice already ended. */ } });
    void context.current?.close();
  }, []);
  const start = useCallback(async ({ tempo, beats, sound, onEnd }: { tempo: number; beats: number; sound: boolean; onEnd: () => void }) => {
    stop();
    const run = generation.current;
    let ctx: AudioContext | null = null;
    if (sound) {
      ctx = context.current ?? new AudioContext(); context.current = ctx;
      await ctx.resume();
      if (run !== generation.current) return;
      if (ctx.state !== 'running') throw new Error('Audio could not start. Try again or continue without sound.');
      const origin = ctx.currentTime + .04;
      music.notes.filter((n) => n.beat < beats).forEach((n) => {
        const oscillator = ctx!.createOscillator();
        const gain = ctx!.createGain();
        const at = origin + n.beat * 60 / tempo;
        oscillator.type = 'triangle'; oscillator.frequency.value = 440 * 2 ** ((n.pitch - 69) / 12);
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.12, at + .012);
        gain.gain.exponentialRampToValueAtTime(.001, at + n.duration * 60 / tempo * .9);
        oscillator.connect(gain); gain.connect(ctx!.destination);
        oscillator.start(at); oscillator.stop(at + n.duration * 60 / tempo);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.current = voices.current.filter((v) => v !== oscillator); };
        voices.current.push(oscillator);
      });
    }
    const begin = performance.now();
    setActive(true); setBeat(0);
    timer.current = setInterval(() => {
      const next = (performance.now() - begin) / (60000 / tempo);
      if (next >= beats) { stop(); onEnd(); } else setBeat(next);
    }, 40);
  }, [stop]);
  return { beat, active, start, stop };
}
