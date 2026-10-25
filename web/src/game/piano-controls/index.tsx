// Piano controls (/play): the three lowest keys of an 88-key piano steer the game, so the hands never leave it.
// Mid-song the lowest A or A♯ pauses; in the pause menu the lowest A retries, A♯ goes back to the songs and B
// resumes; on the results the lowest A retries and A♯ goes back to the songs. No chart plays A0 or A♯0 (the
// library's lowest note is B0, in one song), and B only counts in the pause menu, where notes aren't played.
"use client";
import { useEffect, useRef, useState } from "react";
import { MonoLabel } from "../duo-tokens";

export const controlKeys = { retry: 21, songs: 22, resume: 23 }; // A0, A♯0, B0
export type PianoControl = "pause" | "retry" | "songs" | "resume";
export type ControlScreen = "playing" | "menu" | "results" | "off";

export function controlFor(screen: ControlScreen, pitch: number): PianoControl | null {
  const { retry, songs, resume } = controlKeys;
  if (screen === "playing") return pitch === retry || pitch === songs ? "pause" : null;
  if (pitch === retry && screen !== "off") return "retry";
  if (pitch === songs && screen !== "off") return "songs";
  if (pitch === resume && screen === "menu") return "resume";
  return null;
}

type MidiInput = { name: string; addEventListener(t: "midimessage", l: (e: { data: Uint8Array }) => void): void; removeEventListener(t: "midimessage", l: (e: { data: Uint8Array }) => void): void };
type Midi = { inputs: Map<string, MidiInput>; addEventListener(t: "statechange", l: () => void): void };

// Listens to every MIDI input beside the game's own handler (addEventListener, so onmidimessage is untouched) and
// calls onControl for a control key's press on this screen. Returns whether a piano is plugged in, for the hint.
export function usePianoControls(screen: ControlScreen, onControl: (c: PianoControl) => void): boolean {
  const latest = useRef({ screen, onControl });
  useEffect(() => {
    latest.current = { screen, onControl };
  });
  const [piano, setPiano] = useState(false);
  const wanted = screen !== "off";
  useEffect(() => {
    if (!wanted || typeof navigator === "undefined" || !("requestMIDIAccess" in navigator)) return;
    let gone = false;
    let wired: MidiInput[] = [];
    const onMessage = (e: { data: Uint8Array }) => {
      if ((e.data[0] & 0xf0) !== 0x90 || !e.data[2]) return; // presses only
      const c = controlFor(latest.current.screen, e.data[1]);
      if (c) latest.current.onControl(c);
    };
    const wire = (midi: Midi) => {
      if (gone) return;
      for (const i of wired) i.removeEventListener("midimessage", onMessage);
      wired = [...midi.inputs.values()];
      for (const i of wired) i.addEventListener("midimessage", onMessage);
      setPiano(wired.length > 0);
    };
    (navigator as unknown as { requestMIDIAccess(): Promise<Midi> })
      .requestMIDIAccess()
      .then((midi) => {
        wire(midi);
        midi.addEventListener("statechange", () => wire(midi));
      })
      .catch(() => {});
    return () => {
      gone = true;
      for (const i of wired) i.removeEventListener("midimessage", onMessage);
    };
  }, [wanted]);
  return piano;
}

// What the lowest keys do here, in the data face, only with a piano plugged in.
export function PianoControlsHint({ screen, piano }: { screen: "menu" | "results"; piano: boolean }) {
  if (!piano) return null;
  return (
    <span data-testid="piano-controls">
      <MonoLabel style={{ fontSize: "clamp(11px, 0.75vw, 15px)" }}>
        {screen === "menu" ? "Piano: lowest A Retry · A♯ Songs · B Resume" : "Piano: lowest A Retry · A♯ Songs"}
      </MonoLabel>
    </span>
  );
}
