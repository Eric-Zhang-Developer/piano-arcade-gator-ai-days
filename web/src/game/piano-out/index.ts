// Piano out: replay the last take on the piano (spec: piano-out). The plugin records the take from the input it
// wraps; ReplayOnPiano (on the results screen) plays it back through the piano's MIDI output.
import { createElement, type CSSProperties } from "react";
import type { GamePlugin, InputDevice, Take, TakeEvent } from "../../contracts";
import { ReplayOnPiano } from "./ReplayOnPiano";
import { scoringVersion } from "../core/sustain";

export const pianoOutSettings = {
  leadMs: 200, // from pressing Replay to the first note
  heldMs: 300, // a note whose release never arrived
  lookaheadMs: 300, // messages are handed to Chrome this far ahead, so Stop leaves at most this much queued
};

export interface Message {
  bytes: number[];
  atMs: number; // performance.now() time
}

const LOCAL = (on: boolean): number[] => [0xb0, 122, on ? 127 : 0];
// All Notes Off on all 16 channels.
export const allNotesOff = (atMs: number): Message[] => [...Array(16).keys()].map((ch) => ({ bytes: [0xb0 + ch, 123, 0], atMs }));

// Pure: the whole replay. Local Control off first, the take's notes on channel 1 with their real gaps and velocities
// from startMs + leadMs, then All Notes Off and Local Control back on once the last note ends.
export function replayMessages(take: Take, startMs: number): Message[] {
  const { leadMs, heldMs } = pianoOutSettings;
  const events = take.events.filter((e) => e.velocity > 0 && ((take.scoringVersion ?? 1) < 2 || e.offTimeMs !== null && e.offTimeMs > e.timeMs));
  const out: Message[] = [{ bytes: LOCAL(false), atMs: startMs }];
  if (!events.length) return [...out, ...allNotesOff(startMs), { bytes: LOCAL(true), atMs: startMs }];
  const t0 = Math.min(...events.map((e) => e.timeMs));
  const at = (t: number) => startMs + leadMs + (t - t0);
  let end = startMs;
  for (const e of events) {
    const off = at(e.offTimeMs ?? e.timeMs + heldMs);
    out.push({ bytes: [0x90, e.pitch, e.velocity], atMs: at(e.timeMs) }, { bytes: [0x80, e.pitch, 0], atMs: off });
    end = Math.max(end, off);
  }
  // At equal times a release goes first, so a re-pressed key sounds again instead of being cut.
  out.sort((a, b) => a.atMs - b.atMs || (a.bytes[0] === 0x80 ? -1 : 0) - (b.bytes[0] === 0x80 ? -1 : 0));
  return [...out, ...allNotesOff(end), { bytes: LOCAL(true), atMs: end }];
}

// Shared with ReplayOnPiano through useSyncExternalStore.
export interface ReplayState {
  take: Take | null; // the last finished take
  canReplay: boolean; // a piano output exists and the take has notes
  playing: boolean;
}
let state: ReplayState = { take: null, canReplay: false, playing: false };
const listeners = new Set<() => void>();
const set = (next: Partial<ReplayState>) => {
  state = { ...state, ...next };
  listeners.forEach((f) => f());
};
export const getReplayState = () => state;
export const subscribeReplay = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};

