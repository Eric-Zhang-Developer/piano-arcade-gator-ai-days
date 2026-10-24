// Select to stage (spec: select-to-stage): Enter or a click on a song moves the focused jacket into the stage card's
// jacket with one view transition. /play renders its stage card after an effect loads the chart, so the transition's
// update waits for the card (capped) instead of relying on React to pair the names in one commit.

export const stageMoveSettings = {
  durationMs: 400, // the jacket's move and the crossfade, at most
  waitMs: 1000, // no stage card by then (first visit compiling /play, say): a cut
  stage: 'section[aria-label="Stage"]', // stage-card's
};

type Router = { push(href: string): void };
type Doc = Pick<Document, "querySelector" | "getAnimations"> & {
  startViewTransition?: (update: () => Promise<void>) => { ready: Promise<void>; skipTransition(): void };
};

// Resolves true once the stage card is in the DOM, false after waitMs.
function stageShown(doc: Doc, waitMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = performance.now();
    const look = () => {
      if (doc.querySelector(stageMoveSettings.stage)) return resolve(true);
      if (performance.now() - start >= waitMs) return resolve(false);
      setTimeout(look, 16);
    };
    look();
  });
}

export function goToStage(href: string, router: Router, doc: Doc = document): void {
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still || typeof doc.startViewTransition !== "function") return router.push(href);
  const { durationMs, waitMs } = stageMoveSettings;
  const t = doc.startViewTransition(async () => {
    router.push(href);
    if (!(await stageShown(doc, waitMs))) t.skipTransition();
  });
  // Next's CSS modules can't hold a bare ::view-transition-group rule, so the timing is set here.
  t.ready
    .then(() => {
      for (const a of doc.getAnimations()) {
        const effect = a.effect as KeyframeEffect | null;
        if (effect?.pseudoElement?.startsWith("::view-transition")) effect.updateTiming({ duration: durationMs, easing: "ease-out" });
      }
    })
    .catch(() => {}); // skipped: nothing to time
}
