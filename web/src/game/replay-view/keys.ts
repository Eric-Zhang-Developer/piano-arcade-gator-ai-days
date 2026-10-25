// Replay keys (spec: replay-keys, #419): /play fixes the take's keyboard from the chart as loaded, before any
// transformChart (static-keyboard), so a hands= or bar-loop take keeps the whole song's keys. The replay's results
// panel only gets the transformed chart, so this plugin, first in layers.ts, keeps the loaded chart's range for it.
import type { GamePlugin } from "../../contracts";
import { staticRange, type KeyRange } from "../core/range";

let keys: KeyRange | null = null;
export const takeKeys = () => keys;

export const replayKeys = (): GamePlugin => ({
  id: "replay-keys",
  transformChart: (c) => ((keys = staticRange(c)), c),
});
