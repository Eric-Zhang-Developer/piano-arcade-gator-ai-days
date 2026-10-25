// Rewind (spec: rewind): in wait mode, ← moves back a bar and → ahead one. /play does the moving (core-loop, wait-mode,
// wait-hud, wait-hint); this only says so on wait mode's start screen.
import type { CSSProperties } from "react";
import type { GamePlugin } from "../../contracts";
import { isWaitMode } from "../wait-mode";

export function rewind(): GamePlugin {
  return {
    id: "rewind",
    startPanel: ({ params }) =>
      isWaitMode(params) ? (
        <p data-testid="rewind-hint" style={{ opacity: 0.7, margin: 0 }}>
          <kbd style={key}>←</kbd> <kbd style={key}>→</kbd> back or ahead a bar
        </p>
      ) : null,
  };
}

// The help overlay's key chip (help-overlay.module.css .kbd): square, a cyan hairline on a faint cyan field.
const key: CSSProperties = {
  display: "inline-block",
  minWidth: "1.6em",
  padding: "0 0.35em",
  border: "1px solid rgb(39 225 255 / 0.55)",
  borderRadius: 0,
  background: "rgb(39 225 255 / 0.08)",
  color: "var(--pa-ink)",
  font: "inherit",
  fontWeight: 700,
  lineHeight: 1.4,
  textAlign: "center",
};
