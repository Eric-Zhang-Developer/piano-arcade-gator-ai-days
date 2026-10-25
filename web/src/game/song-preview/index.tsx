"use client";
// Song preview (spec: song-preview): the highlighted song's opening on the piano or as quiet tones, its Hands and Speed
// (song-options), its source and the preview status. Mount it keyed by song id: each mount is one highlight. Its level,
// notes, best, PLAY and PRACTICE moved into the select's panel (duo-select); L still learns.
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { Chart } from "../../contracts";
import { pickOutput } from "../../replay/piano";
import { modeUrl } from "../wait-mode/plugin";
import { opening, openingMs, playAsTones, playOnPiano, previewSettings } from "./opening";
import { SongSource } from "../song-sources";
import { SongOptions } from "../song-options";
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

// `best` is accepted and unused until select-layout stops passing it (duo-select); then it goes.
export function SongPreview({ id }: { id: string; best?: unknown }) {
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

  return (
    <div data-testid="song-preview" style={panel}>
      <SongOptions id={id} chart={chart} />
      {/* song-sources: the cited score, one click away; the proof, not setup, so ?capture=1 keeps it */}
      {chart && <SongSource source={chart.source} />}
      <p data-testid="preview-status" data-capture-hide style={status}>
        {!isArmed ? "\u00a0" : voice === "piano" ? "Preview: on the piano" : voice === "tones" ? "Preview: laptop tones" : "\u00a0"}
      </p>
    </div>
  );
}

// Under the select panel's buttons, on --pa-panel: Hands and Speed, the source and the status line.
const panel: CSSProperties = { marginTop: "1.5vh", background: "var(--pa-panel)" };
// Device status, like beat-track's corner text: ?capture=1 hides it (capture-mode).
const status: CSSProperties = { margin: "0.3em 0 0", fontSize: "clamp(13px, 0.85vw, 17px)", color: "var(--pa-ink-dim)" };
