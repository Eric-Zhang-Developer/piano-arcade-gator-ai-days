// The Record Waits for You (spec: record-follows, #1261): in Learn and Flow, a recording time-stretches, pitch kept, to
// follow the player (driver.ts), and in Learn it freezes while the clock holds at a note and resumes on the next
// correct one. The source is the local song's audio.json recording, or a synthetic one rendered from the chart
// (synth.ts) with &record=synthetic or when there's none. In Perform it's silent: audio-track plays the record as is.
import { createElement } from "react";
import type { Experiment } from "..";
import type { Chart, Frame, GamePlugin, InputDevice } from "../../../contracts";
import { getRecordingOffset, parseSidecar } from "../../audio-track";
import { msPerBeat } from "../../core/settings";
import { canvasFonts, MonoLabel } from "../../duo-tokens";
import { meterLayout } from "../../fever-gauge";
import { hudLayout, hudSettings } from "../../hud";
import { isFlowMode, onsetsOf } from "../../flow-mode/clock";
import { bg, ink, inkDim, line, primary } from "../../ui-tokens";
import { isWaitMode } from "../../wait-mode";
import { beatMap, detectOnsets, type BeatMap } from "./beatmap";
import { recordDriver } from "./driver";
import { renderSynthetic } from "./synth";
import { mono, stretchNode, type WorkletMessage } from "./worklet";

export const recordSettings = {
  holdMs: 80, // Learn's chart clock standing still this long, with the wall clock running: it holds at a note
  detectRate: 22050, // onsets are found at about this rate, the tests' (the render is decimated to it)
  windowN: 2048, // the vocoder's window: a seek starts this half a window early, so the first frame centres on the note
  fadeS: 0.08, // the record's fade out at the take's end
  chipPx: [12, 0.0085, 17], // min, share of the width, max: the DOM kitChip's clamp(12px, 0.85vw, 17px)
};

type Mode = "wait" | "flow" | "off";
const modeOf = (params: URLSearchParams): Mode => (isWaitMode(params) ? "wait" : isFlowMode(params) ? "flow" : "off");
const synthetic = (params: URLSearchParams) => params.get("record") === "synthetic" || !(params.get("song") ?? "").startsWith("local/");

// Every `step`-th sample, so a 44.1 or 48 kHz file meets the onset settings the tests tuned at 22.05 kHz.
const decimate = (x: Float32Array, step: number) => (step <= 1 ? x : x.filter((_, i) => i % step === 0));

// The chip's words: FOLLOWING · 0.82× while it plays, HELD while it waits for a note (before the first, and frozen).
export const chipText = (frozen: boolean, rate: number) => (frozen ? "HELD" : `FOLLOWING · ${rate.toFixed(2)}×`);

