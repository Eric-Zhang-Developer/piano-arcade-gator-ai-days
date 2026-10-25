// "Piano volume" (spec: laptop-sound): the laptop piano's level, 0–1, saved per browser. The effects mute doesn't
// touch it. The options panel's slider reads and sets it; the synth's output gain follows it.

const KEY = "pianoArcade.pianoVolume";
export const DEFAULT_PIANO_VOLUME = 0.7;

export function loadPianoVolume(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const v = Number(raw);
    return raw !== null && v >= 0 && v <= 1 ? v : DEFAULT_PIANO_VOLUME;
  } catch {
    return DEFAULT_PIANO_VOLUME;
  }
}

let volume: number | null = null;
const listeners = new Set<() => void>();

export const getPianoVolume = (): number => (volume ??= loadPianoVolume());

export function setPianoVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(KEY, String(volume));
  } catch {
    // private mode: the level holds for this page only
  }
  listeners.forEach((f) => f());
}

export function subscribePianoVolume(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}
