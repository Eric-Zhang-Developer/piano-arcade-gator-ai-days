// The Harmony Map (spec: harmony-map, #1299): its pages are /harmony and /harmony/all; on /play, ?x=harmony-map draws
// the live panel in the empty lanes beside the chart's own, never over a lane the song uses. A live player's pedal
// doesn't reach it (core input drops CC); a bot take's comes from the song's pedal.json.
import { createElement } from "react";
import type { Experiment } from "..";
import type { Chart, Frame, GamePlugin, InputDevice } from "../../../contracts";
import { msPerBeat } from "../../core/settings";
import { kitButton } from "../../duo-tokens";
import { meterLayout } from "../../fever-gauge";
import { loadPedal, type Pedal } from "../../pedal";
import { drawPanel, liveHarmony } from "./live";

export const cornerSettings = {
  minW: 140, // narrower room than this beside the lanes: no panel (logged once)
  maxShare: 0.24, // of the width
  gap: 12,
};

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// The panel's box: the wider side of empty lanes outside the chart's lowest and highest notes, or null.
export function cornerBox(f: Pick<Frame, "width" | "judgmentLineY" | "keyX">, lo: number, hi: number, top: number, s = cornerSettings) {
  const left = f.keyX(lo).x;
  const right = f.width - (f.keyX(hi).x + f.keyX(hi).width);
  const room = Math.max(left, right) - 2 * s.gap;
  const w = Math.min(room, f.width * s.maxShare, 360);
  if (w < s.minW) return null;
  const h = Math.min(w * 0.75, f.judgmentLineY - top - s.gap);
  return { x: left >= right ? s.gap : f.width - s.gap - w, y: top, w, h };
}

export function harmonyPlugin(): GamePlugin {
  let live = liveHarmony();
  let chart: Chart | null = null;
  let range = { lo: 60, hi: 72 };
  let pedal: Pedal | null = null;
  let pedalDown = false;
  let told = false;
  return {
    id: "x-harmony-map",
    transformChart(c, params) {
      [chart, live, pedal, pedalDown, told] = [c, liveHarmony(), null, false, false];
      const ps = c.notes.map((n) => n.pitch);
      range = { lo: Math.min(...ps), hi: Math.max(...ps) };
      if (params.has("bot")) void loadPedal(params.get("song") ?? c.id).then((p) => (pedal = p));
      return c;
    },
    wrapInput(input: InputDevice): InputDevice {
      return {
        kind: input.kind,
        start: (on) =>
          input.start((e) => {
            if (e.type === "on") live.press(e.pitch, performance.now());
            else live.release(e.pitch, performance.now());
            on(e);
          }),
        stop: () => input.stop(),
      };
    },
    draw(ctx: CanvasRenderingContext2D, f: Frame) {
      if (!chart) return;
      const now = performance.now();
      if (pedal) {
        const beat = f.nowMs / msPerBeat(chart.bpm);
        const down = pedal.some(([d, u]) => d <= beat && beat < u);
        if (down !== pedalDown) live.pedal((pedalDown = down), now);
      }
      const box = cornerBox(f, range.lo, range.hi, meterLayout(f.width, f.judgmentLineY).bottom + cornerSettings.gap);
      if (!box) {
        if (!told) console.info("harmony-map: no empty lanes wide enough beside this song's for the panel");
        told = true;
        return;
      }
      drawPanel(ctx, box, live, now, reduced());
    },
    resultsPanel: ({ chart: c }) => createElement("a", { ...kitButton("secondary"), href: `/harmony?song=${encodeURIComponent(c.id)}` }, "This song's harmony map"),
  };
}

export const harmonyMap: Experiment = {
  name: "harmony-map",
  title: "The Harmony Map",
  group: "Wow",
  line: "Chords light triangles on Euler's Tonnetz, and every song becomes a constellation (#1299)",
  issue: 1299,
  href: "/harmony?song=moonlight-1",
  plugin: harmonyPlugin,
};
