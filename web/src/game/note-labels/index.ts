// Note labels (spec: note-labels): letter names, or the laptop letter that plays each key, on the keys and the falling
// notes, drawn on the plugin's own layer. Core doesn't change: it reads the frame, the chart and the input devices.
import { createElement } from "react";
import type { Chart, Frame, GamePlugin, InputDevice } from "../../contracts";
import { msPerBeat, settings } from "../core/settings";
import { LabelToggle } from "./LabelToggle";
import {
  LABELS_KEY,
  fitsLane,
  fontPxFor,
  labelMode,
  labelSetting,
  labelSettings,
  laptopLetters,
  noteName,
  type LabelSetting,
} from "./labels";

export { fitsLane, labelMode, labelSetting, laptopLetters, noteName } from "./labels";

const DARK = "#16161a"; // on white keys, lit keys and notes (both hand colors and the miss grey are light)
const LIGHT = "#e8e8ec"; // on unlit black keys
const FONT = "system-ui, sans-serif";

declare global {
  interface Window {
    __pianoArcadeLabels?: { setting: LabelSetting; mode: string }; // read by verify-labels.mjs
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LABELS_KEY);
  } catch {
    return null;
  }
}

function store(s: LabelSetting): void {
  try {
    localStorage.setItem(LABELS_KEY, s);
  } catch {
    // storage blocked: the setting still holds for this page
  }
}

// One label centered at (cx, y), only if it fits the lane.
function text(ctx: CanvasRenderingContext2D, s: string, cx: number, y: number, lane: number, px: number, color: string): void {
  ctx.font = `700 ${px}px ${FONT}`;
  if (!fitsLane(ctx.measureText(s).width, lane)) return;
  ctx.fillStyle = color;
  ctx.fillText(s, cx, y);
}

export function noteLabels(): GamePlugin {
  let setting: LabelSetting = "auto";
  let midiPlayed = false;
  let perspective = false;
  let chart: Chart | null = null;
  let letters = new Map<number, string>();
  const hit = new Set<string>();
  const pressed = new Set<number>();

  const mode = () => labelMode(setting, midiPlayed);
  const publish = () => {
    if (typeof window !== "undefined") window.__pianoArcadeLabels = { setting, mode: mode() };
  };
  const label = (pitch: number) => (mode() === "notes" ? noteName(pitch) : (letters.get(pitch) ?? ""));

  function drawKeys(ctx: CanvasRenderingContext2D, f: Frame): void {
    const kbH = f.height - f.judgmentLineY;
    for (let p = f.lowPitch; p <= f.highPitch; p++) {
      const s = label(p);
      if (!s) continue;
      const k = f.keyX(p);
      const px = fontPxFor(k.width);
      const black = [1, 3, 6, 8, 10].includes(p % 12);
      const bottom = black ? f.judgmentLineY + kbH * 0.62 : f.height; // a black key is 62% of the keyboard's height
      text(ctx, s, k.x + k.width / 2, bottom - px * 0.9, k.width, px, black && !pressed.has(p) ? LIGHT : DARK);
    }
  }

  // Each note's label sits just above its white head, inside the note, so it never covers the head.
  function drawNotes(ctx: CanvasRenderingContext2D, f: Frame, c: Chart): void {
    const line = f.judgmentLineY;
    const pxPerMs = line / settings.lookaheadMs;
    const beatMs = msPerBeat(c.bpm);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, f.width, line);
    ctx.clip();
    for (const n of c.notes) {
      if (hit.has(n.id)) continue; // consumed on hit, as the highway draws it
      const startMs = n.beat * beatMs;
      const yBottom = line - (startMs - f.nowMs) * pxPerMs;
      const yTop = line - (startMs + n.duration * beatMs - f.nowMs) * pxPerMs;
      if (yBottom < 0 || yTop > line) continue;
      const k = f.keyX(n.pitch);
      const lane = k.width * 0.84; // the highway insets each note 8% each side
      if (lane < labelSettings.minLaneForNotesPx) continue;
      const s = label(n.pitch);
      if (!s) continue;
      const px = fontPxFor(lane);
      const y = yBottom - 1 - settings.noteHeadPx - 2 - px / 2;
      const top = Math.min(yTop + settings.noteGapPx, yBottom - settings.noteHeadPx * 2);
      if (y - px / 2 < top) continue; // too short to hold a label above its head
      text(ctx, s, k.x + k.width / 2, y, lane, px, DARK);
    }
    ctx.restore();
  }

  return {
    id: "note-labels",
    transformChart(c, params) {
      chart = c;
      setting = labelSetting(params.get("labels"), readStored());
      perspective = Number(params.get("perspective")) > 0;
      letters = laptopLetters(Math.min(...c.notes.map((n) => n.pitch))); // the same lowest pitch /play gives keysDevice
      publish();
      return c;
    },
    wrapInput(device): InputDevice {
      return {
        ...device,
        start(onEvent) {
          return device.start((e) => {
            if (e.type === "on") {
              pressed.add(e.pitch);
              if (device.kind === "midi" && !midiPlayed) {
                midiPlayed = true;
                publish();
              }
            } else pressed.delete(e.pitch);
            onEvent(e);
          });
        },
      };
    },
    onEvent(e) {
      if (e.type === "songStart") hit.clear();
      if (e.type === "noteHit") hit.add(e.noteId);
    },
    draw(ctx, frame) {
      if (mode() === "off") return;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (chart && !perspective) drawNotes(ctx, frame, chart);
      drawKeys(ctx, frame);
    },
    startPanel: () =>
      createElement(LabelToggle, {
        initial: setting,
        onChange: (s: LabelSetting) => {
          setting = s;
          store(s);
          publish();
        },
      }),
  };
}
