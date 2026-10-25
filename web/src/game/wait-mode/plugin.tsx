// Wait mode's panels (spec: wait-mode): "Learn it first" on the start screen, "Play it judged" after a wait-mode take.
// Core does the hold itself (index.ts); these only move between the two modes, keeping every other param.
import type { GamePlugin } from "../../contracts";
import { kitButton } from "../duo-tokens";
import { isWaitMode } from ".";

export function modeUrl(params: URLSearchParams, wait: boolean): string {
  const q = new URLSearchParams(params);
  if (wait) q.set("mode", "wait");
  else q.delete("mode");
  return `/play?${q}`;
}

export function waitMode(): GamePlugin {
  return {
    id: "wait-mode",
    startPanel: ({ params }) =>
      isWaitMode(params) ? (
        <p style={{ opacity: 0.7, margin: 0 }}>Wait mode: the song waits for each note. Not scored.</p>
      ) : (
        <a data-testid="learn-first" href={modeUrl(params, true)} {...link}>
          Learn it first
        </a>
      ),
    resultsPanel: ({ params }) =>
      isWaitMode(params) ? (
        <a data-testid="play-judged" href={modeUrl(params, false)} {...link}>
          Play it judged
        </a>
      ) : null,
  };
}

const link = kitButton("secondary");
