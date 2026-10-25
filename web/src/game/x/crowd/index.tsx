// Crowd Mode (spec: crowd, #1345): while you play, the room claps along, and the laptop mic scores the room's timing
// apart from yours. On /play with ?x=crowd: the start panel opens the mic on a press; the worklet (worklet.ts) finds
// claps; score.ts puts them on the chart's beat grid; a CROWD meter under the HUD band, a tick on the hit line per clap
// and a results line show it. The room's score never reaches the judge, the HUD's score or the take: wrapInput passes
// every event through untouched and only reads note-on times. The mic audio stays in the worklet; nothing is stored
// or sent.
import { useState, useSyncExternalStore } from "react";
import type { Frame, GamePlugin, InputDevice } from "../../../contracts";
import type { Experiment } from "..";
import { Button, MonoLabel } from "../../duo-tokens";
import { canvasFonts, drawPanel } from "../../duo-tokens/canvas";
import { hudLayout } from "../../hud";
import { ink, inkDim, line, primary, sun } from "../../ui-tokens";
import { roomLine, scoreRoom, scoreSettings, type RoomScore } from "./score";
import { loadWorklet, workletName, type FromWorklet, type ToWorklet } from "./worklet";

export const crowdUi = {
  // The mic as raw as the browser gives it: echo cancellation, noise suppression and AGC all smear or pump onsets
  // (decision crowd-onsets: mic constraints).
  constraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } satisfies MediaTrackConstraints,
  meterW: 0.16, // of the width
  meterH: 0.56, // of the HUD band's height
  meterGap: 8, // px under the band
  meterTauMs: 300, // the bar eases to the share with this time constant
  rulerHalf: 0.12, // of the width: the hit line's tick ruler, ±rulerMs
  rulerMs: 120,
  tickMs: 1200, // a tick fades over this
  tickRise: 14, // px it rises as it fades
  rulerLift: 28, // px above the hit line, clear of the keys' lit edge
  rulerAt: 1280, // the width the ruler's px sizes are set at
  pollMs: 250, // leaving /play is noticed this often
};

// Context seconds and performance.now() ms, both ways, from the output's timestamp pair.
const toPerf = (ctx: AudioContext, s: number) => {
  const t = ctx.getOutputTimestamp();
  return (t.performanceTime ?? performance.now()) + (s - (t.contextTime ?? ctx.currentTime)) * 1000;
};
const toCtx = (ctx: AudioContext, ms: number) => {
  const t = ctx.getOutputTimestamp();
  return (t.contextTime ?? ctx.currentTime) + (ms - (t.performanceTime ?? performance.now())) / 1000;
};

let motionQuery: MediaQueryList | undefined;
const reducedMotion = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

interface Mic {
  stop(): void;
  ctx: AudioContext;
  node: AudioWorkletNode;
  latencyMs: number; // the mic's own capture latency, when the browser reports it
}

async function openMic(onClap: (perfMs: number) => void): Promise<Mic> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: crowdUi.constraints });
  const ctx = new AudioContext();
  try {
    await loadWorklet(ctx);
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, workletName, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = ctx.createGain();
    mute.gain.value = 0; // silent: a node runs while it's pulled to the destination
    src.connect(node).connect(mute).connect(ctx.destination);
    const latencyMs = ((stream.getAudioTracks()[0]?.getSettings() as { latency?: number }).latency ?? 0) * 1000;
    node.port.onmessage = ({ data }: MessageEvent<FromWorklet>) => onClap(toPerf(ctx, data.clap) - latencyMs);
    const stop = () => {
      node.port.onmessage = null;
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
    };
    return { stop, ctx, node, latencyMs };
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
    throw e;
  }
}

// The room's state for one take, and the drawing. Exported for the tests: claps go in as chart ms.
export function crowdRoom(bpm: number, beatsPerBar: number) {
  let claps: number[] = [];
  let score: RoomScore = scoreRoom([], bpm, beatsPerBar);
  const ticks: { atPerf: number; err: number }[] = [];
  return {
    clap(chartMs: number, atPerf: number) {
      claps.push(chartMs);
      score = scoreRoom(claps, bpm, beatsPerBar);
      ticks.push({ atPerf, err: score.errors[score.errors.length - 1] });
      while (ticks.length > 64) ticks.shift();
    },
    reset() {
      claps = [];
      score = scoreRoom([], bpm, beatsPerBar);
      ticks.length = 0;
    },
    get score() {
      return score;
    },
    ticks,
  };
}

