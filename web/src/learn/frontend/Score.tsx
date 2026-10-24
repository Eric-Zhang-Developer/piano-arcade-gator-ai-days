import { phraseNotes } from './lesson';
import styles from './learning.module.css';

const pitchSteps: Record<number, number> = {60: -2, 62: -1, 64: 0, 65: 1, 67: 2, 69: 3, 71: 4, 72: 5};
export function PhraseScore({ phrase }: { phrase: 1 | 2 }) {
  const notes = phraseNotes(phrase);
  return <figure className={styles.phrase}><figcaption>Phrase {phrase}<span>Bars {phrase === 1 ? '1–2' : '3–4'}</span></figcaption><svg viewBox="0 0 660 155" role="img" aria-label={`Phrase ${phrase}, bars ${phrase === 1 ? '1 to 2, ending on G' : '3 to 4, ending on C'}`}>
    {[0, 1, 2, 3, 4].map(i => <line key={i} x1="20" x2="640" y1={50 + i * 12} y2={50 + i * 12} stroke="currentColor" strokeWidth=".7"/>)}
    <text x="22" y="90" fontSize="49" fontFamily="serif">𝄞</text><text x="63" y="66" fontSize="20">4</text><text x="63" y="92" fontSize="20">4</text>
    {[0, 1, 2].map(i => <line key={i} x1={90 + i * 275} x2={90 + i * 275} y1="50" y2="98" stroke="currentColor"/>)}
    {notes.map(n => {const x=110+n.beat*65; const y=98-pitchSteps[n.pitch]*6; return <g key={n.id}>{n.pitch===60 && <line x1={x-11} x2={x+11} y1={110} y2={110} stroke="currentColor"/>}<ellipse cx={x} cy={y} rx="7" ry="5" transform={`rotate(-20 ${x} ${y})`} fill={n.duration>=2 ? 'var(--learn-paper)' : 'currentColor'} stroke="currentColor" strokeWidth="1.6"/><line x1={x+6} x2={x+6} y1={y-1} y2={y-38} stroke="currentColor" strokeWidth="1.4"/></g>;})}
  </svg></figure>;
}
