"use client";
// Effects volume, mute and the miss cue, for /play's start screen. Saved in localStorage; the server renders the
// defaults, and the saved values replace them after hydration.
import { useSyncExternalStore } from "react";
import { DEFAULT_PREFS, getPrefs, savePrefs, subscribePrefs, type Prefs } from "./index";

export function SfxControls() {
  const p = useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
  const set = (next: Partial<Prefs>) => savePrefs({ ...p, ...next });
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