export function recordFollows(): GamePlugin {
  let mode: Mode = "off";
  let chart: Chart | null = null;
  let beats: number[] = [];
  const onsetOf = new Map<string, number>();
  const lastPress = new Map<number, number>();
  let audio: AudioContext | null = null;
  let gain: GainNode | null = null;
  let node: AudioWorkletNode | null = null;
  let driver: ReturnType<typeof recordDriver> | null = null;
  let map: BeatMap | null = null;
  let source = "";
  let load = 0;
  let paused = false;
  let begun = false; // a correct note has started the record this take
  let sent = { rate: 1, mode: "silent" as "silent" | "frozen" | "playing" };
  let still = { nowMs: NaN, wall: 0 };
  let lastDraw = 0;
  let loggedBeat = -Infinity;

  const post = (m: WorkletMessage) => node?.port.postMessage(m);
  const stop = () => {
    const [g, n] = [gain, node];
    [gain, node, driver] = [null, null, null];
    if (!g || !audio) return;
    g.gain.setTargetAtTime(0, audio.currentTime, recordSettings.fadeS / 3);
    setTimeout(() => (n?.disconnect(), g.disconnect()), recordSettings.fadeS * 1000 + 50);
  };

  // The recording's samples at the context's rate, and where it came from.
  const recording = async (c: Chart, params: URLSearchParams, ctx: AudioContext): Promise<{ samples: Float32Array; offsetS: number }> => {
    if (!synthetic(params)) {
      const dir = `/songs/${params.get("song")}/`;
      const s = parseSidecar(await fetch(`${dir}audio.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
      if (s) {
        const bytes = await fetch(new URL(s.src, new URL(dir, window.location.origin))).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${s.src}: ${r.status}`))));
        source = "this song's local recording";
        // the trim is the sidecar's offsetMs, moved by the player's Recording offset as audio-track moves it
        return { samples: mono(await ctx.decodeAudioData(bytes)), offsetS: (s.offsetMs + getRecordingOffset()) / 1000 };
      }
    }
    source = "a synthetic recording of this chart";
    const r = renderSynthetic(c, ctx.sampleRate);
    return { samples: r.samples, offsetS: r.offsetMs / 1000 };
  };

  return {
    id: "x-record-follows",
    transformChart(c, params) {
      stop();
      mode = modeOf(params);
      if (mode === "off") return c;
      chart = c;
      const onsets = onsetsOf(c);
      beats = onsets.map((o) => o.ms / msPerBeat(c.bpm));
      onsetOf.clear();
      onsets.forEach((o, k) => o.ids.forEach((id) => onsetOf.set(id, k)));
      [paused, begun, sent, still, loggedBeat] = [false, false, { rate: 1, mode: "silent" }, { nowMs: NaN, wall: 0 }, -Infinity];
      source = synthetic(params) ? "a synthetic recording of this chart" : "this song's local recording";
      try {
        audio ??= new AudioContext();
      } catch {
        return c; // no Web Audio: the take plays without the record
      }
      const token = ++load;
      const ctx = audio;
      void recording(c, params, ctx)
        .then(async ({ samples, offsetS }) => {
          if (token !== load) return;
          const step = Math.max(1, Math.round(ctx.sampleRate / recordSettings.detectRate));
          const m = beatMap(detectOnsets(decimate(samples, step), ctx.sampleRate / step), beats, c.bpm, offsetS);
          const g = ctx.createGain();
          g.connect(ctx.destination);
          const n = await stretchNode(ctx, samples, g);
          if (token !== load) return void (n.disconnect(), g.disconnect());
          [map, gain, node, driver] = [m, g, n, recordDriver(c, m, beats)];
          console.info(`record-follows: ${source}, ${(samples.length / ctx.sampleRate).toFixed(1)} s, ${beats.length} onsets mapped`);
        })
        .catch((e: Error) => console.warn(`record-follows: no record: ${e.message}`));
      return c;
    },
    wrapInput(input: InputDevice): InputDevice {
      if (mode === "off") return input;
      return {
        kind: input.kind,
        start: (on) =>
          input.start((e) => {
            if (e.type === "on") lastPress.set(e.pitch, e.timeMs);
            on(e);
          }),
        stop: () => input.stop(),
      };
    },
    onEvent(e) {
      if (mode === "off") return;
      if (e.type === "songStart") void audio?.resume().catch(() => {}); // Start is a click: the context may run from here
      else if (e.type === "noteHit") {
        const k = onsetOf.get(e.noteId);
        if (k === undefined || !driver) return;
        driver.played(k, lastPress.get(e.pitch) ?? performance.now());
        begun = true;
      } else if (e.type === "pause") {
        paused = true;
        driver?.hold(); // the next correct note after the pause restarts it at that note
      } else if (e.type === "resume") paused = false;
      else if (e.type === "quit" || e.type === "songEnd") stop();
    },
    draw(ctx: CanvasRenderingContext2D, f: Frame) {
      if (mode === "off" || !chart) return;
      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0, (now - (lastDraw || now)) / 1000));
      lastDraw = now;
      // Learn's clock holds at a note: the chart time stands while the wall runs.
      if (f.nowMs !== still.nowMs) still = { nowMs: f.nowMs, wall: now };
      const holding = mode === "wait" && now - still.wall > recordSettings.holdMs;
      if (driver && map && audio) {
        if (holding && !paused) driver.hold();
        const { rate, frozen, cmd } = driver.block(now, dt);
        if (cmd) post({ seek: Math.max(0, Math.round(cmd.seek * audio.sampleRate) - recordSettings.windowN / 2) });
        if (Math.abs(rate - sent.rate) > 1e-4) post({ rate: (sent.rate = rate) });
        // Flow has no freeze: a held record there is silent, as it is before the first note and while paused.
        const want = paused || !begun ? "silent" : !frozen ? "playing" : mode === "wait" ? "frozen" : "silent";
        if (want !== sent.mode) post({ mode: (sent.mode = want) });
        // The record-to-highway gap, each beat: the highway runs on the mode's clock, not the record's (spec Gaps).
        const beat = Math.floor(f.nowMs / msPerBeat(chart.bpm));
        if (begun && !frozen && beat !== loggedBeat) {
          loggedBeat = beat;
          console.info(`record-follows: beat ${beat}, record ${((map.beatAt(driver.pos) * msPerBeat(chart.bpm)) - f.nowMs).toFixed(0)} ms ahead of the highway at ${rate.toFixed(2)}×`);
        }
      }
      drawChip(ctx, f, driver?.frozen ?? true, driver?.rate ?? 1);
    },
    startPanel: ({ params }) =>
      createElement(
        MonoLabel,
        { style: { display: "block", maxWidth: "52ch", lineHeight: 1.6 } },
        modeOf(params) === "off"
          ? "The record follows you in Learn and Flow. In Perform it stays silent here: a local song's recording plays as it is."
          : `The record follows you: ${synthetic(params) ? "a synthetic recording of this chart" : "this song's local recording, or a synthetic one if it has none"}. ${modeOf(params) === "wait" ? "It holds when you stop and picks up on your next correct note." : "It bends to your tempo."}`,
      ),
  };
}

