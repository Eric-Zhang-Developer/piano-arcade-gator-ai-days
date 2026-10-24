import type { Chart, GamePlugin, InputEvent } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { KEYS_VELOCITY, loadLatencyOffset } from "../core/settings";
import { gaugeSize } from "../fever-gauge/gauge";
import { seededRandom } from "../sim/fake";

export const scenesSettings = {
  seed: 118,
  holdMs: 100, // how long a bot holds each key (shorter for notes closer together)
  lateMs: 40, // `late`: every note GREAT, late
  offsets: { PERFECT: 0, GREAT: 40, GOOD: 75 }, // a bot's offset for each judgment, sign seeded
  sloppy: { GREAT: 0.2, GOOD: 0.15, MISS: 0.1, wrong: 3 }, // fractions of notes; `wrong` is a count
  // Each rank bot's mix lands mid-band on Twinkle: accuracy = (PERFECT + 0.5 GREAT + 0.25 GOOD) / (notes + WRONG).
  ranks: {
    "rank-a": { GREAT: 0.16 }, // 1 - 0.5 × 0.16 ≈ 0.92
    "rank-b": { GREAT: 0.1, MISS: 0.1 }, // ≈ 0.85
    "rank-c": { GREAT: 0.1, MISS: 0.2 }, // ≈ 0.75
    "rank-d": { GREAT: 0.1, MISS: 0.4 }, // ≈ 0.55
  } as Record<string, Partial<Record<"GREAT" | "GOOD" | "MISS", number>>>,
  feverExtra: 10, // `fever` repeats the chart until it holds the fever gauge's size plus this many notes
};

export const BOTS = ["perfect", "late", "sloppy", "rank-a", "rank-b", "rank-c", "rank-d", "fever"] as const;
export type BotName = (typeof BOTS)[number];

export interface Press {
  pitch: number;
  timeMs: number; // chart clock
  holdMs: number;
}

// `fever`: the chart end to end, each copy starting on the bar after the last one ends, until it is long enough to
// fill the fever gauge and hold fever. Only existing notes, re-timed; most charts need no copy.
export function feverChart(chart: Chart): Chart {
  const bars = Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / chart.beatsPerBar);
  const copyBeats = bars * chart.beatsPerBar;
  const n = chart.notes.length;
  let copies = 1;
  while (copies * n < gaugeSize(copies * n) + scenesSettings.feverExtra) copies++;
  const notes = Array.from({ length: copies }, (_, k) =>
    chart.notes.map((n) => ({ ...n, id: k ? `${n.id}~${k + 1}` : n.id, beat: n.beat + k * copyBeats })),
  ).flat();
  return { ...chart, notes };
}

// Pure and deterministic: what the named bot presses on this chart.
export function botPresses(chart: Chart, name: BotName): Press[] {
  const s = scenesSettings;
  const r = seededRandom(s.seed);
  const n = chart.notes.length;
  const times = chart.notes.map((note) => noteTimeMs(chart, note));
  const order = chart.notes.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  // Pick which notes get which judgment: a seeded shuffle, then the mix's counts off the front.
  const judgments: ("PERFECT" | "GREAT" | "GOOD" | "MISS")[] = Array(n).fill("PERFECT");
  const mix = name === "sloppy" ? s.sloppy : name === "late" ? { GREAT: 1 } : (s.ranks[name] ?? {});
  const shuffled = [...order].sort(() => r() - 0.5);
  let at = 0;
  for (const j of ["GREAT", "GOOD", "MISS"] as const) {
    const count = Math.round((mix[j] ?? 0) * n);
    for (const i of shuffled.slice(at, at + count)) judgments[i] = j;
    at += count;
  }
  const presses: Press[] = [];
  order.forEach((i, k) => {
    const j = judgments[i];
    if (j === "MISS") return;
    const sign = name === "late" ? 1 : r() < 0.5 ? -1 : 1;
    const offset = name === "late" ? s.lateMs : sign * s.offsets[j];
    const next = order[k + 1] === undefined ? Infinity : times[order[k + 1]] - times[i];
    presses.push({ pitch: chart.notes[i].pitch, timeMs: times[i] + offset, holdMs: Math.min(s.holdMs, next * 0.6) });
  });
  if (name === "sloppy") {
    // WRONG notes: a pitch the chart never uses, between notes, so they break the combo without stealing a hit.
    const pitches = new Set(chart.notes.map((x) => x.pitch));
    const wrongPitch = [...Array(128).keys()].find((p) => p >= 21 && !pitches.has(p) && p > Math.min(...pitches))!;
    for (let w = 1; w <= s.sloppy.wrong; w++) {
      const k = Math.floor((w / (s.sloppy.wrong + 1)) * (order.length - 1));
      const t = (times[order[k]] + times[order[k + 1]]) / 2;
      presses.push({ pitch: wrongPitch, timeMs: t, holdMs: 50 });
    }
    presses.sort((a, b) => a.timeMs - b.timeMs);
  }
  return presses;
}

