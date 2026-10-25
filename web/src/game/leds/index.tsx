// LED game link (spec: led-game): with the LED board connected, the strip lights the next keys before their notes
// (guide lights), a judged note's key in its judgment's color, and a miss red. With no board, nothing changes.
"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Chart, GamePlugin, InputDevice } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { CLEAR, hintDiff, hintsAt, judgedKey, keyOff, ledSettings, type Rgb } from "./messages";
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
    startPanel: () => <ConnectLights />,
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
      style={{
        padding: "6px 14px",
        fontSize: 15,
        borderRadius: 6,
        border: "1px solid rgba(242,242,245,0.3)",
        background: "transparent",
        color: "inherit",
        cursor: idle ? "pointer" : "default",
        opacity: s === "unsupported" ? 0.6 : 1,
      }}
    >
      {label[s]}
    </button>
  );
}
