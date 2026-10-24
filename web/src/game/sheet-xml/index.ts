// Sheet XML (spec: sheet-xml): a chart as MusicXML 4.0 on a grand staff, built from strings with no dependency. The
// right hand on the treble staff, the left on the bass; bars, ties, chords, voices and a spelled key. Pure: the same
// chart gives the same string. placeNotes is what sheet-view uses to find a judged note's notehead.
import type { Chart, ChartNote } from "../../contracts";
import { estimateKey, spell, spellingFor, type Key } from "./key";
import { overrides, type Override } from "./overrides";

export const DIVISIONS = 4; // per quarter note: a 16th is 1

// The note values that print without a tie: 16th to whole, plain or dotted, largest first.
const VALUES: [number, string, boolean][] = [
  [16, "whole", false],
  [12, "half", true],
  [8, "half", false],
  [6, "quarter", true],
  [4, "quarter", false],
  [3, "eighth", true],
  [2, "eighth", false],
  [1, "16th", false],
];
// A length as printable values, largest first (5 -> 4 + 1).
function pieces(len: number): [number, string, boolean][] {
  const out: [number, string, boolean][] = [];
  for (const v of VALUES)
    while (len >= v[0]) {
      out.push(v);
      len -= v[0];
    }
  return out;
}

export interface Meter {
  beats: number;
  beatType: number;
}

// Whole beatsPerBar -> n/4, whole eighths -> n/8, else n/16 (1.5 is 3/8, 4.5 is 9/8).
export function meterFor(beatsPerBar: number): Meter {
  for (const beatType of [4, 8, 16]) {
    const beats = (beatsPerBar * beatType) / 4;
    if (Number.isInteger(beats)) return { beats, beatType };
  }
  throw new Error(`beatsPerBar ${beatsPerBar} isn't a whole number of 16ths`);
}

export function keyAndMeter(chart: Chart): { key: Key; meter: Meter } {
  const o: Override = overrides[chart.id] ?? {};
  const est = estimateKey(chart);
  const key: Key = { fifths: o.fifths ?? est.fifths, mode: o.mode ?? est.mode };
  const rule = meterFor(chart.beatsPerBar);
  const meter = { beats: o.beats ?? rule.beats, beatType: o.beatType ?? rule.beatType };
  if ((4 * meter.beats) / meter.beatType !== chart.beatsPerBar)
    throw new Error(`${chart.id}: the table's ${meter.beats}/${meter.beatType} isn't beatsPerBar ${chart.beatsPerBar}`);
  return { key, meter };
}

export interface Placed {
  id: string;
  staff: 1 | 2; // 1 treble (right hand), 2 bass (left hand)
  onset: number; // divisions from beat 0, quantized to a 16th
  end: number;
  pitch: number;
}

