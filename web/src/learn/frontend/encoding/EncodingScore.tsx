'use client';

import { useEffect, useRef, useState } from 'react';
import { playPhrase } from '../audio';
import { Button } from '../duo';
import { phraseNotes } from '../lesson';
import type { Phrase } from '../theory';
import s from './encoding.module.css';

// Staff steps from the bottom line (E4) for the pitches Twinkle uses.
const pitchSteps: Record<number, number> = { 60: -2, 62: -1, 64: 0, 65: 1, 67: 2, 69: 3, 71: 4, 72: 5 };
const phrases = [
  { phrase: 1, bars: '1-2', ending: 'G' },
  { phrase: 2, bars: '3-4', ending: 'C' },
] as const;

// The kit button's inline colours would beat any class, so they are cleared here and .listen draws it in paper ink.
const paperButton = { background: undefined, color: undefined, border: undefined, cursor: undefined, fontSize: 16 };

function Staff({ phrase }: { phrase: Phrase }) {
  const notes = phraseNotes(phrase);
  const bars = phrase === 1 ? '1 to 2, ending on G' : '3 to 4, ending on C';
  return <svg viewBox="0 0 660 155" role="img" aria-label={`Phrase ${phrase}, bars ${bars}`}>
    {[0, 1, 2, 3, 4].map(i => <line key={i} x1="20" x2="640" y1={50 + i * 12} y2={50 + i * 12} stroke="currentColor" strokeWidth=".7" />)}
    <text x="22" y="90" fontSize="49" fontFamily="serif" fill="currentColor">𝄞</text>
    <text x="63" y="66" fontSize="20" fill="currentColor">4</text>
    <text x="63" y="92" fontSize="20" fill="currentColor">4</text>
    {[0, 1, 2].map(i => <line key={i} x1={90 + i * 275} x2={90 + i * 275} y1="50" y2="98" stroke="currentColor" />)}
    {notes.map(n => {
      // Each bar's first note sits clear of the bar line before it, as bar 1's does after the clef line.
      const x = 110 + n.beat * 65 + Math.floor(n.beat / 4) * 15;
      const y = 98 - pitchSteps[n.pitch] * 6;
      return <g key={n.id}>
        {n.pitch === 60 && <line x1={x - 11} x2={x + 11} y1={110} y2={110} stroke="currentColor" />}
        <ellipse cx={x} cy={y} rx="7" ry="5" transform={`rotate(-20 ${x} ${y})`} fill={n.duration >= 2 ? 'var(--learn-paper)' : 'currentColor'} stroke="currentColor" strokeWidth="1.6" />
        <line x1={x + 6} x2={x + 6} y1={y - 1} y2={y - 38} stroke="currentColor" strokeWidth="1.4" />
      </g>;
    })}
  </svg>;
}

/** Both phrases on paper, each with Listen. The phrase the current question asks about is marked. */
export function EncodingScore({ focus }: { focus?: Phrase }) {
  const [playing, setPlaying] = useState<Phrase | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const halt = () => {
    stop.current?.();
    stop.current = null;
    window.clearTimeout(timer.current);
    setPlaying(null);
  };
  useEffect(() => () => { stop.current?.(); window.clearTimeout(timer.current); }, []);

  const listen = (phrase: Phrase) => {
    const again = playing === phrase;
    halt();
    if (again) return;
    try {
      stop.current = playPhrase(phrase);
    } catch {
      // No audio here (blocked or unsupported): the score still reads without it.
      return;
    }
    setPlaying(phrase);
    timer.current = window.setTimeout(() => { stop.current = null; setPlaying(null); }, 4400);
  };

  return <div className={s.sheet}>
    {phrases.map(p => <figure key={p.phrase} className={s.paper} data-focus={p.phrase === focus} data-phrase={p.phrase}>
      <div className={s.paperBar}>
        <span className={s.paperTitle}>Phrase {p.phrase} · bars {p.bars}</span>
        {playing === p.phrase && <span className={s.playing} role="status">Playing</span>}
        <Button kind="secondary" className={s.listen} style={paperButton} aria-pressed={playing === p.phrase} onClick={() => listen(p.phrase)}>
          {playing === p.phrase ? 'Stop' : 'Listen'}
        </Button>
      </div>
      <Staff phrase={p.phrase} />
      <figcaption>Ends on {p.ending}, held two beats.</figcaption>
    </figure>)}
  </div>;
}
