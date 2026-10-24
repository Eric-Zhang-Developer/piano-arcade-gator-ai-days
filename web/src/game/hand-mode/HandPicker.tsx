"use client";
// Right, Left or Both on the start screen. Each choice reloads /play with hands= set, so the judged chart is rebuilt.
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
    <div role="group" aria-label="Hands to play" data-testid="hand-picker" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {CHOICES.map(([h, label]) => (
        <button
          key={h}
          type="button"
          aria-pressed={current === h}
          onClick={() => current !== h && pick(h)}
          style={{
            padding: "6px 14px",
            fontSize: 15,
            borderRadius: 6,
            border: "1px solid rgba(242,242,245,0.3)",
            background: current === h ? "rgba(242,242,245,0.15)" : "transparent",
            color: "inherit",
            cursor: current === h ? "default" : "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