let output: MIDIOutput | null = null;
let queue: Message[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function pump() {
  const until = performance.now() + pianoOutSettings.lookaheadMs;
  while (queue.length && queue[0].atMs <= until) {
    const m = queue.shift()!;
    output?.send(m.bytes, m.atMs);
  }
  if (!queue.length) {
    if (timer) clearInterval(timer);
    timer = null;
    set({ playing: false });
  }
}

export function startReplay(): void {
  if (!output || !state.take || state.playing) return;
  queue = replayMessages(state.take, performance.now());
  set({ playing: true });
  pump();
  timer ??= setInterval(pump, 50);
}

// Ends a replay at once. Anything already handed to Chrome may still sound, so All Notes Off goes out again after
// the lookahead, as beat-track does; then Local Control comes back on.
export function stopReplay(): void {
  if (timer) clearInterval(timer);
  timer = null;
  queue = [];
  if (output) {
    const now = performance.now();
    for (const m of [...allNotesOff(now), ...allNotesOff(now + pianoOutSettings.lookaheadMs)]) output.send(m.bytes, m.atMs);
    output.send(LOCAL(true), now + pianoOutSettings.lookaheadMs);
  }
  set({ playing: false });
}

const replayStyle: CSSProperties = {
  padding: "12px 32px",
  fontSize: 20,
  borderRadius: 8,
  border: "none",
  background: "#ddd",
  color: "#000",
  cursor: "pointer",
};

export function pianoOut(): GamePlugin {
  let events: TakeEvent[] = [];
  let zero = 0; // performance.now() at songStart, moved later by each pause so the replay has no gap
  let pausedAt = 0;
  let recording = false;
  let chartId = "";
  let inputKind: Take["inputDevice"] = "keys";
  let params = new URLSearchParams();
  let pausedChart: number | null = null;
  const active = new Map<number, number>();

  const record = (input: InputDevice): InputDevice => ({
    kind: input.kind,
    start: (onEvent) =>
      input.start((e) => {
        if (recording) {
          const timeMs = pausedChart ?? e.timeMs - zero;
          if (e.type === "on" && pausedChart === null) {
            if (!events.length) inputKind = input.kind;
            const previous = active.get(e.pitch);
            if (scoringVersion(params) >= 2 && previous !== undefined) events[previous].offTimeMs = Math.max(events[previous].timeMs, timeMs);
            events.push({ pitch: e.pitch, velocity: e.velocity, timeMs, offTimeMs: null });
            active.set(e.pitch, events.length - 1);
          }
          else {
            if (e.type === "on") return onEvent(e);
            const index = active.get(e.pitch);
            const held = scoringVersion(params) >= 2 ? index === undefined ? undefined : events[index] : events.findLast((x) => x.pitch === e.pitch && x.offTimeMs === null);
            active.delete(e.pitch);
            if (held && !(scoringVersion(params) >= 2 && e.cancelled)) held.offTimeMs = Math.max(held.timeMs, timeMs);
          }
        }
        onEvent(e);
      }),
    stop: () => input.stop(),
  });

  return {
    id: "piano-out",
    transformChart(chart, p) {
      params = p;
      chartId = chart.id;
      if (typeof window !== "undefined") {
        window.addEventListener("pagehide", stopReplay); // never leave the piano's keys silent
        navigator.requestMIDIAccess?.()
          .then((access) => {
            output = [...access.outputs.values()].find((o) => o.name?.includes("Portable Grand")) ?? null;
          })
          .catch(() => {
            output = null; // no MIDI: the button stays hidden
          });
      }
      return chart;
    },
    wrapInput(input) {
      inputKind = input.kind;
      return record(input);
    },
    onEvent(e) {
      if (e.type === "songStart") {
        if (state.playing) stopReplay();
        events = [];
        active.clear();
        pausedChart = null;
        zero = (scoringVersion(params) >= 2 ? e.performanceMs ?? performance.now() : performance.now()) - e.atMs;
        recording = true;
        set({ take: null, canReplay: false });
      }
      // play-slots: keys while paused aren't part of the take, and the pause isn't replayed as silence.
      if (e.type === "pause" || e.type === "quit") {
        if (state.playing) stopReplay();
        if (e.type === "quit" || scoringVersion(params) < 2) recording = false;
        else pausedChart = e.atMs;
        pausedAt = performance.now();
      }
      if (e.type === "resume") {
        zero = scoringVersion(params) >= 2 ? (e.performanceMs ?? performance.now()) - e.atMs : zero + performance.now() - pausedAt;
        pausedChart = null;
        recording = true;
      }
      if (e.type === "songEnd") {
        recording = false;
        const take: Take = { ...(scoringVersion(params) >= 2 ? { scoringVersion: scoringVersion(params) } : {}), chartId, startedAt: new Date().toISOString(), latencyOffsetMs: 0, inputDevice: inputKind, events };
        set({ take, canReplay: !!output && events.length > 0 });
      }
    },
    // "Replay on piano" on the results screen, only when there's a piano to replay on.
    resultsPanel: () => (state.canReplay ? createElement(ReplayOnPiano, { style: replayStyle }) : null),
  };
}
