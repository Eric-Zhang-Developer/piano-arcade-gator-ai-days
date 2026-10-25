// Eric's verdicts on the On trial gallery (spec: lab-gallery): kept in this browser's localStorage under one key, and
// handed to the planner as plain text by "Copy verdicts". Nothing here writes files, the database or a request; the
// prune rule (experiments spec, item 7) acts on the pasted text through PRs.
import type { Experiment } from "..";

export const VERDICTS_KEY = "pianoArcade.labVerdicts";

export type Verdict = { v: "keep" | "cut" } | { v: "note"; note: string };
export type Verdicts = Record<string, Verdict>;

type Store = Pick<Storage, "getItem" | "setItem">;

// Storage blocked, full or holding junk: no verdicts, and the page still works.
export function readVerdicts(store: Pick<Store, "getItem"> | undefined): Verdicts {
  try {
    const v = JSON.parse(store?.getItem(VERDICTS_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Verdicts) : {};
  } catch {
    return {};
  }
}

export function writeVerdicts(store: Store | undefined, v: Verdicts): void {
  try {
    store?.setItem(VERDICTS_KEY, JSON.stringify(v));
  } catch {
    // blocked or full: this visit keeps them in memory
  }
}

// The stamp on a card.
export const stamp = (v: Verdict | undefined): string | null => (!v ? null : v.v === "cut" ? "CUT" : v.v === "note" ? "KEPT*" : "KEPT");

const said = (v: Verdict): string => (v.v === "note" ? `keep — ${v.note.trim()}`.replace(/ — $/, "") : v.v);

// The block Eric pastes to the planner: a dated header, then one line per verdict in registry order, then the rest as
// "no verdict".
export function verdictText(list: Pick<Experiment, "name" | "issue">[], v: Verdicts, date: Date): string {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  const who = (x: Pick<Experiment, "name" | "issue">) => (x.issue ? `${x.name} (#${x.issue})` : x.name);
  const done = list.filter((x) => v[x.name]).map((x) => `${who(x)}: ${said(v[x.name])}`);
  const rest = list.filter((x) => !v[x.name]).map((x) => `${who(x)}: no verdict`);
  return [`Lab verdicts, ${day}`, ...done, ...rest].join("\n");
}
