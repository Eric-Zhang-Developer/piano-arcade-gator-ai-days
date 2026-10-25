// Sheet XML (spec: sheet-xml): a chart as MusicXML 4.0 on a grand staff, built from strings with no dependency. The
// right hand on the treble staff, the left on the bass; bars, ties, chords, voices and a spelled key. Pure: the same
// chart gives the same string. placeNotes is what sheet-view uses to find a judged note's notehead.
import type { Chart, ChartNote } from "../../contracts";
import { shouldBeam } from "../sheet-beams";
import { estimateKey, spell, spellingFor, type Key } from "./key";
import { overrides, type Override } from "./overrides";

export const DIVISIONS = 24; // per quarter note: a 32nd is 3, a 16th 6, an eighth triplet 8

// The note values that print as one notehead: largest first, with whether it's dotted. Lengths a multiple of 3 print
// from the plain values; the rest are triplets (time-modification 3:2), one beat or less.
const PLAIN: [number, string, boolean][] = [
  [96, "whole", false],
  [72, "half", true],
  [48, "half", false],
  [36, "quarter", true],
  [24, "quarter", false],
  [18, "eighth", true],
  [12, "eighth", false],
  [6, "16th", false],
  [3, "32nd", false],
];
const TRIPLET: [number, string, boolean][] = [
  [16, "quarter", false],
  [8, "eighth", false],
  [4, "16th", false],
];
export type Piece = [len: number, type: string, dot: boolean, triplet: boolean];
// A span [from, to) as printable values. A length of whole 32nds prints largest first (5 16ths: a quarter and a 16th).
// Anything else involves a triplet, so it splits at the beats first and each beat's part prints as triplets.
function pieces(from: number, to: number): Piece[] {
  const greedy = (len: number, values: [number, string, boolean][], triplet: boolean): Piece[] => {
    const out: Piece[] = [];
    for (const [d, type, dot] of values)
      while (len >= d) {
        out.push([d, type, dot, triplet]);
        len -= d;
      }
    if (len) throw new Error(`a length of ${len}/${DIVISIONS} of a beat doesn't print`);
    return out;
  };
  const len = to - from;
  if (len % 3 === 0) return greedy(len, PLAIN, false);
  const out: Piece[] = [];
  for (let at = from; at < to; ) {
    const next = Math.min(to, (Math.floor(at / DIVISIONS) + 1) * DIVISIONS);
    const part = next - at;
    out.push(...(part % 3 === 0 ? greedy(part, PLAIN, false) : greedy(part, TRIPLET, true)));
    at = next;
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

// `song` is the whole chart the key comes from: /play's transforms (one hand, a loop) keep the id but not every note,
// and a key estimated from part of a song can be wrong (Für Elise's right hand alone reads as E minor).
export function keyAndMeter(chart: Chart, song: Chart = chart): { key: Key; meter: Meter } {
  const o: Override = overrides[song.id] ?? {};
  const est = estimateKey(song);
  const key: Key = { fifths: o.fifths ?? est.fifths, mode: o.mode ?? est.mode };
  return { key, meter: meterOf(chart) };
}

// The printed meter: the table's, else meterFor's rule. A table meter that isn't beatsPerBar throws.
function meterOf(chart: Chart): Meter {
  const o: Override = overrides[chart.id] ?? {};
  const rule = meterFor(chart.beatsPerBar);
  const meter = { beats: o.beats ?? rule.beats, beatType: o.beatType ?? rule.beatType };
  if ((4 * meter.beats) / meter.beatType !== chart.beatsPerBar)
    throw new Error(`${chart.id}: the table's ${meter.beats}/${meter.beatType} isn't beatsPerBar ${chart.beatsPerBar}`);
  return meter;
}
const compound = (m: Meter) => m.beatType === 8 && m.beats % 3 === 0;

// A pickup's length in beats (sheet-pickups): the song's first note's beat short of a bar, when the table says the
// source opens with one and that note falls inside bar 1 after beat 0. 0 when `chart` (a hand, a loop) has a note
// before it. A length that isn't a whole number of 16ths throws, as a bar does.
export function pickupBeats(chart: Chart, song: Chart = chart): number {
  if (!overrides[song.id]?.pickup || !song.notes.length) return 0;
  const first = Math.min(...song.notes.map((n) => n.beat));
  if (first <= 0 || first >= chart.beatsPerBar || chart.notes.some((n) => n.beat < first)) return 0;
  const beats = chart.beatsPerBar - first;
  if (!Number.isInteger(beats * DIVISIONS)) throw new Error(`${chart.id}: a pickup of ${beats} beats isn't a whole number of 16ths`);
  return beats;
}

export interface Placed {
  id: string;
  staff: 1 | 2; // 1 treble (right hand), 2 bass (left hand)
  onset: number; // divisions from beat 0, on the display grid
  end: number;
  pitch: number; // as played, also under an 8va
}

// How far an onset may sit off a grid, in beats, and still print on it (decision sheet-engraving-quantize).
const TOLERANCE = 0.06;
const GRIDS = [12, 8, 6, 4, 3]; // eighths, eighth triplets, 16ths, 16th sextuplets, 32nds: the coarsest that fits wins
// 32nds fit only on the converter's own 1/8-beat grid: within 0.06, a 16th-and-triplet beat (1/3 is 0.042 from 3/8)
// would print as 32nds instead of snapping to the nearer of 16th and triplet.
const tolerance = (g: number) => (g === 3 ? 1 / 48 : TOLERANCE);

// The display grid: per staff and beat, the coarsest grid every onset in that beat sits within TOLERANCE of. A beat
// that fits none (a 16th melody over triplets) snaps each onset to the nearer of the 16th and eighth-triplet grids.
// Compound meters (6/8, 9/8, 12/8) count in eighths already, so they get no triplets.
function snapper(notes: ChartNote[], triplets: boolean) {
  const grids = GRIDS.filter((g) => triplets || g % 3 === 0);
  const mixed = grids.filter((g) => g === 6 || g === 8); // a beat that fits no grid
  const beatOf = (t: number) => Math.floor(t + TOLERANCE);
  const fits = (rel: number[], g: number, tol = tolerance(g)) => rel.every((r) => Math.abs(r * DIVISIONS - g * Math.round((r * DIVISIONS) / g)) <= tol * DIVISIONS);
  // A grid the beat sits on exactly beats a coarser one it's only near: 7/8 is a 32nd, not a sextuplet's 5/6.
  const pick = (rel: number[]) => grids.find((g) => fits(rel, g, 1e-6)) ?? grids.find((g) => fits(rel, g));
  const at = new Map<string, number[]>(); // staff:beat -> onsets relative to the beat
  for (const n of notes) {
    const k = `${n.hand}:${beatOf(n.beat)}`;
    at.set(k, [...(at.get(k) ?? []), n.beat - beatOf(n.beat)]);
  }
  const grid = new Map([...at].map(([k, rel]) => [k, pick(rel) ?? 0]));
  // A time on its beat's grid. An end in a beat with no onsets takes the coarsest grid it fits itself.
  return (hand: string, t: number): { at: number; step: number } => {
    const k = beatOf(t);
    const r = (t - k) * DIVISIONS;
    const g = grid.get(`${hand}:${k}`) ?? pick([t - k]) ?? 0;
    const near = (g: number) => g * Math.round(r / g);
    const snapped = g ? near(g) : mixed.map(near).reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a));
    return { at: k * DIVISIONS + snapped, step: g || DIVISIONS / 4 };
  };
}

