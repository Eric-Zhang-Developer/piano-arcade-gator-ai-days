import type { GamePlugin } from "../../contracts";

export { coreGuard, createGuard, type Guard } from "./guard";

// The test plugin (as scenes' ?bot=): ?crash=draw throws from its draw on the take's 30th frame, ?crash=event from its
// onEvent on the first noteHit. Without ?crash it draws nothing and changes nothing. ?crash=render is GameBoundary's.
export function crashGuard(): GamePlugin {
  let crash: string | null = null;
  let frames = 0;
  return {
    id: "crash-guard",
    transformChart(chart, params) {
      crash = params.get("crash");
      return chart;
    },
    draw() {
      if (crash === "draw" && ++frames === 30) throw new Error("test crash (?crash=draw)");
    },
    onEvent(e) {
      if (e.type === "songStart") frames = 0; // the 30th frame of each take, Retry's included
      if (crash === "event" && e.type === "noteHit") throw new Error("test crash (?crash=event)");
    },
  };
}
