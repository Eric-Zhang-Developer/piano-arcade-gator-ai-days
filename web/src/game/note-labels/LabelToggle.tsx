"use client";
// The start screen's labels button: each press cycles Auto, Notes, Keys and Off, and remembers the choice.
import { useState } from "react";
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
      style={{ padding: "6px 14px", fontSize: 15, borderRadius: 6, border: "1px solid rgba(242,242,245,0.3)", background: "transparent", color: "inherit", cursor: "pointer" }}
    >
      Labels: {NAMES[setting]}
    </button>
  );
}
