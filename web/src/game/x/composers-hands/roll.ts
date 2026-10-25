// The Composer's Hands (spike: composers-hands, #1069): a piano roll's MIDI as notes in ms, its spool speed-up, the
// hand split, and the seconds chart the duet judges against. Pure, and only type imports, so match.mjs runs it in Node.
import type { Chart, Hand } from "../../../contracts";

export interface RollNote {
  pitch: number;
  onMs: number;
  offMs: number;
  velocity: number;
}

export interface Roll {
  notes: RollNote[]; // by onMs
  pedal: { atMs: number; down: boolean }[]; // CC64, where the roll has it
  dynamics: boolean; // false: every note-on had one velocity (a non-reproducing roll)
}

export const rollSettings = {
  fixedVelocity: 80, // a roll with no dynamics plays at this (hand-mode's default; specs/decisions/composers-hands-choices.md)
  chordMs: 30, // notes this close start together, for the hand split
  passageMs: 4000, // the hand split is chosen per passage of this length
  minSplit: 48, // the split stays within C3–C5; a passage with no chord there keeps the last split
  maxSplit: 72,
  spoolMin: 1e-6, // speed-ups under this per ms are left alone
};

// A standard MIDI file (format 0 or 1), every track merged, tempo changes applied.
export function parseMidi(bytes: Uint8Array): Roll {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const str = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (bytes.length < 14 || str(0) !== "MThd") throw new Error("not a MIDI file");
  const tracks = dv.getUint16(10);
  const division = dv.getUint16(12);
  if (division & 0x8000) throw new Error("SMPTE time division isn't supported");
  type Ev = { tick: number; order: number; kind: "on" | "off" | "tempo" | "pedal"; a: number; b: number };
  const events: Ev[] = [];
  let at = 8 + dv.getUint32(4);
  let order = 0;
  for (let t = 0; t < tracks && at + 8 <= bytes.length; t++) {
    const len = dv.getUint32(at + 4);
    const end = at + 8 + len;
    let p = at + 8;
    let tick = 0;
    let status = 0;
    const vlq = () => {
      let v = 0;
      for (;;) {
        const c = bytes[p++];
        v = (v << 7) | (c & 0x7f);
        if (!(c & 0x80)) return v;
      }
    };
    while (p < end) {
      tick += vlq();
      let s = bytes[p];
      if (s & 0x80) p++;
      else s = status; // running status
      if (s === 0xff) {
        const type = bytes[p++];
        const n = vlq();
        if (type === 0x51) events.push({ tick, order: order++, kind: "tempo", a: (bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2], b: 0 });
        p += n;
        continue;
      }
      if (s === 0xf0 || s === 0xf7) {
        p += vlq();
        continue;
      }
      status = s;
      const hi = s & 0xf0;
      const d1 = bytes[p++];
      const d2 = hi === 0xc0 || hi === 0xd0 ? 0 : bytes[p++];
      if (hi === 0x90 && d2 > 0) events.push({ tick, order: order++, kind: "on", a: d1, b: d2 });
      else if (hi === 0x80 || hi === 0x90) events.push({ tick, order: order++, kind: "off", a: d1, b: 0 });
      else if (hi === 0xb0 && d1 === 64) events.push({ tick, order: order++, kind: "pedal", a: d2, b: 0 });
    }
    at = end;
  }
  events.sort((x, y) => x.tick - y.tick || x.order - y.order);
  let usPerQ = 500000;
  let lastTick = 0;
  let ms = 0;
  const open = new Map<number, RollNote[]>();
  const notes: RollNote[] = [];
  const pedal: Roll["pedal"] = [];
  for (const e of events) {
    ms += ((e.tick - lastTick) * usPerQ) / division / 1000;
    lastTick = e.tick;
    if (e.kind === "tempo") usPerQ = e.a;
    else if (e.kind === "on") {
      const n = { pitch: e.a, onMs: ms, offMs: ms, velocity: e.b };
      notes.push(n);
      open.set(e.a, [...(open.get(e.a) ?? []), n]);
    } else if (e.kind === "off") {
      const n = open.get(e.a)?.shift(); // first on, first off
      if (n) n.offMs = ms;
    } else {
      const down = e.a >= 64;
      if (pedal[pedal.length - 1]?.down !== down) pedal.push({ atMs: ms, down });
    }
  }
  for (const n of notes) if (n.offMs <= n.onMs) n.offMs = n.onMs + 50; // a note never released: a short one
  const velocities = new Set(notes.map((n) => n.velocity));
  const dynamics = velocities.size > 1;
  if (!dynamics) for (const n of notes) n.velocity = rollSettings.fixedVelocity;
  return { notes: notes.sort((a, b) => a.onMs - b.onMs), pedal, dynamics };
}

