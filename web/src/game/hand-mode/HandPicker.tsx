"use client";
// Right, Left or Both on the start screen. Each choice reloads /play with hands= set, so the judged chart is rebuilt.
import { kitChip } from "../duo-tokens";
import type { HandsSetting } from "./hands";

const CHOICES: [HandsSetting, string][] = [
  ["R", "Right hand"],
  ["L", "Left hand"],
  ["both", "Both"],
];

export function HandPicker({ current }: { current: HandsSetting }) {
  const pick = (h: HandsSetting) => {
    const url = new URL(window.location.href);
    if (h === "both") url.searchParams.delete("hands");
    else url.searchParams.set("hands", h);
    window.location.assign(url);
  };
  return (
    <div role="group" aria-label="Hands to play" data-testid="hand-picker" style={{ display: "flex", gap: 6 }}>
      {CHOICES.map(([h, label]) => (
        <button
          key={h}
          type="button"
          aria-pressed={current === h}
          onClick={() => current !== h && pick(h)}
          {...kitChip(current === h)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
