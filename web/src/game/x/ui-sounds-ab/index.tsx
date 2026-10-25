// The menu sounds, old against new (spec: ui-sound-family, #1167): on /play's start screen, each UI sound before and
// after the celesta family, in this song's key, plus 20 fast moves for fatigue. Off by default; ?x=ui-sounds-ab.
import { createElement, useState } from "react";
import type { Experiment } from "..";
import { kitChip } from "../../duo-tokens";
import { getPrefs } from "../../sound";
import { keyOf, type Key, uiAudio, uiSound, type UiSound } from "../../ui-sounds";
import { playLegacy } from "./legacy";

const SOUNDS: [UiSound, string][] = [
  ["move", "MOVE"],
  ["confirm", "CONFIRM"],
  ["back", "BACK"],
  ["sting", "STING"],
  ["tick", "TICK"],
  ["tickAccent", "ACCENT"],
];
const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const MOVES = 20;
const FAST_MS = 50; // 20 moves a second: the pile-up's worst case

function play(which: "old" | "new", name: UiSound, key: Key, times = 1) {
  if (which === "new") {
    for (let i = 0; i < times; i++) uiSound(name, i * FAST_MS, { key });
    return;
  }
  if (getPrefs().muted) return; // as the new ones do
  const { ctx, out } = uiAudio();
  if (ctx.state === "suspended") void ctx.resume();
  for (let i = 0; i < times; i++) playLegacy(ctx, out, name, ctx.currentTime + (i * FAST_MS) / 1000);
}

function Panel({ k }: { k: Key }) {
  const [lit, setLit] = useState("");
  const label = (text: string) =>
    createElement("span", { style: { font: "700 clamp(12px, 0.85vw, 17px) var(--pa-font-mono, ui-monospace, monospace)", letterSpacing: "0.12em", color: "var(--pa-ink-dim)", minWidth: "6.5em" } }, text);
  const chip = (id: string, text: string, onClick: () => void) =>
    createElement("button", { key: id, type: "button", ...kitChip(lit === id), "aria-pressed": lit === id, onClick: () => (setLit(id), onClick()) }, text);
  const row = (name: UiSound, text: string, times = 1) =>
    createElement(
      "div",
      { key: text, style: { display: "flex", alignItems: "center", gap: 8 } },
      label(text),
      chip(`${text}-old`, "OLD", () => play("old", name, k, times)),
      chip(`${text}-new`, "NEW", () => play("new", name, k, times)),
    );
  return createElement(
    "div",
    { "data-testid": "x-ui-sounds-ab-panel", style: { display: "grid", gap: 10 } },
    createElement("span", { style: { font: "700 clamp(12px, 0.85vw, 17px) var(--pa-font-mono, ui-monospace, monospace)", letterSpacing: "0.12em", color: "var(--pa-ink)" } }, `MENU SOUNDS · IN ${NAMES[k.tonic]} ${k.mode.toUpperCase()}`),
    ...SOUNDS.map(([name, text]) => row(name, text)),
    row("move", `${MOVES} MOVES`, MOVES),
  );
}

export const uiSoundsAb: Experiment = {
  name: "ui-sounds-ab",
  title: "Menu sounds A/B",
  group: "Polish",
  line: "The menu sounds, old against new (#1167)",
  issue: 1167,
  href: "/play?song=twinkle&x=ui-sounds-ab",
  plugin: () => ({
    id: "x-ui-sounds-ab",
    startPanel: ({ chart }) => createElement(Panel, { k: keyOf(chart.notes.map((n) => n.pitch)) }),
  }),
};
