// Dev-only numbers for select-motion's Validation (c), read from the page as window.__selectMotion. Production builds
// keep nothing.
export interface MotionRecord {
  moves: { at: number; cause: string; sound: boolean; firstFrame?: number }[]; // the handler's time, the next frame's
  frames: number[]; // ms between frames while a spring runs
  keyups: { at: number; match: boolean }[]; // the frame after key-up: is the bar on the focused row?
  flips: { at: number; restMs: number; rows: number }[]; // a keystroke to its last row at rest
}

declare global {
  interface Window {
    __selectMotion?: MotionRecord;
  }
}

export const record: MotionRecord | null =
  process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? (window.__selectMotion ??= { moves: [], frames: [], keyups: [], flips: [] }) : null;
