// Note labels' logic (spec: note-labels). Pure, so it tests without a page.
import { keyMap } from "../core/input";
import { pillRect } from "../note-pills";

export type LabelMode = "notes" | "keys" | "off";
export type LabelSetting = LabelMode | "auto";
export const LABEL_SETTINGS: LabelSetting[] = ["auto", "notes", "keys", "off"];
export const LABELS_KEY = "pianoArcade.labels";

export const labelSettings = {
  minFontPx: 10, // never smaller (spec's Defaults)
  maxFontPx: 16,
  fontPerLane: 0.5, // font size as a share of the lane's width
  minLaneForNotesPx: 14, // falling-note labels only on lanes at least this wide (spec's Defaults: wide charts clutter)
};

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

// C D E F G A B with sharps as C♯; each C carries its octave (middle C, MIDI 60, is C4).
export function noteName(pitch: number): string {
  const name = NAMES[((pitch % 12) + 12) % 12];
  return name === "C" ? `C${Math.floor(pitch / 12) - 1}` : name;
}

// The laptop letter that plays each pitch, from core's own key map for this chart's lowest note.
export function laptopLetters(lowestPitch: number): Map<number, string> {
  const letters = new Map<number, string>();
  for (const [code, pitch] of keyMap(lowestPitch)) letters.set(pitch, code === "Semicolon" ? ";" : code.replace(/^Key/, ""));
  return letters;
}

// The URL wins, then storage, then auto. Anything unrecognised counts as unset.
export function labelSetting(url: string | null, stored: string | null): LabelSetting {
  const valid = (v: string | null): v is LabelSetting => v !== null && (LABEL_SETTINGS as string[]).includes(v);
  return valid(url) ? url : valid(stored) ? stored : "auto";
}

// auto: laptop letters until the first MIDI note-on, then letter names.
export const labelMode = (setting: LabelSetting, midiPlayed: boolean): LabelMode =>
  setting === "auto" ? (midiPlayed ? "notes" : "keys") : setting;

export const nextSetting = (s: LabelSetting): LabelSetting => LABEL_SETTINGS[(LABEL_SETTINGS.indexOf(s) + 1) % LABEL_SETTINGS.length];

export const fontPxFor = (laneWidth: number) =>
  Math.max(labelSettings.minFontPx, Math.min(labelSettings.maxFontPx, Math.round(laneWidth * labelSettings.fontPerLane)));

// A label shows only if it fits its lane, with a pixel to spare each side; otherwise it hides rather than overlap.
export const fitsLane = (textWidth: number, laneWidth: number) => textWidth <= laneWidth - 2;

// A falling note's label lane: the width of the pill the highway draws for that key (note-pills).
export const noteLane = (key: { x: number; width: number }, isBlack: boolean) => pillRect(key, isBlack).width;
