import { afterEach, expect, test, vi } from "vitest";
import { goToStage, stageMoveSettings } from "./go-to-stage";

afterEach(() => vi.unstubAllGlobals());
const motion = (reduce: boolean) => vi.stubGlobal("matchMedia", () => ({ matches: reduce }));

// A fake document: startViewTransition runs its update on the next tick, as the browser does after capturing.
function fakeDoc(opts: { api?: boolean; stageAfterMs?: number | null } = {}) {
  const { api = true, stageAfterMs = 0 } = opts;
  const t0 = performance.now();
  const timed: { duration?: number; easing?: string }[] = [];
  const doc = {
    starts: 0,
    skipped: false,
    querySelector: (sel: string) => (sel === stageMoveSettings.stage && stageAfterMs !== null && performance.now() - t0 >= stageAfterMs ? {} : null),
    getAnimations: () => [
      { effect: { pseudoElement: "::view-transition-group(stage-jacket)", updateTiming: (t: object) => timed.push(t) } },
      { effect: { pseudoElement: null, updateTiming: () => timed.push({ duration: -1 }) } },
    ],
    startViewTransition: api
      ? (update: () => Promise<void>) => {
          doc.starts++;
          const done = new Promise<void>((r) => setTimeout(() => void update().then(r), 0));
          return { ready: done, skipTransition: () => (doc.skipped = true) };
        }
      : undefined,
  };
  return { doc, timed };
}

test("reduced motion: one push, no view transition", () => {
  motion(true);
  const { doc } = fakeDoc();
  const push = vi.fn();
  goToStage("/play?song=twinkle", { push }, doc as never);
  expect(push).toHaveBeenCalledExactlyOnceWith("/play?song=twinkle");
  expect(doc.starts).toBe(0);
});

test("without the API: one push", () => {
  motion(false);
  const { doc } = fakeDoc({ api: false });
  const push = vi.fn();
  goToStage("/play?song=twinkle", { push }, doc as never);
  expect(push).toHaveBeenCalledOnce();
});

test("otherwise: exactly one transition that pushes once, timed to at most 400 ms ease-out", async () => {
  motion(false);
  const { doc, timed } = fakeDoc({ stageAfterMs: 30 });
  const push = vi.fn();
  goToStage("/play?song=twinkle", { push }, doc as never);
  expect(doc.starts).toBe(1);
  await vi.waitFor(() => expect(timed).toHaveLength(1));
  expect(push).toHaveBeenCalledOnce();
  expect(timed[0]).toEqual({ duration: 400, easing: "ease-out" }); // only the view-transition animation
  expect(doc.skipped).toBe(false);
});

test("no stage card within the wait: the transition is skipped (a cut)", async () => {
  motion(false);
  stageMoveSettings.waitMs = 50;
  try {
    const { doc } = fakeDoc({ stageAfterMs: null });
    goToStage("/play?song=twinkle", { push: () => {} }, doc as never);
    await vi.waitFor(() => expect(doc.skipped).toBe(true));
  } finally {
    stageMoveSettings.waitMs = 1000;
  }
});
