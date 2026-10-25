// Hand palette (spec: hand-palette, #1127): the hand and judgment colors three ways, A (today), B and C, with a
// colour-blind simulation, on /play: ?x=hand-palette&p=A|B|C&sim=normal|protan|deutan|tritan. It changes no token: it
// overrides the exported settings objects the readers look up at draw time, and puts them back when the take ends
// (decision hand-palette-override). Left-hand notes also get a notch, so the hands differ by shape as well as color.
import { createElement } from "react";
import type { Chart, Frame } from "../../../contracts";
import type { Experiment } from "..";
import { msPerBeat, settings } from "../../core/settings";
import { isBlack } from "../../core/highway";
import { kitChip } from "../../duo-tokens";
import { meterSettings } from "../../fever-gauge";
import { handColorSettings, hasBothHands } from "../../hand-colors";
import { hudSettings } from "../../hud";
import { juiceSettings } from "../../juice";
import { pillRect } from "../../note-pills";
import { candidateOf, candidates, type Candidate, type Palette } from "./candidates";
import { hexToRgb, MACHADO, type Vision, visions } from "./color";

export const paletteSettings = {
  notchWidth: 0.42, // of the pill's width: the swallowtail cut into a left-hand note's leading end
  notchDepthPx: 7, // at 720 px tall, scaled with the canvas height; about the white head's depth
  notchColor: "#000", // the field: the cut reads as a hole in the note, not a mark on it
};

// The settings objects a candidate writes, as they are before it does.
function snapshot() {
  return {
    hands: { ...handColorSettings.colors },
    judgments: { ...hudSettings.judgmentColors },
    meter: meterSettings.fill,
    juice: juiceSettings.feverColor,
  };
}
type Snapshot = ReturnType<typeof snapshot>;

const rgbTriple = (hex: string) => hexToRgb(hex).map((v) => Math.round(v * 255)).join(", ");

export function apply(p: Palette): void {
  handColorSettings.colors.R = p.R;
  handColorSettings.colors.L = p.L;
  Object.assign(hudSettings.judgmentColors, { PERFECT: p.PERFECT, GREAT: p.GREAT, GOOD: p.GOOD, MISS: p.MISS, wrong: p.WRONG });
  meterSettings.fill = p.AMBER;
  juiceSettings.feverColor = rgbTriple(p.AMBER);
}

export function restore(s: Snapshot): void {
  Object.assign(handColorSettings.colors, s.hands);
  Object.assign(hudSettings.judgmentColors, s.judgments);
  meterSettings.fill = s.meter;
  juiceSettings.feverColor = s.juice;
}

export const visionOf = (sim: string | null): Vision => (visions as string[]).includes(sim ?? "") ? (sim as Vision) : "normal";

// The Machado matrix as an feColorMatrix's 20 values. SVG filters work in linearRGB by default, which is where the
// paper's matrices apply, and the filter says so explicitly.
export const matrixValues = (v: Exclude<Vision, "normal">): string =>
  [...MACHADO[v].flatMap((row) => [...row, 0, 0]), 0, 0, 0, 1, 0].join(" ");

const FILTER_ID = "x-hand-palette-sim";

function mountFilter(v: Exclude<Vision, "normal">): () => void {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("style", "position:absolute;width:0;height:0");
  const filter = document.createElementNS(ns, "filter");
  filter.id = FILTER_ID;
  filter.setAttribute("color-interpolation-filters", "linearRGB");
  const m = document.createElementNS(ns, "feColorMatrix");
  m.setAttribute("type", "matrix");
  m.setAttribute("values", matrixValues(v));
  filter.append(m);
  svg.append(filter);
  document.body.append(svg);
  const filtered = new Set<HTMLCanvasElement>();
  const timer = setInterval(() => {
    // /play mounts its canvases after the start screen, and a scene can add one: keep every one filtered while on.
    for (const c of document.querySelectorAll("canvas")) {
      if (filtered.has(c)) continue;
      c.style.filter = `url(#${FILTER_ID})`;
      filtered.add(c);
    }
  }, 250);
  return () => {
    clearInterval(timer);
    for (const c of filtered) c.style.filter = "";
    svg.remove();
  };
}

// Where each left-hand note's leading end is this frame, as the highway places the pill (core/highway.ts, perspective
// off, as note-labels assumes too).
export function notches(chart: Chart, f: Frame, hit: Set<string>): { cx: number; y: number; half: number }[] {
  const line = f.judgmentLineY;
  const pxPerMs = line / settings.lookaheadMs;
  const beatMs = msPerBeat(chart.bpm);
  const out: { cx: number; y: number; half: number }[] = [];
  for (const n of chart.notes) {
    if (n.hand !== "L" || hit.has(n.id)) continue;
    const yBottom = line - (n.beat * beatMs - f.nowMs) * pxPerMs;
    if (yBottom < 0 || yBottom > line) continue;
    const pill = pillRect(f.keyX(n.pitch), isBlack(n.pitch));
    out.push({ cx: pill.x + pill.width / 2, y: yBottom - 1, half: (pill.width * paletteSettings.notchWidth) / 2 });
  }
  return out;
}