const isBot = (v: string | null): v is BotName => BOTS.includes(v as BotName);

// ?bot=<name>: a scripted player replaces the laptop keys (MIDI stays live). Fever, full combo and every rank can be
// shown on demand, for verify screenshots, video B-roll and later features' Validation. Core doesn't change.
export function scenes(): GamePlugin {
  let bot: BotName | null = null;
  let audible = false;
  let chart: Chart | null = null;
  let emit: ((e: InputEvent) => void) | null = null; // the bot device's handler, while it runs
  let out: MIDIOutput | null = null;
  let zeroPerf: number | null = null; // chart clock 0, in performance.now() time
  let fromMs = -Infinity; // after a resume, only what is still ahead
  const timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
  };
  const at = (perfMs: number, f: () => void) => timers.push(setTimeout(f, perfMs - performance.now()));
  const send = (type: InputEvent["type"], pitch: number, timeMs: number) => {
    const velocity = type === "on" ? KEYS_VELOCITY : 0;
    emit?.({ type, pitch, velocity, timeMs });
    out?.send([0x90, pitch, velocity]);
  };
  const play = () => {
    cancel();
    if (!bot || !chart || !emit || zeroPerf === null) return;
    const shift = zeroPerf + loadLatencyOffset(); // /play judges arrival - zero - latency
    for (const p of botPresses(chart, bot)) {
      const on = shift + p.timeMs;
      const off = on + p.holdMs;
      if (p.timeMs >= fromMs) at(on, () => send("on", p.pitch, on));
      if (p.timeMs + p.holdMs >= fromMs) at(off, () => send("off", p.pitch, off));
    }
  };

  return {
    id: "scenes",
    transformChart(c, params) {
      const name = params.get("bot");
      bot = isBot(name) ? name : null;
      audible = params.get("audible") === "1";
      zeroPerf = null;
      if (name !== null && !bot) notice(`Unknown bot "${name}". Bots: ${BOTS.join(", ")}. Playing normally.`);
      chart = bot === "fever" ? feverChart(c) : c;
      return chart;
    },
    onEvent(e) {
      if (e.type === "songStart" || e.type === "resume") {
        // Chart zero comes from the next frame, not from now - atMs: /play builds the stage between fixing its zero
        // and emitting songStart, so that estimate runs late by the build time (~20 ms, a GREAT turned GOOD).
        zeroPerf = null;
        fromMs = e.type === "resume" ? e.atMs : -Infinity;
        cancel();
      } else if (e.type === "pause" || e.type === "quit" || e.type === "songEnd") cancel();
    },
    draw(_ctx, f) {
      if (!bot || zeroPerf !== null) return;
      zeroPerf = performance.now() - f.nowMs;
      play();
    },
    wrapInput(device) {
      if (!bot || device.kind !== "keys") return device;
      return {
        kind: "test",
        async start(onEvent) {
          out = audible ? await pianoOutput() : null;
          emit = onEvent;
          play(); // in case the first frame came first
        },
        stop() {
          cancel();
          emit = null;
        },
      };
    },
  };
}

// The piano, found the way beat-track finds it. Local Control is left alone, so a demo sounds like someone playing.
async function pianoOutput(): Promise<MIDIOutput | null> {
  try {
    const access = await navigator.requestMIDIAccess();
    return [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
  } catch {
    return null;
  }
}

function notice(text: string) {
  if (typeof document === "undefined") return;
  document.querySelector('[data-testid="scenes-notice"]')?.remove();
  const el = document.createElement("div");
  el.setAttribute("data-testid", "scenes-notice");
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    padding: "8px 12px",
    background: "rgba(0, 0, 0, 0.85)",
    border: "1px solid #a66",
    borderRadius: "6px",
    color: "#fcc",
    font: "14px system-ui, sans-serif",
    zIndex: "900",
  });
  document.body.appendChild(el);
}
