// LED game link (spec: led-game): with the LED board connected, the strip lights the next keys before their notes
// (guide lights), a judged note's key in its judgment's color, and a miss red. In Demo it lights every press instead,
// in the color of the note falling toward that key. With no board, nothing changes.
"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { Chart, GamePlugin, InputDevice } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { kitChip } from "../duo-tokens";
import { handColor } from "../hand-colors";
import { boardBrightnessTo, CLEAR, hintDiff, hintRamp, hintsAt, judgedKey, keyOff, keyOn, ledHandColors, ledSettings, lightMode, pressColor, rippleLength, SAVE, sideColor, type HandColors, type LightMode, type Rgb } from "./messages";
import { autoConnect, boardBrightness, connect, linkState, noSerialReason, send, subscribe, type LinkState } from "./serial";

export { hintDiff, hintsAt, judgedKey, ledSettings, rgb7 } from "./messages";

// While /play's piano input runs, the game lights Demo's presses itself (it knows the falling notes' colors), so the
// every-page listener (everywhere.tsx) steps aside instead of sending each press twice.
let gamePresses = 0;
export const gameOwnsPresses = () => gamePresses > 0;
const demoOn = () => linkState() === "ready" && lightModeNow() === 1;

export function leds(): GamePlugin {
  let chart: Chart | null = null;
  const judged = new Set<string>();
  let lit = new Map<number, Rgb>();
  let pausedAt: number | null = null;
  let playing = false; // songStart to songEnd or quit: the results screen lights nothing
  let nowMs = 0; // the song clock at the last frame, for a press's falling note

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
      nowMs = frame.nowMs;
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
      if (lightModeNow() === 1) return; // Demo: the press already lit its key (wrapInput); a judgment adds nothing
      const on = judgedKey(e);
      if (on) send(on);
      if (e.type === "noteMiss") setTimeout(() => send(keyOff(e.pitch)), ledSettings.missFlashMs);
    },
    // A released key goes dark (it fades on the board). In Demo a press lights its key, before the judge hears it,
    // so its color is the note falling toward it rather than the one after.
    wrapInput: (device): InputDevice => {
      const piano = device.kind === "midi";
      return {
        kind: device.kind,
        start: (onEvent) => {
          if (piano) gamePresses++;
          return device.start((e) => {
            if (e.type === "on" && demoOn()) {
              const colors = lightColorsNow();
              send(keyOn(e.pitch, chart && playing ? pressColor(chart, nowMs, judged, e.pitch, colors) : sideColor(e.pitch, colors)));
            }
            onEvent(e);
            if (e.type === "off") send(keyOff(e.pitch));
          });
        },
        stop: () => {
          if (piano) gamePresses = Math.max(0, gamePresses - 1);
          device.stop();
        },
      };
    },
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
  "no-board": "Lights: no board answered. Check its USB cable (on Windows, the CP210x driver), then try again",
  error: "Lights: the port won't open (the Arduino serial monitor? on Linux, the dialout group). Try again",
  elsewhere: "Lights: on in another tab. Take them here",
  blocked: "Lights: serial ports are blocked for this site (the browser's site settings). Allow them, then try again",
  unsupported: "Lights need Chrome, Edge or Brave (Web Serial)", // noSerialReason() says which
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

// The lights' mode chip: with the board on, a click flips the strip between its two modes (firmware setting 15):
// Learning (hints that build up from very faint to gold, red wrong keys, soft glows) and Demo (every key pressed on the piano lights with a quick ripple,
// on every page: see everywhere.tsx). Demo is the default (Sharan, 2026-10-25: it's what matters). The choice is
// kept in this browser and sent again whenever the board connects, since a board that restarted is back in whatever
// it last saved. A new key, so a Learning picked before Demo was the default doesn't stick.
const modeKey = "pa.lights.mode"; // "0" or "1"
const modeNames: Record<LightMode, string> = { 0: "Learning", 1: "Demo" };
let mode: LightMode | null = null; // read from storage on first use
const modeListeners = new Set<() => void>();
export const lightModeNow = (): LightMode => {
  if (mode === null) {
    let v = 1;
    try {
      v = Number(localStorage.getItem(modeKey) ?? 1);
    } catch {
      // storage blocked: start in Demo
    }
    mode = v === 0 ? 0 : 1;
  }
  return mode;
};
export const subscribeLightMode = (l: () => void) => {
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

export function DemoLights() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  const m = useSyncExternalStore(subscribeLightMode, lightModeNow, () => 1 as LightMode);
  useEffect(() => {
    if (s === "ready") for (const msg of [hintRamp(), lightMode(m), rippleLength(0)]) send(msg);
  }, [s, m]);
  if (s !== "ready") return null;
  const other: LightMode = m === 0 ? 1 : 0;
  return (
    <button
      type="button"
      data-testid="demo-lights"
      data-mode={m}
      aria-label={`Lights mode: ${modeNames[m]}. Click for ${modeNames[other]}`}
      onClick={() => setMode(other)}
      className={kitChip(m !== 0).className}
      style={{ ...kitChip(m !== 0).style, cursor: "pointer", marginLeft: 8 }}
    >
      {`Mode: ${modeNames[m]}`}
    </button>
  );
}

