// Render reel's focus and the reel's done line (lab-pages-a11y, #1143). Pure, so the tests cover them without a DOM.
import styles from "./highlight.module.css";

export type State = "loading" | "ready" | "rendering" | "done" | "no-reel" | "error";

// A disabled button drops its focus to the page, so while it records, Render is only aria-disabled (render() ignores
// the press) and keeps the focus the keyboard gave it. It looks the same either way: the kit styles no disabled state.
export const renderLock = (s: State) => ({ disabled: s !== "ready" && s !== "rendering", "aria-disabled": s === "rendering" ? true : undefined });

// Save video replaces Render when the reel is done, and takes the focus if Render still had it.
export const focusSave = (prev: State, next: State, renderHadFocus: boolean) => prev === "rendering" && next === "done" && renderHadFocus;

export interface Video {
  bytes: number;
  late: number;
}

export const doneLine = (state: State, video: Video | null) =>
  state === "done" && video ? `${(video.bytes / 1e6).toFixed(1)} MB WebM · ${video.late} late frames` : "Plays the reel once in real time to record it: 15 seconds.";

// Mounted from the start, so the change to the done line is what it announces.
export const ReelStatus = ({ state, video }: { state: State; video: Video | null }) => (
  <p className={styles.small} role="status" data-testid="highlight-status">
    {doneLine(state, video)}
  </p>
);