function Picker({ c, v }: { c: Candidate; v: Vision }) {
  const href = (p: string, sim: string) => {
    if (typeof location === "undefined") return "#";
    const q = new URLSearchParams(location.search);
    q.set("p", p);
    if (sim === "normal") q.delete("sim");
    else q.set("sim", sim);
    return `${location.pathname}?${q}`;
  };
  const row = (label: string, items: [string, string, boolean, string?][], testid: string) =>
    createElement(
      "div",
      { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }, "data-testid": testid },
      createElement("span", { style: { font: "700 clamp(12px, 0.85vw, 17px) var(--pa-font-data), ui-monospace, monospace", letterSpacing: "0.12em", color: "var(--pa-ink-dim)", minWidth: "6.5em" } }, label),
      ...items.map(([text, to, lit, title]) => createElement("a", { key: text, ...kitChip(lit), href: to, title, "aria-current": lit ? "true" : undefined }, text)),
    );
  // The hands larger and first, then the judgments and fever's amber: the pair this experiment is about leads.
  const swatch = (slot: string, hex: string, em: number) =>
    createElement("span", { key: slot, title: `${slot} ${hex}`, style: { display: "inline-block", width: `${em}em`, height: `${em}em`, background: hex, outline: "1px solid var(--pa-line)" } });
  const p = c.palette;
  const swatches = [
    swatch("Right hand", p.R, 1.5),
    swatch("Left hand", p.L, 1.5),
    createElement("span", { key: "gap", style: { width: "0.75em" } }),
    ...(["PERFECT", "GREAT", "GOOD", "MISS", "WRONG", "AMBER"] as const).map((k) => swatch(k === "AMBER" ? "Fever" : k, p[k], 1)),
  ];
  return createElement(
    "div",
    { "data-testid": "x-hand-palette-panel", style: { display: "grid", gap: 10 } },
    row("PALETTE", Object.values(candidates).map((k) => [`${k.id} · ${k.short}`, href(k.id, v), k.id === c.id, k.name]), "x-hand-palette-p"),
    row("SEE AS", visions.map((s) => [s.toUpperCase(), href(c.id, s), s === v]), "x-hand-palette-sim"),
    createElement("div", { style: { display: "flex", alignItems: "flex-end", gap: 6 }, role: "img", "aria-label": `Palette ${c.id}, ${c.name}: ${Object.entries(p).map(([k, h]) => `${k} ${h}`).join(", ")}` }, ...swatches),
  );
}

export const handPalette: Experiment = {
  name: "hand-palette",
  title: "Hand palette",
  group: "Polish",
  line: "The hand and judgment colors, three ways, with a colour-blind simulation (#1127)",
  issue: 1127,
  href: "/play?song=fur-elise&bot=perfect&x=hand-palette&p=A",
  plugin: () => {
    let saved: Snapshot | null = null;
    let unfilter: (() => void) | null = null;
    let leave: ReturnType<typeof setInterval> | null = null;
    let chart: Chart | null = null;
    let both = false;
    let cand = candidates.A;
    let vision: Vision = "normal";
    const hit = new Set<string>();
    const off = () => {
      if (saved) restore(saved);
      saved = null;
      unfilter?.();
      unfilter = null;
      if (leave) clearInterval(leave);
      leave = null;
      if (typeof window !== "undefined") window.removeEventListener("pagehide", off);
    };
    const on = () => {
      saved = snapshot();
      apply(cand.palette);
      if (typeof window === "undefined") return;
      window.addEventListener("pagehide", off);
      if (vision !== "normal") unfilter = mountFilter(vision);
      // Leaving /play ends no take when it's from the start screen, so neither songEnd nor quit comes (#1324): any
      // route off this path puts today's colours back. ponytail: a 250 ms poll, as audio-track's; a route event if
      // /play ever gets one.
      const path = location.pathname;
      leave = setInterval(() => location.pathname !== path && off(), 250);
    };
    return {
      id: "x-hand-palette",
      transformChart(c, params) {
        off();
        chart = c;
        both = hasBothHands(c);
        hit.clear();
        cand = candidateOf(params.get("p"));
        vision = visionOf(params.get("sim"));
        on();
        return c;
      },
      onEvent(e) {
        if (e.type === "songStart") {
          hit.clear();
          if (!saved && chart) on(); // a Retry starts a take with no transformChart: the candidate goes back on (#1325)
        }
        else if (e.type === "noteHit") hit.add(e.noteId);
        else if (e.type === "songEnd" || e.type === "quit") off();
      },
      draw(ctx, f) {
        if (!chart || !both || !saved) return;
        const depth = (paletteSettings.notchDepthPx * f.height) / 720;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, f.width, f.judgmentLineY);
        ctx.clip();
        ctx.fillStyle = paletteSettings.notchColor;
        ctx.beginPath();
        for (const n of notches(chart, f, hit)) {
          ctx.moveTo(n.cx - n.half, n.y + 0.5);
          ctx.lineTo(n.cx, n.y - depth);
          ctx.lineTo(n.cx + n.half, n.y + 0.5);
          ctx.closePath();
        }
        ctx.fill();
        ctx.restore();
      },
      startPanel: () => createElement(Picker, { c: cand, v: vision }),
    };
  },
};