// Each note's staff, and its onset and end on the display grid; a note keeps at least one step of its grid. Only the
// drawn rhythm snaps: the chart's own times (play, judging) are untouched.
export function placeNotes(chart: Chart): Placed[] {
  const snap = snapper(chart.notes, !compound(meterOf(chart)));
  return chart.notes.map((n: ChartNote) => {
    const on = snap(n.hand, n.beat);
    const end = Math.max(on.at + on.step, snap(n.hand, n.beat + n.duration).at);
    return { id: n.id, staff: n.hand === "L" ? 2 : 1, onset: on.at, end, pitch: n.pitch };
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
// the left. A chord that starts while another is sounding takes the next voice. Of chords that start together, the
// higher takes the lower voice number, so a melody over an accompaniment gets voice 1 and its stems up.
function voices(placed: Placed[], staff: 1 | 2): Chord[] {
  const groups = new Map<string, Chord>();
  for (const p of placed.filter((x) => x.staff === staff)) {
    const k = `${p.onset}:${p.end}`;
    const c = groups.get(k) ?? { onset: p.onset, end: p.end, pitches: [], voice: 0, first: p.id };
    c.pitches.push(p.pitch);
    groups.set(k, c);
  }
  const top = (c: Chord) => Math.max(...c.pitches);
  const chords = [...groups.values()].sort((a, b) => a.onset - b.onset || top(b) - top(a) || a.end - b.end);
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

// Where a staff changes clef or goes under an 8va or 8vb, bar by bar, from the median pitch of the notes that start in
// the bar (decision sheet-engraving-clefs). Each switch has a gap between its on and off pitch, so one stray note or
// a bar near the edge doesn't flip it back and forth; a bar with no notes keeps the last bar's.
export interface BarPlan {
  clef: "G" | "F";
  shift: -1 | 0 | 1; // +1 an 8va (printed an octave down), -1 an 8vb
}
const CLEF = {
  1: { home: "G", away: "F", leave: (m: number) => m <= 53, back: (m: number) => m >= 60 }, // treble down to bass at F3
  2: { home: "F", away: "G", leave: (m: number) => m >= 67, back: (m: number) => m <= 59 }, // bass up to treble at G4
} as const;
const SHIFT = {
  G: { on: (m: number) => m >= 88, off: (m: number) => m <= 84, shift: 1 }, // 8va from E6, 3 ledger lines over treble
  F: { on: (m: number) => m <= 33, off: (m: number) => m >= 36, shift: -1 }, // 8vb from A1, 3 under bass
} as const;
export function staffPlan(placed: Placed[], bars: number, barStart: (b: number) => number, barLen: number): Record<1 | 2, BarPlan[]> {
  const plan = { 1: [] as BarPlan[], 2: [] as BarPlan[] };
  for (const staff of [1, 2] as const) {
    const rule = CLEF[staff];
    let clef: "G" | "F" = rule.home;
    let shift: -1 | 0 | 1 = 0;
    for (let b = 0; b < bars; b++) {
      const ps = placed.filter((p) => p.staff === staff && p.onset >= barStart(b) && p.onset < (b + 1) * barLen).map((p) => p.pitch);
      if (ps.length) {
        ps.sort((x, y) => x - y);
        const m = ps[Math.floor(ps.length / 2)];
        if (clef === rule.home ? rule.leave(m) : rule.back(m)) {
          clef = clef === rule.home ? rule.away : rule.home;
          shift = 0;
        }
        const s = SHIFT[clef];
        if (shift ? s.off(m) : s.on(m)) shift = shift ? 0 : s.shift;
      }
      plan[staff].push({ clef, shift });
    }
  }
  return plan;
}

export function chartToMusicXml(chart: Chart, song: Chart = chart): string {
  const barLen = DIVISIONS * chart.beatsPerBar;
  if (!Number.isInteger(barLen)) throw new Error(`${chart.id}: a bar of ${chart.beatsPerBar} beats isn't a whole number of 16ths`);
  const { key, meter } = keyAndMeter(chart, song);
  const table = spellingFor(key);
  const placed = placeNotes(chart);
  // Each beamed chord's place in its beam (sheet-beams), by its first note's id. A beamable chord is one printed
  // value inside one beat group, so it's always one <note> per pitch. VexFlow draws the 16th lines itself.
  const onsetOf = new Map(placed.map((p) => [p.id, p.onset]));
  const beamAt = new Map<string, "begin" | "continue" | "end">();
  for (const ids of shouldBeam(placed, meter)) {
    const onsets = [...new Set(ids.map((id) => onsetOf.get(id)))];
    for (const id of ids) {
      const i = onsets.indexOf(onsetOf.get(id));
      beamAt.set(id, i === 0 ? "begin" : i === onsets.length - 1 ? "end" : "continue");
    }
  }
  const bars = Math.max(1, Math.ceil(Math.max(0, ...placed.map((p) => p.end)) / barLen));
  const pickup = pickupBeats(chart, song) * DIVISIONS; // bar 0 is only the padded first bar's last `pickup` divisions
  const staves: [1 | 2, Chord[]][] = [
    [1, voices(placed, 1)],
    [2, voices(placed, 2)],
  ];

  const plan = staffPlan(placed, bars, (b) => (b === 0 && pickup ? barLen - pickup : b * barLen), barLen);

  // One printed value: a note (body is its pitch, with <chord/> after the first), or a rest. A triplet carries its 3:2
  // and, on the first and last of its beat, the tuplet's start and stop.
  const note = (staff: number, voice: number, [len, type, dot, triplet]: Piece, body: string, ties = "", notations = "", beam = "") =>
    `<note>${body}<duration>${len}</duration>${ties}<voice>${voice}</voice><type>${type}</type>${dot ? "<dot/>" : ""}` +
    `${triplet ? "<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>" : ""}` +
    `<staff>${staff}</staff>${beam ? `<beam number="1">${beam}</beam>` : ""}${notations ? `<notations>${notations}</notations>` : ""}</note>`;
  const forward = (staff: number, voice: number, len: number) => `<forward><duration>${len}</duration><voice>${voice}</voice><staff>${staff}</staff></forward>`;
  // A tuplet mark per item: start on a group's first triplet, stop on its last (both on a lone one). A group is a beat,
  // or half a beat for triplet 16ths, so a sextuplet prints as two 3s.
  const tuplets = (items: { at: number; piece?: Piece }[]) => {
    const marks = items.map(() => "");
    const beats = new Map<string, number[]>();
    items.forEach((it, i) => {
      if (!it.piece?.[3]) return;
      const k = it.piece[0] === DIVISIONS / 6 ? `16:${Math.floor(it.at / (DIVISIONS / 2))}` : `8:${Math.floor(it.at / DIVISIONS)}`;
      beats.set(k, [...(beats.get(k) ?? []), i]);
    });
    for (const is of beats.values()) {
      marks[is[0]] += '<tuplet type="start"/>';
      marks[is[is.length - 1]] += '<tuplet type="stop"/>';
    }
    return marks;
  };

  const measures: string[] = [];
  for (let b = 0; b < bars; b++) {
    const start = b === 0 && pickup ? barLen - pickup : b * barLen;
    const stop = (b + 1) * barLen;
    const len = stop - start;
    const parts: string[] = [];
    for (const [staff, chords] of staves) {
      const used = [...new Set(chords.map((c) => c.voice))].sort((x, y) => x - y);
      const first = staff === 1 ? 1 : 5;
      if (!used.includes(first)) used.unshift(first); // voice 1 of each staff fills every bar, if only with rests
      const { shift } = plan[staff][b];
      const prev = plan[staff][b - 1]?.shift ?? 0;
      const next = plan[staff][b + 1]?.shift ?? 0;
      // An 8va (shift +1) prints its notes an octave down: MusicXML's "down", on the true pitch the notes still carry.
      const octave = (type: string) => `<direction placement="${shift > 0 ? "above" : "below"}"><direction-type><octave-shift type="${type}" size="8"/></direction-type><staff>${staff}</staff></direction>`;
      for (const v of used) {
        const here = chords.filter((c) => c.voice === v && c.end > start && c.onset < stop);
        if (v !== first && !here.length) continue;
        let out = v === first && shift && shift !== prev ? octave(shift > 0 ? "down" : "up") : "";
        if (v === first && !here.length) {
          out += `<note><rest measure="yes"/><duration>${len}</duration><voice>${v}</voice><staff>${staff}</staff></note>`;
        } else {
          // The voice as a run of items in time order: gaps (rests in voice 1, forwards in the others) and pieces.
          const items: { at: number; piece?: Piece; xml: (mark: string) => string }[] = [];
          const gap = (from: number, to: number) => {
            if (v !== first) return items.push({ at: from, xml: () => forward(staff, v, to - from) });
            let at = from;
            for (const piece of pieces(from, to)) {
              items.push({ at, piece, xml: (mark) => note(staff, v, piece, "<rest/>", "", mark) });
              at += piece[0];
            }
          };
          let at = start;
          for (const c of here) {
            const from = Math.max(c.onset, start);
            const to = Math.min(c.end, stop);
            if (from > at) gap(at, from);
            const ps = pieces(from, to);
            let pos = from;
            ps.forEach((piece, i) => {
              const tiedIn = i > 0 || from > c.onset; // continues from the previous piece or bar
              const tiedOut = i < ps.length - 1 || to < c.end;
              const ties = `${tiedIn ? '<tie type="stop"/>' : ""}${tiedOut ? '<tie type="start"/>' : ""}`;
              const tied = `${tiedIn ? '<tied type="stop"/>' : ""}${tiedOut ? '<tied type="start"/>' : ""}`;
              items.push({
                at: pos,
                piece,
                xml: (mark) =>
                  c.pitches
                    .map((p, j) => {
                      const s = spell(p, table);
                      const pitch = `<pitch><step>${s.step}</step>${s.alter ? `<alter>${s.alter}</alter>` : ""}<octave>${s.octave}</octave></pitch>`;
                      return note(staff, v, piece, `${j ? "<chord/>" : ""}${pitch}`, ties, tied + (j ? "" : mark), j ? "" : (beamAt.get(c.first) ?? ""));
                    })
                    .join(""),
              });
              pos += piece[0];
            });
            at = to;
          }
          if (at < stop) gap(at, stop);
          const marks = tuplets(items);
          out += items.map((it, i) => it.xml(marks[i])).join("");
        }
        if (v === first && shift && shift !== next) out += octave("stop");
        parts.push(out);
      }
    }
    // Bar 1 writes the key, the meter and both clefs; a later bar writes a staff's clef only when it changes.
    const clefs = ([1, 2] as const)
      .filter((st) => b === 0 || plan[st][b].clef !== plan[st][b - 1].clef)
      .map((st) => `<clef number="${st}">${plan[st][b].clef === "G" ? "<sign>G</sign><line>2</line>" : "<sign>F</sign><line>4</line>"}</clef>`)
      .join("");
    const attributes =
      b === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>` +
          `<time><beats>${meter.beats}</beats><beat-type>${meter.beatType}</beat-type></time><staves>2</staves>${clefs}</attributes>`
        : clefs
          ? `<attributes>${clefs}</attributes>`
          : "";
    const head = pickup && !b ? `<measure number="0" implicit="yes">` : `<measure number="${pickup ? b : b + 1}">`;
    measures.push(`${head}${attributes}${parts.join(`<backup><duration>${len}</duration></backup>`)}</measure>`);
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
