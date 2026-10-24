"use client";
// <SelectStage />: a fixed layer behind the music select with select-layout's gradient, and fever-stage's scene on
// it unless the stage is off (?stage=off, fever-stage's storage switch, or no WebGL). One WebGL context: unmounting
// disposes the scene, which forces the context lost.
import { useEffect, useRef } from "react";
import { stageOff } from "../stage";
import { makeScene } from "../stage/scene";
import { selectStageDriver, selectStageSettings } from "./driver";

export { selectStageDriver, selectStageSettings } from "./driver";

export function SelectStage() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || stageOff(new URLSearchParams(window.location.search))) return;
    const scene = makeScene(el, selectStageSettings.opacity);
    if (!scene) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const driver = selectStageDriver(scene, still);
    const tick = () => driver.tick(performance.now(), window.innerWidth, window.innerHeight);
    let raf = 0;
    const loop = () => {
      tick();
      if (!driver.frozen) raf = requestAnimationFrame(loop);
    };
    if (still) {
      tick();
      window.addEventListener("resize", tick);
    } else loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", tick);
      scene.dispose();
    };
  }, []);
  return (
    <div
      ref={ref}
      data-testid="select-stage"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        background: "linear-gradient(to bottom, var(--pa-bg) 0%, var(--pa-sky) 100%)",
      }}
    />
  );
}
