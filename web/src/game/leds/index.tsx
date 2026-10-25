// LED game link (spec: led-game): with the LED board connected, the strip lights the next keys before their notes
// (guide lights), a judged note's key in its judgment's color, and a miss red. With no board, nothing changes.
"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Chart, GamePlugin, InputDevice } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { kitChip } from "../duo-tokens";
import { CLEAR, demoMode, hintDiff, hintsAt, judgedKey, keyOff, ledSettings, type Rgb } from "./messages";
import { autoConnect, connect, linkState, send, subscribe, type LinkState } from "./serial";

export { hintDiff, hintsAt, judgedKey, ledSettings, rgb7 } from "./messages";

export function leds(): GamePlugin {
  let chart: Chart | null = null;
  const judged = new Set<string>();
  let lit = new Map<number, Rgb>();
  let pausedAt: number | null = null;
  let playing = false; // songStart to songEnd or quit: the results screen lights nothing

  const reset = (on: boolean) => {
    playing = on;
    judged.clear();
    lit = new Map();
    pausedAt = null;
    send(CLEAR);
  };

  return {
    id: "leds",
    // Last in layers.ts, so this is the chart /play plays.
    transformChart(c) {
      chart = c;
      return c;
    },
    draw(_ctx, frame) {
      if (!chart || !playing || linkState() !== "ready") return;
      const want = hintsAt(chart, frame.nowMs, judged);
      for (const m of hintDiff(lit, want)) send(m);
      lit = want;
    },
    onEvent(e) {
      if (e.type === "songStart") return reset(true);
      if (e.type === "songEnd" || e.type === "quit") return reset(false);
      if (e.type === "pause") pausedAt = e.atMs;
      // A resume somewhere else (wait mode's rewind): the notes from there on are unjudged again.
      if (e.type === "resume" && chart && pausedAt !== null && e.atMs !== pausedAt) {
        for (const n of chart.notes) if (noteTimeMs(chart, n) >= e.atMs) judged.delete(n.id);
      }
      if (e.type === "noteHit" || e.type === "noteMiss") judged.add(e.noteId);
      const on = judgedKey(e);
      if (on) send(on);
      if (e.type === "noteMiss") setTimeout(() => send(keyOff(e.pitch)), ledSettings.missFlashMs);
    },
    // A released key goes dark (it fades on the board).
    wrapInput: (device): InputDevice => ({
      kind: device.kind,
      start: (onEvent) =>
        device.start((e) => {
          onEvent(e);
          if (e.type === "off") send(keyOff(e.pitch));
        }),
      stop: () => device.stop(),
    }),
    startPanel: () => (
      <>
        <ConnectLights />
        <DemoLights />
      </>
    ),
  };
}

const label: Record<LinkState, string> = {
  off: "Connect lights",
  opening: "Lights: waiting for the board…",
  ready: "Lights: on",
  "no-board": "Lights: no board answered. Try again",
  error: "Lights: the port is busy (close the Arduino serial monitor). Try again",
  unsupported: "Lights need Chrome or Edge (Web Serial)",
};

// Demo lights: with the board on, a chip that flips the strip into demo mode (hits ripple out both ways, sparks
// for the big moments) and back. The choice is kept in this browser and sent again whenever the board connects,
// since a board that restarted is back in its calm default.
const demoKey = "pa.lights.demo";
let demoOn: boolean | null = null; // read from storage on first use
const demoListeners = new Set<() => void>();
const demoSnapshot = () => {
  if (demoOn === null) {
    try {
      demoOn = localStorage.getItem(demoKey) === "1";
    } catch {
      demoOn = false; // storage blocked: start calm
    }
  }
  return demoOn;
};
const subscribeDemo = (l: () => void) => {
  demoListeners.add(l);
  return () => demoListeners.delete(l);
};
function setDemo(on: boolean) {
  demoOn = on;
  try {
    localStorage.setItem(demoKey, on ? "1" : "0");
  } catch {
    // storage blocked: the choice lasts this page only
  }
  for (const l of demoListeners) l();
}

function DemoLights() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  const on = useSyncExternalStore(subscribeDemo, demoSnapshot, () => false);
  useEffect(() => {
    if (s === "ready") send(demoMode(on));
  }, [s, on]);
  if (s !== "ready") return null;
  const flip = () => setDemo(!on);
  return (
    <button
      type="button"
      data-testid="demo-lights"
      aria-pressed={on}
      onClick={flip}
      className={kitChip(on).className}
      style={{ ...kitChip(on).style, cursor: "pointer", marginLeft: 8 }}
    >
      {on ? "Demo lights: on" : "Demo lights: off"}
    </button>
  );
}

function ConnectLights() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  useEffect(autoConnect, []);
  const idle = s === "off" || s === "no-board" || s === "error";
  return (
    <button
      type="button"
      data-testid="connect-lights"
      data-state={s}
      disabled={!idle}
      onClick={connect}
      className={kitChip(s === "ready").className}
      style={{ ...kitChip(s === "ready").style, cursor: idle ? "pointer" : "default", opacity: s === "unsupported" ? 0.6 : 1 }}
    >
      {label[s]}
    </button>
  );
}
