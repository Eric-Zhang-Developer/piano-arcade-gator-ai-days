// "Next for you" (spec: duo-select): what duo-results saved after a real take, read back for the select. Anything
// missing, unreadable or malformed is no suggestion: the strip only ever shows a take's own bars.
import type { NextFor } from "../duo-results/scores";
import { nextForKey, practiceBarsUrl } from "../duo-results/scores";

export function readNextFor(storage: Pick<Storage, "getItem"> | null, songId: string): NextFor | null {
  try {
    const v = JSON.parse(storage?.getItem(nextForKey(songId)) ?? "null");
    const bar = (n: unknown) => Number.isInteger(n) && (n as number) >= 1;
    if (!v || v.song !== songId || !bar(v.from) || !bar(v.to) || v.to < v.from) return null;
    return { song: songId, from: v.from, to: v.to, hand: v.hand === "L" || v.hand === "R" ? v.hand : null };
  } catch {
    return null;
  }
}

export const nextForText = (n: NextFor) =>
  `Next for you: ${n.from === n.to ? `bar ${n.from}` : `bars ${n.from}–${n.to}`}${n.hand ? `, ${n.hand === "L" ? "left" : "right"} hand` : ""}`;

// PRACTICE BARS X–Y: duo-results' own bar-loop URL, so the results and the select open the same practice.
export const nextForUrl = (n: NextFor) => practiceBarsUrl(n.song, new URLSearchParams({ song: n.song }), n);
