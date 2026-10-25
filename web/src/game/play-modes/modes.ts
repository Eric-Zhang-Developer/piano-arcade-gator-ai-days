// Play modes (spec: play-modes): Learn, Flow and Perform, one ladder per song. The URLs don't change: mode=wait is
// Learn, mode=flow is Flow, and no mode is Perform. Pure, so it tests without a page.
import type { Rank } from "../../contracts";

export type PlayMode = "learn" | "flow" | "perform";
export const MODES: readonly PlayMode[] = ["learn", "flow", "perform"];
export const modeName: Record<PlayMode, string> = { learn: "Learn", flow: "Flow", perform: "Perform" };

export const playModeSettings = {
  graduateTempo: 85, // a steady Flow take at this held tempo or more is told to try Perform
  rankCapTempo: 90, // below this held tempo a Flow take ranks capRank at best (decision: play-modes-flow-rank)
  capRank: "B" as Rank,
};

// Any mode but wait and flow (none, or a typo) is Perform, as the judge already treats it.
export function playMode(params: URLSearchParams): PlayMode {
  const m = params.get("mode");
  return m === "wait" ? "learn" : m === "flow" ? "flow" : "perform";
}

// The same params in another mode; every other param is kept.
export function withMode(params: URLSearchParams, mode: PlayMode): URLSearchParams {
  const q = new URLSearchParams(params);
  if (mode === "perform") q.delete("mode");
  else q.set("mode", mode === "learn" ? "wait" : "flow");
  return q;
}

// A link into a mode: withMode, and under Flow no tempo, since Flow follows the player's own (decision:
// play-modes-tempo). Learn and Perform keep theirs.
export function inMode(params: URLSearchParams, mode: PlayMode): URLSearchParams {
  const q = withMode(params, mode);
  if (mode === "flow") q.delete("tempo");
  return q;
}

export const modeHref = (params: URLSearchParams, mode: PlayMode) => `/play?${inMode(params, mode)}`;

// The tempo a Flow take held: the median of ?tempo × the clock's rate at each hit, as a whole percent of the song's
// own BPM. null with no hits.
export function heldTempo(rates: readonly number[], tempo = 1): number | null {
  if (!rates.length) return null;
  const s = [...rates].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const median = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(median * tempo * 100);
}

const ORDER: Rank[] = ["S", "A", "B", "C", "D"];

// Flow's rank: below rankCapTempo held, no better than capRank. A take with no hits isn't capped (it's a D anyway).
export function flowRank(rank: Rank, held: number | null): Rank {
  const { rankCapTempo, capRank } = playModeSettings;
  if (held === null || held >= rankCapTempo) return rank;
  return ORDER.indexOf(rank) < ORDER.indexOf(capRank) ? capRank : rank;
}

export const graduates = (steadiness: string, held: number | null) => steadiness === "steady" && held !== null && held >= playModeSettings.graduateTempo;

// The ladder's furthest step per song, for the select. Storage that throws reads as none and saves nothing.
export const ladderKey = (song: string) => `pianoArcade.ladder.${song}`;

export function readLadder(storage: Pick<Storage, "getItem"> | null, song: string): PlayMode | null {
  try {
    const v = storage?.getItem(ladderKey(song));
    return MODES.includes(v as PlayMode) ? (v as PlayMode) : null;
  } catch {
    return null;
  }
}

// Reaching a step never lowers the furthest one.
export function reachLadder(storage: Pick<Storage, "getItem" | "setItem"> | null, song: string, mode: PlayMode): void {
  const was = readLadder(storage, song);
  if (was && MODES.indexOf(was) >= MODES.indexOf(mode)) return;
  try {
    storage?.setItem(ladderKey(song), mode);
  } catch {
    // blocked storage: the select just lights nothing
  }
}
