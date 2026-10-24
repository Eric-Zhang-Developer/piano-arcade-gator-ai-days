"use client";
// Hands and Speed for the focused song (spec: song-options), under song-preview's row. Mount it keyed by song id:
// its key listener is that song's only.
import { useEffect, type CSSProperties } from "react";
import type { Chart } from "../../contracts";
import { defaults, hasBothHands, isPractice, keyOptions, setOptions, SPEEDS, useSongOptions, type SongOptions as Options } from "./options";

export { useSongOptions, withOptions, type OptionsBySong } from "./options";

const handLabels = { both: "BOTH", R: "RIGHT", L: "LEFT" } as const;

export function SongOptions({ id, chart }: { id: string; chart: Chart | null }) {
  const o = useSongOptions()[id] ?? defaults;
  const twoHands = !!chart && hasBothHands(chart);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("dialog, input, textarea")) return; // options-panel's drawer
      const next = keyOptions(o, e, twoHands);
      if (!next) return;
      e.preventDefault();
      setOptions(id, next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, o, twoHands]);

  const set = (next: Partial<Options>) => setOptions(id, { ...o, ...next });
  return (
    <div data-testid="song-options" style={row}>
      {twoHands && (
        <span role="group" aria-label="Hands" style={group}>
          <span style={label}>Hands <kbd style={kbd}>H</kbd></span>
          {(["both", "R", "L"] as const).map((h) => (
            <button key={h} type="button" data-testid={`hands-${h}`} aria-pressed={o.hands === h} style={o.hands === h ? lit : half} onClick={() => set({ hands: h })}>
              {handLabels[h]}
            </button>
          ))}
        </span>
      )}
      <span role="group" aria-label="Speed" style={group}>
        <span style={label}>Speed <kbd style={kbd}>← →</kbd></span>
        {SPEEDS.map((s) => (
          <button key={s} type="button" data-testid={`speed-${s}`} aria-pressed={o.speed === s} style={o.speed === s ? lit : half} onClick={() => set({ speed: s })}>
            {s}%
          </button>
        ))}
      </span>
      {/* records' practiceReason skips these takes: say so before the song, not after */}
      {isPractice(o) && (
        <span data-testid="options-practice" style={practice}>
          practice · not recorded
        </span>
      )}
    </div>
  );
}

// easy-charts' LevelToggle halves, side by side: the setting in force lit in cyan (cabinet chrome: selection).
const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5em 1.4em", marginTop: "0.8vh" };
const group: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "0.35em" };
const label: CSSProperties = { marginRight: "0.3em", fontSize: "clamp(12px, 0.8vw, 16px)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pa-ink-dim)" };
const kbd: CSSProperties = { font: "inherit", padding: "0 0.35em", borderRadius: 3, border: "1px solid rgba(242, 242, 245, 0.2)" };
const half: CSSProperties = {
  padding: "0.25em 0.75em",
  borderRadius: 4,
  border: "1px solid rgba(242, 242, 245, 0.2)",
  background: "none",
  color: "var(--pa-ink-dim)",
  font: "inherit",
  fontSize: "clamp(14px, 1.25vw, 24px)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  cursor: "pointer",
};
const lit: CSSProperties = { ...half, border: "1px solid var(--pa-cyan)", background: "rgba(39, 225, 255, 0.14)", color: "var(--pa-cyan)" };
const practice: CSSProperties = { fontSize: "clamp(13px, 0.85vw, 17px)", color: "var(--pa-ink-dim)" };
