"use client";
// The cabinet's plugin on /play (spec: cabinet). ?cabinet=1, a game started from the cabinet: 30 s on the results
// screen with no input returns to /cabinet. ?cabinet=demo, the demo in the cabinet's iframe: it starts itself and tells
// the cabinet when the results show.
import { useEffect } from "react";
import type { GamePlugin } from "../../contracts";
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
    let timer = setTimeout(() => window.location.assign(CABINET_URL), cabinetSettings.returnSeconds * 1000);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => window.location.assign(CABINET_URL), cabinetSettings.returnSeconds * 1000);
    };
    const onMidi = (m: Event) => {
      const d = (m as MIDIMessageEvent).data;
      if (d && (d[0] & 0xf0) === 0x90 && d[2] > 0) reset();
    };
    let inputs: MIDIInput[] = [];
    let live = true; // access can resolve after a disarm
    void navigator.requestMIDIAccess?.().then(
      (a) => {
        if (!live) return;
        inputs = [...a.inputs.values()];
        inputs.forEach((i) => i.addEventListener("midimessage", onMidi));
      },
      () => {},
    );
    window.addEventListener("keydown", reset);
    window.addEventListener("pointerdown", reset);
    disarm = () => {
      live = false;
      clearTimeout(timer);
      inputs.forEach((i) => i.removeEventListener("midimessage", onMidi));
      window.removeEventListener("keydown", reset);
      window.removeEventListener("pointerdown", reset);
      disarm = null;
    };
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
        if (e.type === "songStart" || e.type === "quit") disarm?.();
      }
    },
    startPanel: () => (role === "demo" ? <AutoStart /> : null),
  };
}
