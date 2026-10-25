import type { Chart, GamePlugin, InputDevice, InputEvent, TakeEvent } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { KEYS_VELOCITY, loadLatencyOffset } from "../core/settings";
import { gaugeSize } from "../fever-gauge/gauge";
import { seededRandom } from "../sim/fake";
import { toast } from "../notice-toast";
import { pianoOutSettings } from "../piano-out";
import { readTakeMidi } from "../take-midi";

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
  velocity?: number; // a take's own; the scripted bots press at KEYS_VELOCITY
}

// ?bot=take&take=<file>: a take file under /takes/ (hero-replay). Only a plain name: nothing outside /takes/.
export const TAKE_FILE = /^[\w.-]+\.mid$/;

// A read take's presses, each with its own velocity and hold, in time order.
export const takePresses = (events: TakeEvent[]): Press[] =>
  events
    .map((e) => ({ pitch: e.pitch, timeMs: e.timeMs, holdMs: (e.offTimeMs ?? e.timeMs + pianoOutSettings.heldMs) - e.timeMs, velocity: e.velocity }))
    .sort((a, b) => a.timeMs - b.timeMs);

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
  let bot: BotName | "take" | null = null;
  let takeFile = "";
  let take: Press[] | null = null; // bot=take's presses, once read
  let loading: Promise<Press[] | null> | null = null;
  let audible = false;
  let chart: Chart | null = null;
  let emit: ((e: InputEvent) => void) | null = null; // the bot device's handler, while it runs
  let out: MIDIOutput | null = null;
  let zeroPerf: number | null = null; // chart clock 0, in performance.now() time
  let pumpPerf: number | null = null; // when this frame's pump ran: just before /play read its clock
  let fromMs = -Infinity; // after a resume, only what is still ahead
  let latency = 0;
  // The presses and releases still to send, in time order, each at its chart time. A timer sends each on time, so a
  // piano hears it on time; the pump sends whatever a starved timer hasn't yet (#586).
  let queue: { atMs: number; type: InputEvent["type"]; pitch: number; velocity?: number; sent: boolean }[] = [];
  let next = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const cancel = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    [queue, next] = [[], 0];
  };
  // /play judges arrival - zero - latency, so an event's time is read from the best zero so far, when it's sent.
  const perfOf = (chartMs: number) => zeroPerf! + latency + chartMs;
  const fire = (e: (typeof queue)[number]) => {
    if (e.sent || !emit) return;
    e.sent = true;
    const velocity = e.type === "on" ? (e.velocity ?? KEYS_VELOCITY) : 0;
    emit({ type: e.type, pitch: e.pitch, velocity, timeMs: perfOf(e.atMs) });
    out?.send([0x90, e.pitch, velocity]);
  };
  // Run from a frame callback queued during /play's frame, so it runs before /play's next one: every event due by now
  // reaches the judge before that frame sweeps late notes to MISS. On a starved page each frame is a long task and
  // Chrome runs frames ahead of timers; a timer alone kept a press past its note's window (MISS plus an extra).
  const pump = () => {
    pumpPerf = performance.now();
    if (zeroPerf === null) return;
    while (next < queue.length && perfOf(queue[next].atMs) <= pumpPerf) fire(queue[next++]);
  };
  const play = () => {
    cancel();
    if (!bot || !chart || !emit || zeroPerf === null) return;
    if (bot === "take" && !take) return; // still reading: start() plays once it has
    latency = loadLatencyOffset();
    for (const p of bot === "take" ? take! : botPresses(chart, bot)) {
      if (p.timeMs >= fromMs) queue.push({ atMs: p.timeMs, type: "on", pitch: p.pitch, velocity: p.velocity, sent: false });
      if (p.timeMs + p.holdMs >= fromMs) queue.push({ atMs: p.timeMs + p.holdMs, type: "off", pitch: p.pitch, sent: false });
    }
    queue.sort((a, b) => a.atMs - b.atMs); // stable: a press before its own release at the same time, as the timers were
    for (const e of queue) timers.push(setTimeout(() => fire(e), perfOf(e.atMs) - performance.now()));
  };

  // bot=take: read the file once, for both devices. Refused -> a toast, and the take plays normally.
  const loadTake = () =>
    (loading ??= (async () => {
      try {
        const res = await fetch(`/takes/${takeFile}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const r = readTakeMidi(new Uint8Array(await res.arrayBuffer()), chart!);
        if ("error" in r) throw new Error(r.error);
        if (!r.marker) toast(`Take ${takeFile} has no bar-1 marker (saved before hero-replay): its tick 0 is read as beat 0.`);
        return (take = takePresses(r.events));
      } catch (e) {
        bot = null;
        toast(`Take ${takeFile} can't be replayed: ${(e as Error).message}. Playing normally.`);
        return null;
      }
    })());

  return {
    id: "scenes",
    transformChart(c, params) {
      const name = params.get("bot");
      bot = isBot(name) ? name : null;
      audible = params.get("audible") === "1";
      zeroPerf = null;
      [take, loading] = [null, null];
      if (name === "take") {
        takeFile = params.get("take") ?? "";
        if (TAKE_FILE.test(takeFile)) bot = "take";
        else toast(`Take "${takeFile}" isn't a file name in /takes/ (like fur-elise-20261024-1900.mid). Playing normally.`);
      } else if (name !== null && !bot) toast(`Unknown bot "${name}". Bots: ${BOTS.join(", ")}, take. Playing normally.`);
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
      if (!bot) return;
      requestAnimationFrame(pump);
      if (pumpPerf === null) return; // the first frame: no pump has run yet
      // Chart zero, from the frame clock. The pump ran just before /play read its clock, so pumpPerf - nowMs is under
      // the judge's zero by about a callback's dispatch. performance.now() here would be over it by every draw before
      // this one: tens of ms on a starved page, every press judged that much late. Through the count-in the
      // estimate rises to the best one seen; from the first note wait mode's holds move the clock, and zero stays put.
      const estimate = pumpPerf - f.nowMs;
      pumpPerf = null;
      if (zeroPerf === null) {
        zeroPerf = estimate;
        play();
      } else if (f.nowMs < 0 && estimate > zeroPerf) zeroPerf = estimate;
    },
    wrapInput(device) {
      if (bot === "take" && device.kind === "midi") return silentWhileReplaying(device, loadTake);
      if (!bot || device.kind !== "keys") return device;
      let live = false; // bot=take refused: the laptop keys play
      return {
        kind: "test",
        async start(onEvent) {
          if (bot === "take" && !(await loadTake())) {
            live = true;
            return device.start(onEvent);
          }
          out = audible ? await pianoOutput() : null;
          emit = onEvent;
          play(); // in case the first frame came first
        },
        stop() {
          cancel();
          emit = null;
          if (live) device.stop();
        },
      };
    },
  };
}

// bot=take: the MIDI input says nothing while a take replays, so a touched key or the piano's echo of the replayed
// notes can't change it. If the take is refused, it's the live input again.
function silentWhileReplaying(device: InputDevice, loadTake: () => Promise<Press[] | null>): InputDevice {
  let live = false;
  return {
    ...device,
    async start(onEvent) {
      if (await loadTake()) return;
      live = true;
      return device.start(onEvent);
    },
    stop() {
      if (live) device.stop();
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