// Each note's staff and quantized onset and end: both round to the nearest 16th, and a note keeps at least a 16th.
export function placeNotes(chart: Chart): Placed[] {
  return chart.notes.map((n: ChartNote) => {
    const onset = Math.round(n.beat * DIVISIONS);
    const end = Math.max(onset + 1, Math.round((n.beat + n.duration) * DIVISIONS));
    return { id: n.id, staff: n.hand === "L" ? 2 : 1, onset, end, pitch: n.pitch };
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Chord {
  onset: number;
  end: number;
  pitches: number[]; // low to high
  voice: number;
  first: string; // a note id, to name in errors
}

// One staff's notes as chords (same onset and end), each in the first free voice: 1–4 for the right hand, 5–8 for
// the left. A chord that starts while another is sounding takes the next voice.
function voices(placed: Placed[], staff: 1 | 2): Chord[] {
  const groups = new Map<string, Chord>();
  for (const p of placed.filter((x) => x.staff === staff)) {
    const k = `${p.onset}:${p.end}`;
    const c = groups.get(k) ?? { onset: p.onset, end: p.end, pitches: [], voice: 0, first: p.id };
    c.pitches.push(p.pitch);
    groups.set(k, c);
  }
  const chords = [...groups.values()].sort((a, b) => a.onset - b.onset || a.end - b.end);
  const ends: number[] = []; // per voice, where its last chord ends
  const base = staff === 1 ? 1 : 5;
  for (const c of chords) {
    c.pitches.sort((a, b) => a - b);
    let v = ends.findIndex((e) => e <= c.onset);
    if (v < 0) v = ends.length;
    if (v >= 4) throw new Error(`a fifth voice in the ${staff === 1 ? "right" : "left"} hand at note ${c.first}`);
    ends[v] = c.end;
    c.voice = base + v;
  }
  return chords;
}

export function chartToMusicXml(chart: Chart): string {
  const barLen = DIVISIONS * chart.beatsPerBar;
  if (!Number.isInteger(barLen)) throw new Error(`${chart.id}: a bar of ${chart.beatsPerBar} beats isn't a whole number of 16ths`);
  const { key, meter } = keyAndMeter(chart);
  const table = spellingFor(key);
  const placed = placeNotes(chart);
  const bars = Math.max(1, Math.ceil(Math.max(0, ...placed.map((p) => p.end)) / barLen));
  const staves: [1 | 2, Chord[]][] = [
    [1, voices(placed, 1)],
    [2, voices(placed, 2)],
  ];

  const note = (staff: number, voice: number, len: number, type: string, dot: boolean, body: string, ties = "", tied = "") =>
    `<note>${body}<duration>${len}</duration>${ties}<voice>${voice}</voice><type>${type}</type>${dot ? "<dot/>" : ""}<staff>${staff}</staff>${tied ? `<notations>${tied}</notations>` : ""}</note>`;
  const rests = (staff: number, voice: number, len: number) =>
    pieces(len).map(([d, type, dot]) => note(staff, voice, d, type, dot, "<rest/>")).join("");
  const forward = (staff: number, voice: number, len: number) => `<forward><duration>${len}</duration><voice>${voice}</voice><staff>${staff}</staff></forward>`;

  const measures: string[] = [];
  for (let b = 0; b < bars; b++) {
    const start = b * barLen;
    const stop = start + barLen;
    const parts: string[] = [];
    for (const [staff, chords] of staves) {
      const used = [...new Set(chords.map((c) => c.voice))].sort((x, y) => x - y);
      const first = staff === 1 ? 1 : 5;
      if (!used.includes(first)) used.unshift(first); // voice 1 of each staff fills every bar, if only with rests
      for (const v of used) {
        const here = chords.filter((c) => c.voice === v && c.end > start && c.onset < stop);
        if (v !== first && !here.length) continue;
        if (v === first && !here.length) {
          parts.push(`<note><rest measure="yes"/><duration>${barLen}</duration><voice>${v}</voice><staff>${staff}</staff></note>`);
          continue;
        }
        let at = start;
        let out = "";
        for (const c of here) {
          const from = Math.max(c.onset, start);
          const to = Math.min(c.end, stop);
          if (from > at) out += v === first ? rests(staff, v, from - at) : forward(staff, v, from - at);
          const ps = pieces(to - from);
          ps.forEach(([d, type, dot], i) => {
            const tiedIn = i > 0 || from > c.onset; // continues from the previous piece or bar
            const tiedOut = i < ps.length - 1 || to < c.end;
            const ties = `${tiedIn ? '<tie type="stop"/>' : ""}${tiedOut ? '<tie type="start"/>' : ""}`;
            const tied = `${tiedIn ? '<tied type="stop"/>' : ""}${tiedOut ? '<tied type="start"/>' : ""}`;
            c.pitches.forEach((p, j) => {
              const s = spell(p, table);
              const pitch = `<pitch><step>${s.step}</step>${s.alter ? `<alter>${s.alter}</alter>` : ""}<octave>${s.octave}</octave></pitch>`;
              out += note(staff, v, d, type, dot, `${j ? "<chord/>" : ""}${pitch}`, ties, tied);
            });
          });
          at = to;
        }
        if (at < stop) out += v === first ? rests(staff, v, stop - at) : forward(staff, v, stop - at);
        parts.push(out);
      }
    }
    const attributes =
      b === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>` +
          `<time><beats>${meter.beats}</beats><beat-type>${meter.beatType}</beat-type></time><staves>2</staves>` +
          `<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes>`
        : "";
    measures.push(`<measure number="${b + 1}">${attributes}${parts.join(`<backup><duration>${barLen}</duration></backup>`)}</measure>`);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<score-partwise version="4.0">` +
    `<work><work-title>${esc(chart.title)}</work-title></work>` +
    `<identification><creator type="composer">${esc(chart.composer)}</creator><encoding><software>Piano Arcade: generated from the chart</software></encoding></identification>` +
    `<part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>` +
    `<part id="P1">${measures.join("")}</part></score-partwise>`
  );
}
