import { music } from './model';
import { APP_NAME } from '../../../game/app-name';
import styles from './playing.module.css';

const letterSteps: Record<number, number> = { 60: -2, 62: -1, 64: 0, 65: 1, 67: 2, 69: 3 };
export function Score({ whole = false, beat = -1, hints = false }: { whole?: boolean; beat?: number; hints?: boolean }) {
  const rows = whole ? 3 : 1;
  return <div className={styles.paper}>
    <svg viewBox={`0 0 800 ${rows * 156 + 24}`} role="img" aria-label={`Twinkle, Twinkle, Little Star. ${whole ? 'Whole melody, twelve bars' : 'Opening two bars'}. Right hand, four beats per bar.`} className={styles.score}>
      {Array.from({ length: rows }, (_, row) => {
        const first = row * 16;
        const end = whole ? first + 16 : 8;
        const width = whole ? 16 : 8;
        const y = 50 + row * 156;
        const x = (b: number) => 100 + ((b - first) / width) * 672;
        return <g key={row}>
          {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="22" x2="780" y1={y + line * 10} y2={y + line * 10} stroke="currentColor" strokeWidth="1" opacity=".5" />)}
          <text x="32" y={y + 36} fontSize="56" fontFamily="serif">𝄞</text>
          {row === 0 && <><text x="76" y={y + 14} fontSize="18">4</text><text x="76" y={y + 35} fontSize="18">4</text></>}
          {Array.from({ length: width / 4 + 1 }, (_, i) => <line key={i} x1={x(first + i * 4)} x2={x(first + i * 4)} y1={y} y2={y + 40} stroke="currentColor" strokeWidth="1" opacity=".6" />)}
          {Array.from({ length: width / 4 }, (_, i) => <text key={i} x={x(first + i * 4) + 5} y={y - 17} fontSize="12" opacity=".65">{first / 4 + i + 1}</text>)}
          {music.notes.filter((n) => n.beat >= first && n.beat < end).map((n) => {
            const nx = x(n.beat) + 24;
            const ny = y + 40 - (letterSteps[n.pitch] ?? 0) * 5;
            return <g key={n.id}>
              {n.pitch === 60 && <line x1={nx - 12} x2={nx + 12} y1={y + 50} y2={y + 50} stroke="currentColor" />}
              <ellipse cx={nx} cy={ny} rx="7" ry="4.8" transform={`rotate(-18 ${nx} ${ny})`} fill={n.duration === 2 ? 'var(--learn-paper, #f2ecdf)' : 'currentColor'} stroke="currentColor" strokeWidth="1.7" />
              <line x1={nx + 6} x2={nx + 6} y1={ny} y2={ny - 29} stroke="currentColor" strokeWidth="1.6" />
              {hints && <text x={nx} y={y + 82} textAnchor="middle" fontSize="14" opacity=".7">{['C', 'D', 'E', 'F', 'G', 'A', 'B'][(letterSteps[n.pitch] + 2) % 7]}</text>}
            </g>;
          })}
          {beat >= first && beat < end && <line x1={x(beat) + 24} x2={x(beat) + 24} y1={y - 9} y2={y + 61} stroke="var(--learn-score-cursor, #711887)" strokeWidth="2.5" />}
        </g>;
      })}
    </svg>
  </div>;
}
export function ScoreSource() {
  return <details className={styles.details}><summary>Score source</summary><p>Traditional French melody, right hand. Uses the cited Twinkle chart already in {APP_NAME}. <a href="https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2236" target="_blank" rel="noreferrer">Public-domain score at Mutopia</a>.</p></details>;
}
