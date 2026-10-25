import type { PassageNote } from '../schema';

/** Beats per bar. Playing items carry no meter yet, so every passage is drawn in 4/4. */
export const BEATS_PER_BAR = 4;
const BARS_PER_ROW = 4;
const ROW_BEATS = BEATS_PER_BAR * BARS_PER_ROW;

const WIDTH = 800;
const LEFT = 22;
const RIGHT = 780;
const NOTES_LEFT = 130;
const NOTES_WIDTH = 630;
const GAP = 10;
const STAFF = 4 * GAP;
const BASS_OFFSET = 80;
const ROW_HEIGHT = 200;
const TOP = 30;

// Diatonic step of each pitch class (C D E F G A B), and which are sharps.
const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const diatonic = (pitch: number) => Math.floor(pitch / 12) * 7 + LETTER[pitch % 12];
// The bottom line of each staff: E4 in the treble, G2 in the bass.
const TREBLE_BOTTOM = diatonic(64);
const BASS_BOTTOM = diatonic(43);

const end = (notes: readonly PassageNote[]) => Math.max(0, ...notes.map((n) => n.startBeat + n.beats));

/** The passage on a grand staff, four bars to a row: right hand on the treble, left on the bass. */
export function Passage({ notes, label }: { notes: readonly PassageNote[]; label: string }) {
  const total = Math.max(BEATS_PER_BAR, Math.ceil(end(notes) / BEATS_PER_BAR) * BEATS_PER_BAR);
  // A passage shorter than a row spreads across the whole paper rather than filling its left part.
  const rowBeats = Math.min(ROW_BEATS, total);
  const rows = Math.ceil(total / rowBeats);
  // The last row ends just under its bass staff, with room for a ledger line or a stem below it.
  const height = TOP + (rows - 1) * ROW_HEIGHT + BASS_OFFSET + STAFF + TOP;
  return <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={label} width="100%" style={{ display: 'block' }}>
    {Array.from({ length: rows }, (_, row) => {
      const first = row * rowBeats;
      const beats = Math.min(rowBeats, total - first);
      const width = (beats / rowBeats) * (RIGHT - NOTES_LEFT) + NOTES_LEFT;
      const treble = TOP + row * ROW_HEIGHT;
      const bass = treble + BASS_OFFSET;
      const x = (beat: number) => NOTES_LEFT + ((beat - first) / rowBeats) * NOTES_WIDTH + 14;
      return <g key={row}>
        {[treble, bass].map((top) => [0, 1, 2, 3, 4].map((i) =>
          <line key={`${top}-${i}`} x1={LEFT} x2={width} y1={top + i * GAP} y2={top + i * GAP} stroke="currentColor" strokeWidth={1} opacity={0.5}/>))}
        <line x1={LEFT} x2={LEFT} y1={treble} y2={bass + STAFF} stroke="currentColor" strokeWidth={1.5}/>
        {Array.from({ length: beats / BEATS_PER_BAR }, (_, bar) => {
          const bx = bar === beats / BEATS_PER_BAR - 1 ? width : x(first + (bar + 1) * BEATS_PER_BAR) - 14;
          return <line key={bar} x1={bx} x2={bx} y1={treble} y2={bass + STAFF} stroke="currentColor" strokeWidth={1} opacity={0.6}/>;
        })}
        <text x={LEFT + 6} y={treble + 33} fontSize={56} fontFamily="serif" fill="currentColor">𝄞</text>
        <text x={LEFT + 6} y={bass + 32} fontSize={46} fontFamily="serif" fill="currentColor">𝄢</text>
        {row === 0 && <>
          <text x={LEFT + 62} y={treble + 19} fontSize={22} fontFamily="serif" fontWeight={700} fill="currentColor">4</text>
          <text x={LEFT + 62} y={treble + 39} fontSize={22} fontFamily="serif" fontWeight={700} fill="currentColor">4</text>
          <text x={LEFT + 62} y={bass + 19} fontSize={22} fontFamily="serif" fontWeight={700} fill="currentColor">4</text>
          <text x={LEFT + 62} y={bass + 39} fontSize={22} fontFamily="serif" fontWeight={700} fill="currentColor">4</text>
        </>}
        {notes.filter((n) => n.startBeat >= first && n.startBeat < first + rowBeats).map((n, i) =>
          <Note key={i} note={n} x={x(n.startBeat)} top={n.hand === 'left' ? bass : treble}/>)}
      </g>;
    })}
  </svg>;
}

function Note({ note, x, top }: { note: PassageNote; x: number; top: number }) {
  const d = diatonic(note.pitch);
  // Staff steps above the bottom line: 0 is the bottom line, 8 the top one.
  const step = d - (note.hand === 'left' ? BASS_BOTTOM : TREBLE_BOTTOM);
  const y = top + STAFF - step * (GAP / 2);
  const ledgers: number[] = [];
  for (let s = -2; s >= step; s -= 2) ledgers.push(s);
  for (let s = 10; s <= step; s += 2) ledgers.push(s);
  const hollow = note.beats >= 2;
  const up = step < 4;
  const stemX = up ? x + 6.4 : x - 6.4;
  const stemEnd = up ? y - 30 : y + 30;
  return <g data-pitch={note.pitch} data-beat={note.startBeat} data-beats={note.beats}>
    {ledgers.map((s) => <line key={s} x1={x - 12} x2={x + 12} y1={top + STAFF - s * (GAP / 2)} y2={top + STAFF - s * (GAP / 2)} stroke="currentColor" strokeWidth={1}/>)}
    {SHARP[note.pitch % 12] === 1 && <text x={x - 24} y={y + 7} fontSize={22} fontFamily="serif" fill="currentColor">♯</text>}
    <ellipse cx={x} cy={y} rx={7} ry={4.8} transform={`rotate(-18 ${x} ${y})`} stroke="currentColor" strokeWidth={1.7}
      fill={hollow ? 'var(--learn-paper)' : 'currentColor'}/>
    {note.beats < 4 && <line x1={stemX} x2={stemX} y1={y} y2={stemEnd} stroke="currentColor" strokeWidth={1.6}/>}
    {note.beats < 1 && <path d={up ? `M${stemX} ${stemEnd} q 4 8 10 12` : `M${stemX} ${stemEnd} q 4 -8 10 -12`} fill="none" stroke="currentColor" strokeWidth={2}/>}
    {[1.5, 3].includes(note.beats) && <circle cx={x + 12} cy={step % 2 === 0 ? y - GAP / 2 : y} r={1.8} fill="currentColor"/>}
  </g>;
}
