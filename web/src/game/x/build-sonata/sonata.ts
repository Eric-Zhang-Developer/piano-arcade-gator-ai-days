// The Build Sonata (spec: build-sonata, #1162): the night the agents built Étude, one note per merged PR. Pure: the
// snapshot's shape, the subject parsing, lanes and the scrub that make-sonata.mjs applies, and the mapping from a
// snapshot to a chart and its pedal. Choices this file makes are logged in specs/decisions/build-sonata-mapping.md.
import type { Chart, ChartNote } from "../../../contracts";

export type Lane = "game" | "backend" | "learning" | "bell";

export interface SonataCommit {
  hash: string;
  time: string; // ISO, the commit's time on main
  type: string; // Conventional Commits type, or "other"
  scope: string | null;
  pr: number;
  lines: number; // added + removed, from --numstat
  lane: Lane;
  subject: string; // scrubbed
}

export interface Snapshot {
  generatedAt: string;
  count: number;
  from: string;
  to: string;
  commits: SonataCommit[]; // oldest first
  red: { number: number; from: string; to: string | null }[] | null; // main-red issues; null: gh couldn't read them
}

// "feat(build-sonata): the DGX plays (#1162)" → its type, scope and PR. The night's first PRs were merge commits,
// "Merge pull request #9 from <owner>/plan-game-lane": the PR, and the type its branch name starts with, if any.
// No PR number: not a merged PR, no note.
const TYPES = /^(feat|fix|plan|contract|docs|chore|refactor|perf|test|style|revert)[-/]/;
export function parseSubject(s: string): { type: string; scope: string | null; pr: number } | null {
  const merge = s.match(/^Merge pull request #(\d+) from [^/\s]+\/(\S+)/);
  if (merge) return { type: merge[2].match(TYPES)?.[1] ?? "other", scope: null, pr: Number(merge[1]) };
  const pr = s.match(/\(#(\d+)\)\s*$/);
  if (!pr) return null;
  const cc = s.match(/^([a-z]+)(?:\(([^)]+)\))?!?:/);
  return { type: cc ? cc[1] : "other", scope: cc?.[2] ?? null, pr: Number(pr[1]) };
}

// AGENTS.md's Lanes table: each lane's folders. A path in none is the game's (it owns the tooling the night ran on).
const LANE_PATHS: [Lane, string[]][] = [
  ["backend", ["supabase/", "web/src/data/", "web/src/app/api/takes/", "web/src/app/api/progress/", "web/src/app/progress/", "web/src/app/auth/", "firmware/"]],
  ["learning", ["web/src/learn/", "tools/"]],
  ["game", ["web/src/game/"]],
];
const PERSON_LANE: Record<string, Lane> = { eric: "game", sharan: "backend" };
const BELL = new Set(["plan", "contract", "docs"]);

// A commit's lane: plan, contract and docs ring the bell; a scoped commit takes its spec's assignee's lane (the person
// before the first "-"); anything else goes by the most paths it changed.
export function laneOf(type: string, scope: string | null, paths: string[], assignees: Record<string, string>): Lane {
  if (BELL.has(type)) return "bell";
  const person = scope ? (assignees[scope] ?? "").split("-")[0] : "";
  if (PERSON_LANE[person]) return PERSON_LANE[person];
  const votes = new Map<Lane, number>();
  for (const p of paths) {
    const lane = LANE_PATHS.find(([, dirs]) => dirs.some((d) => p.startsWith(d)))?.[0];
    if (lane) votes.set(lane, (votes.get(lane) ?? 0) + 1);
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "game";
}

// Names and handles become the lane's name, and anything shaped like an email too: the sonata stores no person.
export const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
export function scrub(text: string, names: string[], lane: Lane): string {
  // A merge commit's branch path can hold anyone's handle, listed or not: only its last segment stays.
  let out = text.replace(/(Merge pull request #\d+ from )[^\s,]*\/([^/\s,]+)/, `$1${lane}/$2`).replace(EMAIL, lane);
  // Longest first, so a handle goes whole before the name inside it.
  for (const n of [...names].sort((a, b) => b.length - a.length))
    out = out.replace(new RegExp(`@?\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), lane);
  return out;
}

// The music. 120 bpm in 4/4: about 90 s is 180 beats, 45 bars.
export const BPM = 120;
export const BEATS = 176; // where the last commit lands, before its final chord rings
const GRID = 0.25; // onsets on sixteenths; a hand plays one note per slot
const ACTIVITY = 0.75; // the warp: 75% by commit count (busy hours get room), 25% by the clock
export const VELOCITY_CAP = 110;
export const VOICES = 4; // a hand's voices on the sheet (sheet-xml's limit)

// I–V–vi–IV in C, a chord a bar; red main is vi; the end is V–I.
type Chord = "I" | "V" | "vi" | "IV";
const PROGRESSION: Chord[] = ["I", "V", "vi", "IV"];
export const CHORD_TONES: Record<Chord, number[]> = { I: [0, 4, 7], V: [7, 11, 2], vi: [9, 0, 4], IV: [5, 9, 0] };
const SCALE = [0, 2, 4, 5, 7, 9, 11];
export const REGISTER: Record<Lane, [number, number]> = { game: [72, 88], bell: [96, 108], learning: [55, 69], backend: [36, 52] };
export const HAND: Record<Lane, "R" | "L"> = { game: "R", bell: "R", learning: "L", backend: "L" };

const tonesIn = (chord: Chord, [lo, hi]: [number, number]) => {
  const out: number[] = [];
  for (let p = lo; p <= hi; p++) if (CHORD_TONES[chord].includes(p % 12)) out.push(p);
  return out;
};

export interface SonataNote extends ChartNote {
  hash: string;
  lane: Lane;
  chord: Chord;
  kind: "chord" | "pass" | "resolve";
  red: boolean;
  time: string;
  subject: string;
  pr: number;
}

export function velocityOf(lines: number): number {
  return Math.max(1, Math.min(VELOCITY_CAP, Math.round(40 + 7 * Math.log2(1 + lines))));
}

const isRed = (t: number, red: Snapshot["red"], end: number) =>
  (red ?? []).some((r) => t >= Date.parse(r.from) && t < (r.to ? Date.parse(r.to) : end + 1));

export function buildSonata(snap: Snapshot): { chart: Chart; pedal: [number, number][]; notes: SonataNote[] } {
  const c = snap.commits;
  const t = c.map((x) => Date.parse(x.time));
  const [t0, t1] = [t[0], t[t.length - 1]];
  const n = c.length;
  // The warp, quantized; a hand that already has a note in a slot pushes the next one along.
  const taken = { R: new Set<number>(), L: new Set<number>() };
  const slots = c.map((x, i) => {
    const pos = BEATS * (ACTIVITY * (n > 1 ? i / (n - 1) : 0) + (1 - ACTIVITY) * (t1 > t0 ? (t[i] - t0) / (t1 - t0) : 0));
    const hand = HAND[x.lane];
    let s = Math.floor(pos / GRID);
    while (taken[hand].has(s)) s++;
    taken[hand].add(s);
    return s;
  });
  const lastBar = Math.floor((Math.max(...slots) * GRID) / 4);
  const walk: Record<Lane, { i: number; dir: number; last: number | null }> = {
    game: { i: 0, dir: 1, last: null }, bell: { i: 0, dir: 1, last: null }, learning: { i: 0, dir: 1, last: null }, backend: { i: 0, dir: 1, last: null },
  };
  // Ids are short hashes, as long as it takes to keep them unique (7 characters, as git shows them).
  let idLen = 7;
  while (idLen < 40 && new Set(c.map((x) => x.hash.slice(0, idLen))).size < n) idLen++;
  let wasRed = false;
  const notes: SonataNote[] = c.map((x, i) => {
    const beat = slots[i] * GRID;
    const bar = Math.floor(beat / 4);
    const red = isRed(t[i], snap.red, t1);
    const resolving = wasRed && !red;
    wasRed = red;
    const cadence = bar >= lastBar - 1;
    const chord: Chord = cadence ? (bar === lastBar ? "I" : "V") : resolving ? "I" : red ? "vi" : PROGRESSION[bar % 4];
    const tones = tonesIn(chord, REGISTER[x.lane]);
    const w = walk[x.lane];
    let pitch: number;
    if (x.type === "revert" && w.last !== null) pitch = [...tones].reverse().find((p) => p < w.last!) ?? tones[0]; // falls
    else {
      w.i += w.dir;
      if (w.i >= tones.length - 1 || w.i <= 0) w.dir = -w.dir;
      pitch = tones[Math.max(0, Math.min(tones.length - 1, w.i))];
    }
    if (resolving || (cadence && i === n - 1)) pitch = tones.find((p) => p % 12 === 0) ?? pitch; // home on C
    // A fix is a short passing tone: the nearest scale step off its chord tone that isn't in the chord, inside the
    // lane's register, so no two lanes ever share a pitch.
    const [lo, hi] = REGISTER[x.lane];
    const step = [1, 2, -1, -2].map((d) => pitch + d).find((p) => p >= lo && p <= hi && SCALE.includes(p % 12) && !CHORD_TONES[chord].includes(p % 12));
    const pass = x.type === "fix" && !resolving && !cadence && step !== undefined;
    if (pass) pitch = step!;
    w.last = pitch;
    const kind = resolving ? "resolve" : pass ? "pass" : "chord";
    const duration = i === n - 1 ? 4 : x.type === "feat" ? 2 : pass ? GRID : 0.5;
    const id = x.hash.slice(0, idLen) + (kind === "chord" ? "" : `-${kind}`);
    return { id, pitch, beat, duration, hand: HAND[x.lane], velocity: velocityOf(x.lines), hash: x.hash, lane: x.lane, chord, kind, red, time: x.time, subject: x.subject, pr: x.pr };
  });
  notes.sort((a, b) => a.beat - b.beat || (a.hand === b.hand ? 0 : a.hand === "R" ? -1 : 1));
  // A long tone stops before the next strike of its pitch.
  for (let i = 0; i < notes.length; i++) {
    const next = notes.slice(i + 1).find((m) => m.pitch === notes[i].pitch);
    if (next) notes[i].duration = Math.min(notes[i].duration, next.beat - notes[i].beat);
  }
  // The sheet engraves at most 4 voices a hand (sheet-xml), and each note here has its own onset, so each sounding
  // note is a voice: one that would be a fifth cuts the soonest-ending one short at its start (#1330).
  for (const hand of ["R", "L"] as const) {
    const sounding: SonataNote[] = [];
    for (const m of notes.filter((x) => x.hand === hand)) {
      for (let j = sounding.length - 1; j >= 0; j--) if (sounding[j].beat + sounding[j].duration <= m.beat) sounding.splice(j, 1);
      if (sounding.length >= VOICES) {
        sounding.sort((a, b) => a.beat + a.duration - (b.beat + b.duration));
        const cut = sounding.shift()!;
        cut.duration = m.beat - cut.beat;
      }
      sounding.push(m);
    }
  }
  const end = Math.max(...notes.map((m) => m.beat + m.duration));
  const pedal: [number, number][] = [[(lastBar - 1) * 4 + 0.12, lastBar * 4 - 0.04], [lastBar * 4 + 0.12, end]];
  const chart: Chart = {
    id: "build-sonata",
    title: "The Build Sonata",
    composer: "The agents who built Étude",
    catalog: `${snap.count} merged PRs`,
    source: "This repository's git history on main, one note per merged PR (game/x/build-sonata/snapshot.json)",
    bpm: BPM,
    beatsPerBar: 4,
    notes: notes.map(({ id, pitch, beat, duration, hand, velocity }) => ({ id, pitch, beat, duration, hand, velocity })),
  };
  return { chart, pedal, notes };
}

// How many merged PRs have sounded by `beat`, and the real time (ET) of the last one: the HUD's counter and clock.
export function counterAt(notes: { beat: number }[], beat: number): number {
  let k = 0;
  for (const m of notes) if (m.beat <= beat) k++;
  return k;
}

export function clockAt(notes: { beat: number; time: string }[], beat: number): string {
  const last = [...notes].reverse().find((m) => m.beat <= beat) ?? notes[0];
  return etLabel(last.time);
}

export const etLabel = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" });
