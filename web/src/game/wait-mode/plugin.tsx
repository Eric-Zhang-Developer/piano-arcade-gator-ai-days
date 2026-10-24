// Wait mode's panels (spec: wait-mode): "Learn it first" on the start screen, "Play it judged" after a wait-mode take.
// Core does the hold itself (index.ts); these only move between the two modes, keeping every other param.
import type { CSSProperties } from "react";
import type { GamePlugin } from "../../contracts";
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
        <a data-testid="learn-first" href={modeUrl(params, true)} style={link}>
          Learn it first
        </a>
      ),
    resultsPanel: ({ params }) =>
      isWaitMode(params) ? (
        <a data-testid="play-judged" href={modeUrl(params, false)} style={link}>
          Play it judged
        </a>
      ) : null,
  };
}

const link: CSSProperties = {
  display: "inline-block",
  padding: "8px 24px",
  fontSize: 16,
  borderRadius: 8,
  background: "#ddd",
  color: "#000",
  textDecoration: "none",
};
