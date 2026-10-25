// Wait mode's panel (spec: wait-mode), Learn in the UI since play-modes: its line on the start screen. The way in and
// out ("Learn it first", "Play it judged") is the play-modes ladder now. Core does the hold itself (index.ts).
import type { GamePlugin } from "../../contracts";
import { withMode } from "../play-modes/modes";
import { isWaitMode } from ".";

// Into Learn or back to Perform, keeping every other param.
export const modeUrl = (params: URLSearchParams, wait: boolean): string => `/play?${withMode(params, wait ? "learn" : "perform")}`;

export function waitMode(): GamePlugin {
  return {
    id: "wait-mode",
    startPanel: ({ params }) => (isWaitMode(params) ? <p style={{ opacity: 0.7, margin: 0 }}>Learn: the song waits for each note. Not scored.</p> : null),
  };
}
