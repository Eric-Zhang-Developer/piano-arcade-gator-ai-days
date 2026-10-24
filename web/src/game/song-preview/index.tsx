"use client";
// Song preview (spec: song-preview): the highlighted song's notes per second, best grade and PRACTICE 70%, and its
// opening on the piano or as quiet tones. Mount it keyed by song id: each mount is one highlight.
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Chart, Rank } from "../../contracts";
import { difficultyInputs } from "../difficulty";
import { pickOutput } from "../../replay/piano";
import { opening, openingMs, playAsTones, playOnPiano, practiceUrl, previewSettings } from "./opening";

// Page-wide: charts fetched once, and whether a key press or click has happened yet (Chrome's autoplay rule). MIDI is
// asked for only after that gesture, so the home page never opens with a permission prompt.
const charts = new Map<string, Promise<Chart>>();
const loadChart = (id: string) => {
  if (!charts.has(id)) charts.set(id, fetch(`/songs/${id}/chart.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))));
  return charts.get(id)!;
};

let armed = false;
let output: Promise<MIDIOutput | null> = Promise.resolve(null);
let audio: AudioContext | null = null;
const listeners = new Set<() => void>();
function arm() {
  if (armed) return;
  armed = true;
  output = navigator.requestMIDIAccess ? navigator.requestMIDIAccess().then(pickOutput, () => null) : Promise.resolve(null);
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("keydown", arm, { once: true });
  window.addEventListener("pointerdown", arm, { once: true });
  return () => listeners.delete(l);
}

export function SongPreview({ id, best }: { id: string; best?: { rank: Rank; accuracy: number } }) {
  const isArmed = useSyncExternalStore(subscribe, () => armed, () => false);
  const [chart, setChart] = useState<Chart | null>(null);
  const [voice, setVoice] = useState<"piano" | "tones" | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let live = true;
    const end = () => {
      stop?.();
      stop = null;
    };
    const timer = setTimeout(async () => {
      const c = await loadChart(id).catch(() => null);
      if (!live || !c) return;
      setChart(c);
      if (!armed) return;
      const out = await output;
      if (!live) return;
      const notes = opening(c);
      if (out) {
        stop = playOnPiano(out, notes);
        setVoice("piano");
      } else {
        try {
          audio ??= new AudioContext();
          void audio.resume().catch(() => {});
          stop = playAsTones(audio, notes);
          setVoice("tones");
        } catch {
          return; // no Web Audio: the panel still shows
        }
      }
      setTimeout(() => live && end(), openingMs(notes) + 50); // the opening ended: All Notes Off
    }, previewSettings.delayMs);
    const onEnter = (e: KeyboardEvent) => e.key === "Enter" && end();
    window.addEventListener("keydown", onEnter);
    window.addEventListener("pagehide", end);
    return () => {
      live = false;
      clearTimeout(timer);
      end();
      window.removeEventListener("keydown", onEnter);
      window.removeEventListener("pagehide", end);
    };
  }, [id, isArmed]);

  const nps = chart ? difficultyInputs(chart).nps : null;
  return (
    <div data-testid="song-preview" style={panel}>
      <div style={row}>
        <span>
          <span style={label}>Notes/s </span>
          <b data-testid="preview-nps">{nps === null ? "" : nps.toFixed(1)}</b>
        </span>
        <span>
          <span style={label}>Best </span>
          <b data-testid="preview-best">{best ? `${best.rank} · ${(best.accuracy * 100).toFixed(1)}%` : ""}</b>
        </span>
        {chart && (
          <a data-testid="preview-practice" href={practiceUrl(id, chart)} style={practice}>
            PRACTICE 70%
          </a>
        )}
      </div>
      <p data-testid="preview-status" style={status}>
        {!isArmed ? "Press any key for previews" : voice === "piano" ? "Preview: on the piano" : voice === "tones" ? "Preview: laptop tones" : "\u00a0"}
      </p>
    </div>
  );
}

// One compact row and a status line: the music select's left column has little room under the stats.
const panel: CSSProperties = { marginTop: "1.5vh" };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 20px", fontSize: 18, minHeight: 34 };
const label: CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pa-ink-dim)" };
const practice: CSSProperties = {
  padding: "4px 12px",
  borderRadius: 4,
  border: "1px solid rgba(39, 225, 255, 0.5)",
  color: "var(--pa-ink)",
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textDecoration: "none",
};
const status: CSSProperties = { margin: "2px 0 0", fontSize: 13, color: "var(--pa-ink-dim)" };