// The chip, under the fever gauge, its right edge on the HUD's (wait-hud's mode badge): the kit's chip drawn on canvas
// (Kit.tsx kitChip), lit while it follows, a hairline while it's held, with the ratio's place on a 0.5–1.5× rail under
// it, dim where it stopped while held. Nothing in it animates.
function drawChip(ctx: CanvasRenderingContext2D, f: Frame, frozen: boolean, rate: number) {
  const [lo, share, hi] = recordSettings.chipPx;
  const px = Math.round(Math.min(hi, Math.max(lo, f.width * share)));
  const text = chipText(frozen, rate);
  ctx.save();
  ctx.font = canvasFonts.data(px);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center"; // as the DOM chip: a steady width, its words centred in it
  const padX = px * 0.8;
  const h = Math.round(px * 2.2);
  const w = Math.round(Math.max(ctx.measureText(chipText(false, 1.5)).width, ctx.measureText(text).width) + padX * 2); // a steady width
  const band = hudLayout(f.width, f.judgmentLineY).panel.h;
  const x = Math.round(f.width - Math.max(10, band * 0.25) - hudSettings.statusGutterPx - w);
  const y = Math.round(meterLayout(f.width, f.judgmentLineY).bottom + 8);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  if (!frozen) {
    ctx.fillStyle = primary;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = frozen ? line : primary;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = frozen ? ink : primary;
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  // the rail: 0.5× at the left, 1× at the tick, 1.5× at the right
  const ry = y + h + Math.round(px * 0.6);
  ctx.fillStyle = bg;
  ctx.fillRect(x, ry - 5, w, 11);
  ctx.fillStyle = inkDim;
  ctx.fillRect(x, ry, w, 1);
  ctx.fillRect(Math.round(x + w / 2), ry - 3, 1, 7);
  ctx.fillStyle = frozen ? inkDim : primary; // held: where it stopped, dim
  ctx.fillRect(Math.round(x + (rate - 0.5) * w) - 2, ry - 5, 4, 11);
  ctx.restore();
}

export const recordFollowsX: Experiment = {
  name: "record-follows",
  title: "The Record Waits for You",
  group: "Wow",
  line: "A recording stretches to your tempo and holds when you stop (#1261)",
  issue: 1261,
  href: "/play?song=moonlight-1&mode=wait&x=record-follows&record=synthetic",
  plugin: recordFollows,
};