// Demo's two colors (a setting kept in this browser): Blue & pink (the default, the site's primary and hype), Match
// game (the site's hand colors, whatever they are now), or Custom, any two picked with the color inputs. Read on every
// press, so a change shows on the next key.
type ColorPick = "duo" | "game" | "custom";
type ColorChoice = { pick: ColorPick; L: string; R: string }; // L and R: the custom colors
const colorsKey = "pa.lights.colors";
const pickNames: Record<ColorPick, string> = { duo: "Blue & pink", game: "Match game", custom: "Custom" };
const defaultChoice: ColorChoice = { pick: "duo", ...ledHandColors };
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
let choice: ColorChoice | null = null; // read from storage on first use
const colorListeners = new Set<() => void>();
const colorChoiceNow = (): ColorChoice => {
  if (choice === null) {
    choice = defaultChoice;
    try {
      const v = JSON.parse(localStorage.getItem(colorsKey) ?? "null");
      if (v && (v.pick === "duo" || v.pick === "game" || v.pick === "custom") && isHex(v.L) && isHex(v.R)) choice = v;
    } catch {
      // storage blocked or garbled: the default
    }
  }
  return choice!;
};
const subscribeLightColors = (l: () => void) => {
  colorListeners.add(l);
  return () => colorListeners.delete(l);
};
function setChoice(c: ColorChoice) {
  choice = c;
  try {
    localStorage.setItem(colorsKey, JSON.stringify(c));
  } catch {
    // storage blocked: the choice lasts this page only
  }
  for (const l of colorListeners) l();
}
const colorsOf = (c: ColorChoice): HandColors =>
  c.pick === "game" ? { L: handColor("L"), R: handColor("R") } : c.pick === "custom" ? { L: c.L, R: c.R } : ledHandColors;
export const lightColorsNow = (): HandColors => colorsOf(colorChoiceNow());

export function LightColors() {
  const c = useSyncExternalStore(subscribeLightColors, colorChoiceNow, () => defaultChoice);
  const shown = colorsOf(c);
  const swatch = (hand: "L" | "R", name: string) => (
    <label className={kitChip(false).className} style={{ ...kitChip(false).style, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
      {name}
      <input
        type="color"
        data-testid={`light-color-${hand}`}
        aria-label={`${name} hand color`}
        value={shown[hand]}
        onChange={(e) => setChoice({ pick: "custom", ...shown, [hand]: e.target.value })}
        style={{ width: 32, height: 22, padding: 0, border: "none", background: "none", cursor: "pointer" }}
      />
    </label>
  );
  return (
    <span data-testid="light-colors" data-pick={c.pick} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {(["duo", "game", "custom"] as const).map((p) => (
        <button
          key={p}
          type="button"
          data-testid={`light-colors-${p}`}
          aria-pressed={c.pick === p}
          onClick={() => setChoice({ ...c, pick: p })}
          className={kitChip(c.pick === p).className}
          style={{ ...kitChip(c.pick === p).style, cursor: "pointer" }}
        >
          {pickNames[p]}
        </button>
      ))}
      {swatch("L", "Left")}
      {swatch("R", "Right")}
    </span>
  );
}

export function ConnectLights() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  useEffect(autoConnect, []);
  const idle = s === "off" || s === "no-board" || s === "error" || s === "elsewhere" || s === "blocked";
  return (
    <>
      <button
        type="button"
        data-testid="connect-lights"
        data-state={s}
        disabled={!idle}
        onClick={() => void connect()}
        className={kitChip(s === "ready").className}
        style={{ ...kitChip(s === "ready").style, cursor: idle ? "pointer" : "default", opacity: s === "unsupported" ? 0.6 : 1 }}
      >
        {s === "unsupported" ? noSerialReason() : label[s]}
      </button>
      {/* The picker lists the usual USB-serial chips; a board on another chip needs every port. */}
      {(s === "no-board" || s === "error") && (
        <button
          type="button"
          data-testid="connect-any-port"
          onClick={() => void connect(true)}
          className={kitChip(false).className}
          style={{ ...kitChip(false).style, cursor: "pointer", marginLeft: 8 }}
        >
          Board not listed? Every port
        </button>
      )}
    </>
  );
}

// The strip's brightness, while the board is on: it changes as you drag and is saved on the board when you let go.
export function LightBrightness() {
  const s = useSyncExternalStore(subscribe, linkState, () => "off" as LinkState);
  const b = useSyncExternalStore(subscribe, boardBrightness, () => null);
  if (s !== "ready" || b === null) return null;
  return (
    <label className={kitChip(false).className} style={{ ...kitChip(false).style, display: "flex", alignItems: "center", gap: 8 }}>
      Brightness
      <input
        type="range"
        data-testid="light-brightness"
        min={20}
        max={255}
        step={5}
        value={b}
        onChange={(e) => send(boardBrightnessTo(Number(e.target.value)))}
        // rippleLength(0) first, so a sustain pedal held while saving doesn't save its long ripples
        onPointerUp={() => [rippleLength(0), SAVE].forEach(send)}
        onKeyUp={() => [rippleLength(0), SAVE].forEach(send)}
        style={{ width: 120, cursor: "pointer" }}
      />
    </label>
  );
}
