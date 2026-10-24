"use client";
// The cabinet's plugin on /play (spec: cabinet). ?cabinet=1, a game started from the cabinet: 30 s on the results
// screen with no input returns to /cabinet. ?cabinet=demo, the demo in the cabinet's iframe: it starts itself and tells
// the cabinet when the results show.
import { useEffect } from "react";
import type { GamePlugin } from "../../contracts";
import { whenIdle } from "./idle";
import { CABINET_URL, cabinetSettings } from "./loop";

export type CabinetMessage = { type: "cabinet-results" };

const toCabinet = (m: CabinetMessage) => {
  if (window.parent !== window) window.parent.postMessage(m, window.location.origin);
};

// Clicks Start once the start screen shows, as the sim does (core has no autostart outside ?input=test).
function AutoStart() {
  useEffect(() => {
    document.querySelector<HTMLButtonElement>("main button")?.click();
  }, []);
  return null;
}

export function cabinet(): GamePlugin {
  let role: "game" | "demo" | null = null;
  let disarm: (() => void) | null = null;

  // After a cabinet game: back to /cabinet once nobody has touched a key, the mouse or the piano for 30 s.
  const armReturn = () => {
    disarm?.();
    disarm = whenIdle(cabinetSettings.returnSeconds * 1000, () => window.location.assign(CABINET_URL));
  };

  return {
    id: "cabinet",
    transformChart(c, params) {
      const v = params.get("cabinet");
      role = v === "1" ? "game" : v === "demo" ? "demo" : null;
      return c;
    },
    onEvent(e) {
      if (role === "demo" && e.type === "songEnd") toCabinet({ type: "cabinet-results" });
      if (role === "game") {
        if (e.type === "songEnd") armReturn();
        if (e.type === "songStart" || e.type === "quit") {
          disarm?.();
          disarm = null;
        }
      }
    },
    startPanel: () => (role === "demo" ? <AutoStart /> : null),
  };
}
