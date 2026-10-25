"use client";
// The start screen's labels button: each press cycles Auto, Notes, Keys and Off, and remembers the choice.
import { useState } from "react";
import { kitChip } from "../duo-tokens";
import { nextSetting, type LabelSetting } from "./labels";

const NAMES: Record<LabelSetting, string> = { auto: "Auto", notes: "Note names", keys: "Laptop keys", off: "Off" };

export function LabelToggle({ initial, onChange }: { initial: LabelSetting; onChange: (s: LabelSetting) => void }) {
  const [setting, setSetting] = useState(initial);
  return (
    <button
      type="button"
      data-testid="labels-toggle"
      onClick={() => {
        const next = nextSetting(setting);
        setSetting(next);
        onChange(next);
      }}
      {...kitChip(setting !== "off")}
    >
      Labels: {NAMES[setting]}
    </button>
  );
}
