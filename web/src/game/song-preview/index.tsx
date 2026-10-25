"use client";
// Song preview (spec: song-preview): the highlighted song's notes per second, best grade and PRACTICE 70%, and its
// opening on the piano or as quiet tones, and the song's Hands and Speed (song-options). Mount it keyed by song id:
// each mount is one highlight.
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Chart, Rank } from "../../contracts";
import { difficultyInputs } from "../difficulty";
import { pickOutput } from "../../replay/piano";
import { modeUrl } from "../wait-mode/plugin";
import { opening, openingMs, playAsTones, playOnPiano, practiceUrl, previewSettings } from "./opening";
import { SongSource } from "../song-sources";
import { useLevel, withLevel } from "../easy-charts";
import { SongOptions, useSongOptions, withOptions } from "../song-options";
import { isWatchKey } from "../watch-demo/demo";

// The music select's L (learn-from-select): plain l or L, no Ctrl, Meta or Alt (Cmd+L stays the browser's), no repeat.
export const isLearnKey = (e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat">) =>
  (e.key === "l" || e.key === "L") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;
// The whole song in wait mode, built by wait-mode itself so / and /play agree on the URL.
export const learnUrl = (id: string) => modeUrl(new URLSearchParams({ song: id }), true);

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
  const [level] = useLevel();
  const options = useSongOptions()[id];

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
    const onEnter = (e: KeyboardEvent) => (e.key === "Enter" || isLearnKey(e) || isWatchKey(e)) && end(); // leaving: stop at once
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
        <span style={actions}>
          <a data-testid="preview-learn" href={withOptions(withLevel(learnUrl(id), level), options)} style={action}>
            LEARN
          </a>
          {/* PRACTICE keeps its own 70% whatever Speed says; it takes the song's level and hands */}
          {chart && (
            <a data-testid="preview-practice" href={withOptions(withLevel(practiceUrl(id, chart), level), { hands: options?.hands ?? "both", speed: 70 })} style={action}>
              PRACTICE 70%
            </a>
          )}
        </span>
      </div>
      <SongOptions id={id} chart={chart} />
      {/* song-sources: the cited score, one click away; the proof, not setup, so ?capture=1 keeps it */}
      {chart && <SongSource source={chart.source} />}
      <p data-testid="preview-status" data-capture-hide style={status}>
        {!isArmed ? "Press any key for previews" : voice === "piano" ? "Preview: on the piano" : voice === "tones" ? "Preview: laptop tones" : "\u00a0"}
      </p>
    </div>
  );
}

// One compact row and a status line: the music select's left column has little room under the stats. Sizes follow the
// screen like the rest of the select, so the row is readable on video at 1920×1080 (visual-direction: Type).
// On --pa-panel, not on the select stage: Duo's ink is a little dimmer, and the stage's sun behind the row took
// LEARN to 4.44:1 and the status to 4.1:1, under select-stage's 4.5:1 (duo-tokens).
const panel: CSSProperties = { marginTop: "1.5vh", background: "var(--pa-panel)" };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.3em 1.1em", fontSize: "clamp(16px, 1.25vw, 24px)" };
const label: CSSProperties = { fontSize: "clamp(12px, 0.8vw, 16px)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pa-ink-dim)" };
// LEARN and PRACTICE 70%: one outline, one type, set apart from the stats so an empty BEST doesn't read into LEARN.
const actions: CSSProperties = { display: "inline-flex", gap: "0.6em", marginLeft: "0.8em" };
const action: CSSProperties = {
  padding: "0.25em 0.75em",
  borderRadius: 4,
  border: "1px solid var(--pa-line)", // Duo's hairline; the old bright cyan was the brightest pixel behind the label
  color: "var(--pa-ink)",
  fontSize: "clamp(14px, 1.25vw, 24px)",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textDecoration: "none",
};
// Device status, like beat-track's corner text: ?capture=1 hides it (capture-mode).
const status: CSSProperties = { margin: "0.3em 0 0", fontSize: "clamp(13px, 0.85vw, 17px)", color: "var(--pa-ink-dim)" };
