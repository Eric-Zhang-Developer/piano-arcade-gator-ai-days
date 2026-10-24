import { describe, expect, it, vi } from "vitest";
import { stageSettings } from "../stage";
import { selectStageDriver, selectStageSettings } from "./driver";

// A fake scene that counts renders and keeps the last phase.
const fakeScene = () => {
  const renders: { width: number; height: number; phase: number }[] = [];
  return { renders, render: (f: { width: number; height: number }, _l: unknown, phase: number) => void renders.push({ width: f.width, height: f.height, phase }) };
};

describe("select stage driver", () => {
  it("draws at the /play stage's brightness and scrolls one grid line per beat", () => {
    expect(selectStageSettings.opacity).toBe(stageSettings.maxLaneLuma);
    const scene = fakeScene();
    const d = selectStageDriver(scene, false);
    d.tick(0, 1280, 720);
    d.tick(250, 1280, 720); // a quarter beat at 60 bpm
    expect(scene.renders.map((r) => r.phase)).toEqual([0, 0.25]);
  });

  it("moving, renders every tick until a slow run trips the budget, then stops", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const scene = fakeScene();
    const d = selectStageDriver(scene, false);
    let t = 0;
    for (; t <= 2000; t += 16) d.tick(t, 1280, 720); // 60 fps, warm-up included
    const fast = scene.renders.length;
    expect(fast).toBe(Math.floor(2000 / 16) + 1);
    for (let i = 0; i < 40 && !d.frozen; i++, t += 50) d.tick(t, 1280, 720); // 20 fps, over the 20 ms budget
    expect(d.frozen).toBe(true);
    const atFreeze = scene.renders.length;
    for (let i = 0; i < 10; i++, t += 16) d.tick(t, 1280, 720);
    expect(scene.renders.length).toBe(atFreeze);
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();
  });

  it("still, renders once, not again at the same size, and once more at a new size", () => {
    const scene = fakeScene();
    const d = selectStageDriver(scene, true);
    d.tick(0, 1280, 720);
    d.tick(500, 1280, 720);
    d.tick(900, 1280, 720);
    expect(scene.renders).toHaveLength(1);
    d.tick(1000, 1920, 1080);
    expect(scene.renders).toHaveLength(2);
    expect(scene.renders.map((r) => r.phase)).toEqual([0, 0]);
  });
});
