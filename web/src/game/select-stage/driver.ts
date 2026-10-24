// Select stage (spec: select-stage): fever-stage's scene behind the music select, in its tier-1 look, scrolling one
// grid line per beat. This file is plain TypeScript (Vitest has no DOM); index.tsx mounts it.
import type { Frame } from "../../contracts";
import { emptyStage, frameBudget, gridPhase, look, stageSettings } from "../stage";
import type { Scene } from "../stage/scene";

export const selectStageSettings = {
  bpm: 60, // grid lines per minute
  opacity: stageSettings.maxLaneLuma, // the level /play shows its stage at: a 0.78 canvas under a 0.55 backdrop
};

const calm = look(emptyStage(), 0); // tier 1, no fever, dip, flash or burst: the same at every time

// tick(nowMs, width, height) renders a frame: every tick, or when still, on the first and on a new size. It feeds the
// frame budget and freezes for good, with one log line, if it trips.
export function selectStageDriver(scene: Pick<Scene, "render">, still: boolean, overBudget = frameBudget()) {
  let mountedAt: number | null = null;
  let size = "";
  let frozen = false;
  return {
    tick(nowMs: number, width: number, height: number): void {
      mountedAt ??= nowMs;
      if (frozen) return;
      if (still) {
        if (`${width}x${height}` === size) return;
      } else if (overBudget(nowMs - mountedAt)) {
        frozen = true;
        console.info(`select-stage: frames averaged over ${stageSettings.budgetMs} ms for 1 s; the stage is frozen`);
        return;
      }
      size = `${width}x${height}`;
      scene.render({ width, height } as Frame, calm, still ? 0 : gridPhase(nowMs, selectStageSettings.bpm, calm.speed)); // render reads only the size
    },
    get frozen() {
      return frozen;
    },
  };
}
