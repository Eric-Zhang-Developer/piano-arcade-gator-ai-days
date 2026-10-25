// The three palettes hand-palette compares (spec: hand-palette, #1127). How B and C were solved, and every number
// behind them, is in specs/decisions/hand-palette-candidates.md; the table test recomputes those numbers from here.
import { bg, gold, good, handL, handR, miss, wrong } from "../../ui-tokens";
import { deltaE, visions } from "./color";

export type Slot = "R" | "L" | "PERFECT" | "GREAT" | "GOOD" | "MISS" | "WRONG" | "AMBER";
export type Palette = Record<Slot, string>;
export type CandidateId = "A" | "B" | "C";

export interface Candidate {
  id: CandidateId;
  name: string;
  palette: Palette;
}

// Fever's amber today: the gauge's fill (meterSettings.fill). juice's fever glow is a second amber, rgb(255, 140, 60).
const AMBER = "#ffb02e";
const JUICE_AMBER = "#ff8c3c";
// GREAT has no token today: the HUD's counter is this mint, the highway's word is handR. B and C make the mint its own.
const MINT = "#5ef2c4";

export const candidates: Record<CandidateId, Candidate> = {
  A: {
    id: "A",
    name: "Today, plus the shape",
    palette: { R: handR, L: handL, PERFECT: gold, GREAT: MINT, GOOD: good, MISS: miss, WRONG: wrong, AMBER },
  },
  B: {
    id: "B",
    name: "Blue and orange",
    // Okabe–Ito's pairing: the left hand takes the orange, so fever leaves amber for the kit's hype magenta.
    palette: { R: handR, L: "#e6870a", PERFECT: gold, GREAT: MINT, GOOD: good, MISS: miss, WRONG: wrong, AMBER: "#ff2fd0" },
  },
  C: {
    id: "C",
    name: "Blue and rose",
    // The left hand turns rose, which keeps fever's amber and PERFECT's gold to themselves.
    palette: { R: handR, L: "#f34fc2", PERFECT: gold, GREAT: MINT, GOOD: good, MISS: miss, WRONG: wrong, AMBER },
  },
};

// Today's other two values, which the table measures beside A: the highway's GREAT word and juice's fever glow.
export const today = { highwayGreat: handR, juiceAmber: JUICE_AMBER };

// What the notes are drawn on (WCAG 1.4.11 asks 3:1 of each fill against it).
export const field = bg;

export const candidateOf = (p: string | null): Candidate => candidates[(p ?? "A").toUpperCase() as CandidateId] ?? candidates.A;

// The spec's ΔE00 table: the hand pair, every judgment pair, and each of those against fever's amber, under every
// vision. Targets: the hands 10 under all four; the rest 10 normal and 8 under a deficiency.
export const judgments = ["PERFECT", "GREAT", "GOOD", "MISS", "WRONG"] as const;
export interface Row {
  a: string;
  b: string;
  kind: "hand" | "judgment" | "amber";
  d: number[]; // in visions' order
  need: number[];
}

export function table(p: Record<string, string>): Row[] {
  const pairs: [string, string, Row["kind"]][] = [["R", "L", "hand"]];
  judgments.forEach((a, i) => judgments.slice(i + 1).forEach((b) => pairs.push([a, b, "judgment"])));
  for (const k of ["R", "L", ...judgments]) pairs.push([k, "AMBER", "amber"]);
  return pairs.map(([a, b, kind]) => ({
    a,
    b,
    kind,
    d: visions.map((v) => deltaE(p[a], p[b], v)),
    need: kind === "hand" ? [10, 10, 10, 10] : [10, 8, 8, 8],
  }));
}

export const passes = (r: Row): boolean => r.d.every((x, i) => x >= r.need[i]);
