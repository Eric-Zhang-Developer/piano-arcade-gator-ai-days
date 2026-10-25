// LED game link (spec: led-game): with the LED board connected, the strip lights the next keys before their notes
// (guide lights), a judged note's key in its judgment's color, and a miss red. With no board, nothing changes.
"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Chart, GamePlugin, InputDevice } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { kitChip } from "../duo-tokens";
import { CLEAR, hintDiff, hintsAt, judgedKey, keyOff, ledSettings, lightMode, type LightMode, type Rgb } from "./messages";
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

// The pause menu's status (pause-skin's status slot): is the keyboard there, are the lights on, and the lights'
// mode chip, so a demo can be checked and flipped mid-song without leaving it. `midi` is /play's own status line.
export function PauseLights({ midi }: { midi: string }) {
  return (
    <>
      <span data-testid="pause-keyboard">Keyboard: {midi.replace(/^(MIDI|Piano): /, "")}</span>
      <span style={{ display: "flex" }}>
        <ConnectLights />
        <DemoLights />
      </span>
    </>
  );
}

// The lights' mode chip: with the board on, a click steps the strip through its three modes (firmware setting 15):
// Calm (hint build-up, red wrong keys, soft glows), Demo (calm plus a ripple on every press, no red) and Demo simple
// (only the key light and its ripple, after a press). The choice is kept in this browser and sent again whenever
// the board connects, since a board that restarted is back in whatever it last saved.
const modeKey = "pa.lights.demo"; // "0", "1" or "2"; older pages stored only "0" and "1"
const modeNames: Record<LightMode, string> = { 0: "Calm", 1: "Demo", 2: "Demo simple" };
let mode: LightMode | null = null; // read from storage on first use
const modeListeners = new Set<() => void>();
const modeSnapshot = (): LightMode => {
  if (mode === null) {
    let v = 0;
    try {
      v = Number(localStorage.getItem(modeKey) ?? 0);
    } catch {
      // storage blocked: start calm
    }
    mode = v === 1 || v === 2 ? v : 0;
  }
  return mode;
};
const subscribeMode = (l: () => void) => {
  modeListeners.add(l);
  return () => modeListeners.delete(l);
};
function setMode(m: LightMode) {
  mode = m;
  try {
    localStorage.setItem(modeKey, String(m));
  } catch {
    // storage blocked: the choice lasts this page only
  }
  for (const l of modeListeners) l();
}

function DemoLights() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  const m = useSyncExternalStore(subscribeMode, modeSnapshot, () => 0 as LightMode);
  useEffect(() => {
    if (s === "ready") send(lightMode(m));
  }, [s, m]);
  if (s !== "ready") return null;
  const next = () => setMode(((m + 1) % 3) as LightMode);
  return (
    <button
      type="button"
      data-testid="demo-lights"
      data-mode={m}
      aria-label={`Lights mode: ${modeNames[m]}. Click for ${modeNames[((m + 1) % 3) as LightMode]}`}
      onClick={next}
      className={kitChip(m !== 0).className}
      style={{ ...kitChip(m !== 0).style, cursor: "pointer", marginLeft: 8 }}
    >
      {`Mode: ${modeNames[m]}`}
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
