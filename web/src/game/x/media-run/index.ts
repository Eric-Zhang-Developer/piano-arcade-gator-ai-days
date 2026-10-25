// One camera or mic start at a time (lab-camera-release, #1315-#1322). An async start (getUserMedia, a CDN load,
// play()) hands what it opens to hold() as it goes, not at the end. A newer start(), stop() or the page leaving runs
// every release so far, and the stale start learns it from hold() or live() after its next await, so nothing it opens
// later outlives it either.
export function mediaRun() {
  let gen = 0;
  let releases: (() => void)[] = [];
  const stop = () => {
    gen++;
    const r = releases;
    releases = [];
    for (const release of r.reverse()) release();
  };
  return {
    stop,
    start() {
      stop();
      const me = gen;
      const live = () => me === gen;
      return {
        live,
        // Keeps release for the next stop; a stale start's release runs at once. Returns live().
        hold(release: () => void) {
          if (live()) releases.push(release);
          else release();
          return live();
        },
      };
    },
  };
}

export const stopTracks = (s: MediaStream | null | undefined) => s?.getTracks().forEach((t) => t.stop());
