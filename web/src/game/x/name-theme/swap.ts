// The early swap (spec: name-theme): first in layers.ts, so the bot, the judge, Learn's wait mode, ghost and the
// labels all see the name's chart. /play loads the committed placeholder for song=x/name-theme; with a theme held,
// this hands the held chart on instead. No other hooks.
import type { GamePlugin } from "../../../contracts";
import { heldTheme, SONG } from "./memory";

export function nameThemeSwap(): GamePlugin {
  return {
    id: "name-theme-swap",
    transformChart: (c, params) => (params.get("song") === SONG && heldTheme() ? heldTheme()!.theme.chart : c),
  };
}