// The take-up spool speeds a roll up as it fills: on a steady passage the gaps between notes shrink. With the roll's
// speed 1 + a·t (t in ms), 1/gap grows linearly in t, so a least-squares line of 1/gap on t gives a = slope/intercept.
// onsets: the start times (ms) of a passage the score writes in even notes.
export function spoolRate(onsets: number[]): number {
  const pts = onsets.slice(1).map((t, i) => ({ t: onsets[i], y: 1 / (t - onsets[i]) })).filter((q) => Number.isFinite(q.y) && q.y > 0);
  if (pts.length < 3) return 0;
  const n = pts.length;
  const mt = pts.reduce((s, q) => s + q.t, 0) / n;
  const my = pts.reduce((s, q) => s + q.y, 0) / n;
  const slope = pts.reduce((s, q) => s + (q.t - mt) * (q.y - my), 0) / pts.reduce((s, q) => s + (q.t - mt) ** 2, 0);
  const intercept = my - slope * mt;
  return intercept > 0 ? slope / intercept : 0;
}

// Undo a speed-up of rate a: a roll that ran at 1 + a·t took dt for what the player took (1 + a·t)·dt, so the
// player's time is t + a·t²/2.
export function unspool(roll: Roll, a: number): Roll {
  if (Math.abs(a) < rollSettings.spoolMin) return roll;
  const f = (t: number) => t + (a * t * t) / 2;
  return {
    ...roll,
    notes: roll.notes.map((n) => ({ ...n, onMs: f(n.onMs), offMs: f(n.offMs) })),
    pedal: roll.pedal.map((p) => ({ ...p, atMs: f(p.atMs) })),
  };
}

// The hands, inferred: rolls don't record them. Per passage, the widest pitch gap inside any chord (notes starting
// within chordMs) within C3–C5 splits left from right; a passage with no such chord keeps the last split. nudges[i]
// moves passage i's split by that many semitones (Eric's correction on the page).
export function splitPoints(notes: RollNote[], nudges: Record<number, number> = {}): number[] {
  const s = rollSettings;
  const count = notes.length ? Math.floor(notes[notes.length - 1].onMs / s.passageMs) + 1 : 0;
  const out: number[] = [];
  let last = 60;
  for (let i = 0; i < count; i++) {
    const inPassage = notes.filter((n) => Math.floor(n.onMs / s.passageMs) === i);
    let best = { gap: 0, at: last };
    for (let j = 0; j < inPassage.length; ) {
      let k = j;
      while (k < inPassage.length && inPassage[k].onMs - inPassage[j].onMs <= s.chordMs) k++;
      const chord = inPassage.slice(j, k).map((n) => n.pitch).sort((a, b) => a - b);
      for (let c = 1; c < chord.length; c++) {
        const gap = chord[c] - chord[c - 1];
        const at = (chord[c] + chord[c - 1]) / 2;
        if (gap > best.gap && at >= s.minSplit && at <= s.maxSplit) best = { gap, at };
      }
      j = k;
    }
    last = best.at;
    out.push(last + (nudges[i] ?? 0));
  }
  return out;
}

export function handOf(note: RollNote, splits: number[]): Hand {
  const split = splits[Math.floor(note.onMs / rollSettings.passageMs)] ?? 60;
  return note.pitch < split ? "L" : "R";
}

// The roll as a chart the core judge reads unchanged: bpm 60, so a beat is a second and noteTimeMs is the roll's own
// time; one bar the whole roll long, so no bar line draws. The frozen chart format doesn't change.
export function secondsChart(roll: Roll, splits: number[], meta: { id: string; title: string; composer: string; source: string }): Chart {
  const end = roll.notes.reduce((m, n) => Math.max(m, n.offMs), 0);
  return {
    ...meta,
    bpm: 60,
    beatsPerBar: Math.ceil(end / 1000) + 1,
    notes: roll.notes
      .filter((n) => n.pitch >= 21 && n.pitch <= 108)
      .map((n, i) => ({
        id: `r${i}`,
        pitch: n.pitch,
        beat: n.onMs / 1000,
        duration: Math.max(0.05, (n.offMs - n.onMs) / 1000),
        hand: handOf(n, splits),
        velocity: Math.min(127, Math.max(1, n.velocity)),
      })),
  };
}
