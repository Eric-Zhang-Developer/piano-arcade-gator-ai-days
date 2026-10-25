// "Piano volume" (spec: laptop-sound): the laptop piano's level, 0–1, saved per browser. The effects mute doesn't
// touch it. The options panel's slider reads and sets it; the synth's output gain follows it.

// A number saved per browser, for the options panel's rows: read once, clamped when set, out-of-range or unreadable
// saved values read as the default, and listeners told of each change (useSyncExternalStore's subscribe).
// audio-track's recording volume and offset use it too; this file imports nothing, so either side can.
export function savedNumber(key: string, fallback: number, min: number, max: number) {
  let value: number | null = null;
  const listeners = new Set<() => void>();
  const load = (): number => {
    try {
      const raw = localStorage.getItem(key);
      const v = Number(raw);
      return raw !== null && v >= min && v <= max ? v : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    get: (): number => (value ??= load()),
    set(v: number): void {
      value = Math.min(max, Math.max(min, v));
      try {
        localStorage.setItem(key, String(value));
      } catch {
        // private mode: it holds for this page only
      }
      listeners.forEach((f) => f());
    },
    subscribe(f: () => void): () => void {
      listeners.add(f);
      return () => listeners.delete(f);
    },
  };
}

export const DEFAULT_PIANO_VOLUME = 0.7;
export const {
  get: getPianoVolume,
  set: setPianoVolume,
  subscribe: subscribePianoVolume,
} = savedNumber("pianoArcade.pianoVolume", DEFAULT_PIANO_VOLUME, 0, 1);
