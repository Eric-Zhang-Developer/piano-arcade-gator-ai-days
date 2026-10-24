"use client";
// Effects volume, mute and the miss cue, for /play's start screen. Saved in localStorage.
import { useState } from "react";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from "./index";

export function SfxControls() {
  const [p, setP] = useState<Prefs>(() => (typeof window === "undefined" ? DEFAULT_PREFS : loadPrefs()));
  const set = (next: Partial<Prefs>) => {
    const merged = { ...p, ...next };
    setP(merged);
    savePrefs(merged);
  };
  return (
    <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        Effects
        <input type="range" min={0} max={1} step={0.05} value={p.volume} disabled={p.muted} onChange={(e) => set({ volume: Number(e.target.value) })} />
        <output style={{ width: 40 }}>{Math.round(p.volume * 100)}%</output>
      </label>
      <label>
        <input type="checkbox" checked={p.muted} onChange={(e) => set({ muted: e.target.checked })} /> Mute
      </label>
      <label>
        <input type="checkbox" checked={p.missCue} onChange={(e) => set({ missCue: e.target.checked })} /> Miss sound
      </label>
    </div>
  );
}
