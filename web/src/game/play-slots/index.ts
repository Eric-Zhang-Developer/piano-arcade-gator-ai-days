// Play slots: the pause clock and the pause menu's states (spec: play-slots). Pure, so they test without a page.

// The chart clock with pauses: chart time = wall time - zero - time spent paused. While paused it stands still.
export interface PauseClock {
  now(perf: number): number; // chart ms at wall time perf (performance.now() domain)
  toPerf(chartMs: number): number; // the wall time a chart time lands at, if no more pauses come
  pause(perf: number): void;
  resume(perf: number): void;
  readonly paused: boolean;
}

export function pauseClock(zeroPerf: number): PauseClock {
  let pausedMs = 0;
  let pausedAt: number | null = null;
  return {
    now: (perf) => (pausedAt ?? perf) - zeroPerf - pausedMs,
    toPerf: (chartMs) => chartMs + zeroPerf + pausedMs,
    pause(perf) {
      pausedAt ??= perf;
    },
    resume(perf) {
      if (pausedAt === null) return;
      pausedMs += perf - pausedAt;
      pausedAt = null;
    },
    get paused() {
      return pausedAt !== null;
    },
  };
}

// Esc pauses into the menu; Esc or Resume starts a one-bar countdown; the countdown's end resumes play.
// Retry and Quit end the take. The clock stays stopped through the menu and the countdown.
export type PauseMode = "playing" | "menu" | "countdown" | "quit";
export type PauseAction = "esc" | "resume" | "countdownDone" | "retry" | "quit";

export function nextPause(mode: PauseMode, action: PauseAction): PauseMode {
  if (mode === "quit") return mode;
  if (action === "retry" || action === "quit") return mode === "playing" ? mode : "quit";
  if (mode === "playing") return action === "esc" ? "menu" : mode;
  if (mode === "menu") return action === "esc" || action === "resume" ? "countdown" : mode;
  return action === "countdownDone" ? "playing" : mode; // countdown: Esc waits for it to finish
}
