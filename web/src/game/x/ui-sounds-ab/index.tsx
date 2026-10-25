// The menu sounds, old against new (spec: ui-sound-family, #1167): on /play's start screen, each UI sound before and
// after the celesta family, in this song's key, plus 20 fast moves for fatigue. Off by default; ?x=ui-sounds-ab.
import { createElement, useMemo, useState } from "react";
import type { Experiment } from "..";
import { kitChip } from "../../duo-tokens";
import { getPrefs } from "../../sound";
import { keyOf, type Key, UI_PEAK, uiAudio, uiSound, type UiSound } from "../../ui-sounds";
import { inkDim, primary } from "../../ui-tokens";
import { playLegacy } from "./legacy";
import { renderNew, renderOld, SR } from "./measure";

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
// The traces: each sound's envelope on one shared scale, so the level drop and the softer attack show as they sound.
const TRACE = { w: 160, h: 28, floorDb: -60 };

// Peak per column over spanS, in dB against the old sounds' peak, floor at the bottom. An SVG path, 0..w by 0..h.
function trace(x: Float32Array, spanS: number): string {
  const cols = TRACE.w;
  const per = (spanS * SR) / cols;
  const pts: string[] = [];
  for (let c = 0; c < cols; c++) {
    let m = 0;
    for (let i = Math.floor(c * per); i < Math.min(x.length, Math.floor((c + 1) * per)); i++) m = Math.max(m, Math.abs(x[i]));
    const db = m > 0 ? Math.max(TRACE.floorDb, 20 * Math.log10(m / UI_PEAK)) : TRACE.floorDb;
    pts.push(`${c},${(TRACE.h * db) / TRACE.floorDb}`);
  }
  return `M0,${TRACE.h} L${pts.join(" L")} L${cols},${TRACE.h}`;
}

// Old and new on one axis: old filled grey behind, new in blue on top, so the drop and the shape read at a glance.
const Trace = ({ old, neu }: { old: string; neu: string }) =>
  createElement(
    "svg",
    { viewBox: `0 0 ${TRACE.w} ${TRACE.h}`, preserveAspectRatio: "none", "aria-hidden": true, style: { display: "block", width: "100%", height: "clamp(22px, 1.7vw, 36px)", background: "rgba(125, 132, 150, 0.06)" } },
    createElement("path", { d: old, fill: inkDim, fillOpacity: 0.45 }),
    createElement("path", { d: neu, fill: primary, fillOpacity: 0.3, stroke: primary, strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" }),
  );

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
  // Each row on its own time axis, the longer of its two sounds, so a 30 ms blip isn't a sliver of a 0.8 s sting's axis.
  const traces = useMemo(
    () =>
      Object.fromEntries(
        SOUNDS.map(([n]) => {
          const [o, w] = [renderOld(n), renderNew(n, k)];
          const spanS = Math.max(o.length, w.length) / SR;
          return [n, { old: trace(o, spanS), new: trace(w, spanS) }];
        }),
      ),
    [k],
  );
  const mono = (color: string) => ({ font: "700 clamp(12px, 0.85vw, 17px) var(--pa-font-data), ui-monospace, monospace", letterSpacing: "0.12em", color });
  const chip = (id: string, text: string, onClick: () => void) =>
    createElement("button", { type: "button", ...kitChip(lit === id), "aria-pressed": lit === id, onClick: () => (setLit(id), onClick()) }, text);
  const row = (name: UiSound, text: string, times = 1) =>
    createElement(
      "div",
      { key: text, role: "group", "aria-label": text, style: { display: "grid", gridTemplateColumns: "7em auto auto minmax(8em, 1fr)", alignItems: "center", columnGap: 8 } },
      createElement("span", { style: mono(inkDim) }, text),
      chip(`${text}-old`, "OLD", () => play("old", name, k, times)),
      chip(`${text}-new`, "NEW", () => play("new", name, k, times)),
      times === 1 ? createElement(Trace, { old: traces[name].old, neu: traces[name].new }) : createElement("span", { style: mono(inkDim) }, "20 A SECOND"),
    );
  return createElement(
    "div",
    { "data-testid": "x-ui-sounds-ab-panel", style: { display: "grid", gap: 10 } },
    createElement(
      "span",
      { style: mono("var(--pa-ink)") },
      `MENU SOUNDS · IN ${NAMES[k.tonic]} ${k.mode.toUpperCase()} · `,
      createElement("span", { style: { color: inkDim } }, "OLD"),
      " / ",
      createElement("span", { style: { color: primary } }, "NEW"),
    ),
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
