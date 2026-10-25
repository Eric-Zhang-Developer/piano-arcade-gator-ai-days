// What /conduct says to a screen reader (lab-pages-a11y, #1129): the error as an alert, the session's state and the
// hand tracker's progress as polite status lines. Pure, so the tests render them without a camera.
import type { SessionState } from "./session";
import styles from "./conduct.module.css";

export type Cam = "off" | "loading" | "on";

const STATE_LINE: Record<SessionState | "off", string> = {
  off: "Camera off",
  prep: "Waiting for two beats",
  running: "Following your tempo",
  held: "Held. Beat again to go on",
  cut: "Cut off",
  fin: "Fine",
};

// One string per state, so the region's text changes when the state does and not when a frame's readout lands.
export const stateLine = (cam: Cam, state: SessionState | "off") => STATE_LINE[cam === "on" ? state : "off"];

// Empty until the camera starts: a live region announces changes, so it's mounted before there's anything to say.
export const trackerLine = (cam: Cam) => (cam === "loading" ? "Loading the hand tracker…" : cam === "on" ? "Hand tracker ready" : "");

export const ErrorLine = ({ error }: { error: string | null }) =>
  error ? (
    <p className={styles.note} role="alert">
      {error}
    </p>
  ) : null;

export const StateLine = ({ cam, state }: { cam: Cam; state: SessionState | "off" }) => (
  <p className={styles.state} data-testid="conduct-state" role="status">
    {stateLine(cam, state)}
  </p>
);

// The visible "Loading the hand tracker…" label mounts only while loading, too late for a live region: this is the line that announces it, and the ready that follows.
export const TrackerStatus = ({ cam }: { cam: Cam }) => (
  <p className={styles.srOnly} role="status" data-testid="conduct-tracker">
    {trackerLine(cam)}
  </p>
);