export const crowd: Experiment = {
  name: "crowd",
  title: "Crowd Mode",
  group: "Wow",
  line: "The room claps along, and the laptop mic scores the room's timing apart from yours (#1345)",
  issue: 1345,
  href: "/play?song=twinkle&x=crowd",
  plugin: (): GamePlugin => {
    let mic: Mic | null = null;
    let simulated = false; // the checks' stand-in for a live mic: no stream is opened
    const live = () => !!mic || simulated;
    let opening = false;
    let room = crowdRoom(120, 4);
    let running = false;
    let heard = false; // the mic was on during this take: the results say the room's line
    let last: RoomScore | null = null;
    let map: { perf: number; chart: number } | null = null; // the last frame's clocks
    let shown = 0; // the meter's eased share
    let shownAt = 0;
    let leave: ReturnType<typeof setInterval> | null = null;
    const listeners = new Set<() => void>();
    const changed = () => listeners.forEach((f) => f());

    const stop = () => {
      mic?.stop();
      mic = null;
      simulated = false;
      if (leave) clearInterval(leave);
      leave = null;
      if (typeof window !== "undefined") window.removeEventListener("pagehide", stop);
      changed();
    };
    const onClap = (perf: number) => {
      if (!running || !map) return;
      room.clap(map.chart + (perf - map.perf), perf);
    };
    const open = async () => {
      if (mic || opening) return;
      opening = true;
      changed();
      try {
        mic = await openMic(onClap);
        window.addEventListener("pagehide", stop);
        const path = location.pathname;
        leave = setInterval(() => location.pathname !== path && stop(), crowdUi.pollMs);
      } finally {
        opening = false;
        changed();
      }
    };

    const subscribe = (f: () => void) => {
      listeners.add(f);
      return () => void listeners.delete(f);
    };
    const state = () => (live() ? "on" : opening ? "opening" : "off");
    // For the checks and the look loop: the room as if the mic were on, and claps fed in on the worklet's path.
    if (typeof window !== "undefined")
      (window as unknown as { __crowd?: unknown }).__crowd = {
        listen() {
          simulated = true;
          changed();
        },
        clap: (perfMs = performance.now()) => onClap(perfMs),
        get score() {
          return room.score;
        },
      };
    function Panel() {
      const now = useSyncExternalStore(subscribe, state, () => "off");
      const [error, setError] = useState<string | null>(null);
      if (now === "on")
        return (
          <MonoLabel>
            <span aria-hidden style={{ display: "inline-block", width: "0.6em", height: "0.6em", borderRadius: "50%", background: sun, marginRight: "0.5em" }} />
            MIC ON · LISTENING FOR THE ROOM&apos;S CLAPS
          </MonoLabel>
        );
      return (
        <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
          <Button kind="secondary" disabled={now === "opening"} onClick={() => open().catch((e: Error) => setError(e.name === "NotAllowedError" ? "The mic wasn't allowed, so there's no room to hear." : "The mic didn't open."))} data-testid="crowd-mic">
            Listen to the room
          </Button>
          <MonoLabel>Mic audio stays in memory. Nothing is recorded or sent.</MonoLabel>
          {error && <p role="alert" style={{ margin: 0, color: ink }}>{error}</p>}
        </div>
      );
    }

    return {
      id: "x-crowd",
      transformChart(c) {
        room = crowdRoom(c.bpm, c.beatsPerBar);
        return c;
      },
      // Reads note-on times for the detector's raised threshold; every event goes on exactly as it came.
      wrapInput: (d: InputDevice): InputDevice => ({
        ...d,
        start: (onEvent) =>
          d.start((e) => {
            if (e.type === "on" && mic) mic.node.port.postMessage({ noteOn: toCtx(mic.ctx, e.timeMs) } satisfies ToWorklet);
            onEvent(e);
          }),
        stop: () => d.stop(),
      }),
      onEvent(e) {
        if (e.type === "songStart") {
          room.reset();
          running = live();
          heard = live();
          last = null;
        } else if (e.type === "pause") running = false;
        else if (e.type === "resume") running = live();
        else if (e.type === "songEnd" || e.type === "quit") {
          running = false;
          last = room.score;
          stop();
        }
      },
      draw(ctx, f) {
        map = { perf: performance.now(), chart: f.nowMs };
        if (!live() && !running) return;
        drawRoom(ctx, f, room, map.perf, (target) => {
          const dt = Math.max(0, map!.perf - shownAt);
          shownAt = map!.perf;
          shown = reducedMotion() ? target : shown + (target - shown) * (1 - Math.exp(-dt / crowdUi.meterTauMs));
          return shown;
        });
      },
      startPanel: () => <Panel />,
      resultsPanel: () =>
        heard && last ? (
          <p data-testid="crowd-results" style={{ margin: 0 }}>
            <MonoLabel dim={false}>{roomLine(last)}</MonoLabel>
          </p>
        ) : null,
    };
  },
};

