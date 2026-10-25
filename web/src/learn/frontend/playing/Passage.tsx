import type { PassageNote } from '../mastery/schema';
import { type Hands, keyName, missedNotes, passageBeats } from './attempt';
import type { PlayedBar } from './useTake';
import styles from './playing.module.css';

const width = 1000;
const keys = 56;
const top = 22;
const right = 14;
const black = new Set([1, 3, 6, 8, 10]);

/**
 * The passage as a piano roll: one row per key, low at the bottom, a numbered line per beat. Notes are coloured by
 * hand; a hand left out of the take stays as a faint outline. Guide mode lights the key to press now and names it.
 * After a take, the keys played lie over the notes and a note nobody played is outlined in red.
 */
export function Passage({ notes, hands = 'both', beat = -1, guide = false, played = [], down = [] }: {
  notes: readonly PassageNote[]; hands?: Hands; beat?: number; guide?: boolean; played?: readonly PlayedBar[]; down?: readonly number[];
}) {
  const pitches = notes.map((n) => n.pitch);
  const spread = Math.max(...pitches) - Math.min(...pitches) + 5;
  const rows = Math.max(15, spread);
  const low = Math.min(...pitches) - 2 - Math.floor((rows - spread) / 2);
  const rowH = Math.min(34, Math.max(10, 520 / rows));
  const height = top + rows * rowH;
  const beats = Math.ceil(passageBeats(notes) - 1e-3);
  const x = (b: number) => keys + 10 + b / beats * (width - keys - 10 - right);
  const y = (pitch: number) => top + (low + rows - 1 - pitch) * rowH;
  const inTake = (n: PassageNote) => hands === 'both' || n.hand === hands;
  const now = notes.filter((n) => inTake(n) && n.startBeat <= beat && beat < n.startBeat + n.beats);
  const next = beat < 0 ? notes.filter(inTake).filter((n) => n.startBeat === Math.min(...notes.filter(inTake).map((m) => m.startBeat))) : [];
  const lit = new Set([...(guide ? [...now, ...next].map((n) => n.pitch) : []), ...down]);
  const missed = played.length && beat < 0 ? missedNotes(notes.filter(inTake), played) : new Set<PassageNote>();
  const label = 14; // user units in a 1000-wide viewBox: about 12 px on screen at 1280×720 (learn-kit, #947)
  return <svg className={styles.roll} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`The passage: ${notes.length} notes over ${beats} beats`}>
    <rect className={styles.keyBed} x={0} y={top} width={keys - 2} height={rows * rowH} />
    {Array.from({ length: rows }, (_, i) => {
      const pitch = low + rows - 1 - i;
      return <g key={pitch}>
        <rect className={black.has(pitch % 12) ? styles.rowBlack : styles.rowWhite} x={keys} y={y(pitch)} width={width - keys} height={rowH} />
        <rect className={lit.has(pitch) ? styles.keyLit : black.has(pitch % 12) ? styles.keyBlack : styles.keyWhite} x={0} y={y(pitch) + .5} width={black.has(pitch % 12) ? keys * .6 : keys - 2} height={rowH - 1} rx={1.5} />
        {pitch % 12 === 0 && rowH >= 9 && <text className={styles.keyLabel} x={keys - 7} y={y(pitch) + rowH / 2} fontSize={label}>{keyName(pitch)}</text>}
      </g>;
    })}
    {Array.from({ length: beats + 1 }, (_, b) => <g key={b}>
      <line className={b % 4 === 0 ? styles.beatStrong : styles.beat} x1={x(b)} x2={x(b)} y1={top} y2={height} />
      {b < beats && <text className={styles.beatLabel} x={x(b) + 4} y={top - 7}>{b + 1}</text>}
    </g>)}
    {notes.map((n, i) => {
      const past = beat >= n.startBeat + n.beats;
      const on = now.includes(n);
      const cls = !inTake(n) ? styles.noteOut : `${n.hand === 'left' ? styles.noteLeft : styles.noteRight}${past ? ` ${styles.notePast}` : ''}${on ? ` ${styles.noteNow}` : ''}${missed.has(n) ? ` ${styles.noteMissed}` : ''}`;
      return <rect key={i} className={cls} x={x(n.startBeat) + 1} y={y(n.pitch) + 1.5} width={Math.max(3, x(n.startBeat + n.beats) - x(n.startBeat) - 2)} height={rowH - 3} rx={Math.min(4, rowH / 3)} />;
    })}
    {guide && !played.length && [...now, ...next].map((n, i) => {
      const bx = x(n.startBeat) + 6;
      return <text key={`g${i}`} className={styles.noteName} x={bx} y={y(n.pitch) + rowH / 2} fontSize={label}>{keyName(n.pitch)}</text>;
    })}
    {played.map((p, i) => p.pitch >= low && p.pitch < low + rows && <rect key={`p${i}`} className={styles.played} x={x(Math.max(0, p.from))} y={y(p.pitch) + rowH / 2 - 2} width={Math.max(2, x(Math.min(beats, p.to)) - x(Math.max(0, p.from)))} height={4} rx={2} />)}
    {beat >= 0 && beat <= beats && <line className={styles.playhead} x1={x(beat)} x2={x(beat)} y1={top - 4} y2={height} />}
  </svg>;
}