// The meter under the HUD band's right end, and a tick per clap on the hit line: left early, right late.
function drawRoom(ctx: CanvasRenderingContext2D, f: Frame, room: ReturnType<typeof crowdRoom>, now: number, ease: (share: number) => number) {
  const u = crowdUi;
  const band = hudLayout(f.width, f.judgmentLineY).panel.h;
  const h = Math.round(band * u.meterH);
  const w = Math.round(f.width * u.meterW);
  const x = f.width - w - 16;
  const y = band + u.meterGap;
  const r = room.score;
  const still = reducedMotion();
  drawPanel(ctx, x, y, w, h);
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = canvasFonts.data(Math.round(h * 0.3));
  ctx.fillStyle = inkDim;
  ctx.fillText("CROWD", x + 10, y + h / 2);
  ctx.font = canvasFonts.numeral(Math.round(h * 0.62));
  ctx.fillStyle = ink;
  ctx.textAlign = "right";
  ctx.fillText(r.claps ? `${Math.round(r.share * 100)}%` : "—", x + w - 10, y + h / 2);
  if (!still) {
    // the bar: the eased on-beat share, along the panel's foot
    ctx.fillStyle = primary;
    ctx.fillRect(x + 1, y + h - 4, (w - 2) * ease(r.share), 3);
  }
  ctx.restore();
  if (still) return;
  // the hit line's ruler, lifted clear of the keys' edge: a hairline over ±rulerMs with a centre notch, brackets at the
  // ±on-beat bound, and each clap a tick that rises and fades
  const cx = f.width / 2;
  const half = f.width * u.rulerHalf;
  const px = half / u.rulerMs;
  const k = f.width / u.rulerAt; // the ruler's pixel sizes are set at 1280 wide and scale with the canvas
  const ly = f.judgmentLineY - Math.round(u.rulerLift * k);
  const n = (v: number) => Math.max(1, Math.round(v * k));
  ctx.save();
  ctx.fillStyle = line;
  ctx.fillRect(Math.round(cx - half), ly, Math.round(2 * half), 1);
  ctx.fillRect(Math.round(cx), ly - n(4), 1, 2 * n(4) + 1);
  // named for the meter it belongs to, so the ticks don't read as the player's
  ctx.font = canvasFonts.data(n(10));
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.fillStyle = inkDim;
  ctx.fillText("ROOM", Math.round(cx - half) - n(8), ly);
  for (const s of [-1, 1]) {
    const bx = Math.round(cx + s * scoreSettings.onBeatMs * px);
    ctx.fillRect(bx, ly - n(8), 1, 2 * n(8) + 1);
    ctx.fillRect(s < 0 ? bx : bx - n(4), ly - n(8), n(5), 1); // the bracket's foot, turned in
    ctx.fillRect(s < 0 ? bx : bx - n(4), ly + n(8), n(5), 1);
  }
  for (const t of room.ticks) {
    const age = (now - t.atPerf) / u.tickMs;
    if (age < 0 || age >= 1) continue;
    const tx = cx + Math.max(-half, Math.min(half, t.err * px));
    ctx.globalAlpha = 1 - age * age;
    ctx.fillStyle = Math.abs(t.err) <= scoreSettings.onBeatMs ? ink : inkDim;
    ctx.fillRect(Math.round(tx) - n(1), ly - n(10) - age * u.tickRise * k, n(3), n(20));
  }
  ctx.restore();
}
