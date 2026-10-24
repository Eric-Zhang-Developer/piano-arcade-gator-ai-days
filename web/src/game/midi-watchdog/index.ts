import type { Chart, GamePlugin, InputEvent } from "../../contracts";
import { noteTimeMs } from "../core/judge";
import { toast } from "../notice-toast";

export const watchdogSettings = {
  stallMs: 3000, // spec: no message of any kind for 3 s while connected (once Active Sensing has been seen)
  fallbackMs: 10_000, // spec Defaults: no MIDI for 10 s while notes are due (while Active Sensing hasn't been seen)
  checkMs: 50, // fine enough that a 3.1 s gap is caught before the next message lands
};

export interface WatchdogEntry {
  kind: "stall" | "recovered" | "disconnected" | "connected";
  atPerfMs: number; // performance.now()
  detail: string;
}

// Toasts (notice-toast): one when a state starts and one when it ends.
export const DISCONNECTED = "Piano disconnected: laptop keys active";
export const CONNECTED = "Piano connected";
export const RECONNECTING = "Reconnecting MIDI";
export const RECONNECTED = "MIDI reconnected";

// Chrome's MIDI input twice went silent for minutes in the spike (RESULTS.md, Unknowns). This wraps core's MIDI
// device: on a stall it re-requests MIDI access and reopens the port by starting core's device again.
// Whether the DGX-660's Active Sensing reaches Chrome is unmeasured, so the 3 s rule only arms once a 0xFE has been
// seen on the port; until then a stall is 10 s without MIDI while chart notes fall due.
export function midiWatchdog(): GamePlugin & { log: WatchdogEntry[] } {
  const log: WatchdogEntry[] = []; // for the results screen
  let chart: Chart | null = null;
  let zeroPerf: number | null = null; // chart clock 0 in performance.now() time, while a song plays
  let notice = ""; // the lasting state: RECONNECTING, DISCONNECTED or none
  let paused = false; // play-slots' pause: silence is the player waiting, not a stall
  let resumedAt = -Infinity; // performance.now() of the last resume; silence before it doesn't count

  const record = (kind: WatchdogEntry["kind"], detail: string) => {
    const e = { kind, atPerfMs: performance.now(), detail };
    log.push(e);
    console.info(`midi-watchdog: ${kind} at ${e.atPerfMs.toFixed(0)} ms: ${detail}`);
  };
  const notesDue = (from: number, to: number) =>
    chart !== null &&
    zeroPerf !== null &&
    chart.notes.some((n) => {
      const t = zeroPerf! + noteTimeMs(chart!, n);
      return t > from && t <= to;
    });

  return {
    id: "midi-watchdog",
    log,
    transformChart(c) {
      chart = c;
      return c;
    },
    onEvent(e) {
      if (e.type === "songStart" || e.type === "resume") zeroPerf = performance.now() - e.atMs; // the clock stood still
      if (e.type === "songEnd" || e.type === "quit") zeroPerf = null;
      if (e.type === "pause") paused = true;
      if (e.type === "resume") resumedAt = performance.now();
      if (e.type === "songStart" || e.type === "resume" || e.type === "quit") paused = false;
    },
    wrapInput(device) {
      if (device.kind !== "midi") return device;
      let access: MIDIAccess | null = null;
      let port: MIDIInput | null = null;
      let timer: ReturnType<typeof setInterval> | undefined;
      let last = 0; // performance.now() of the last message of any kind
      let sensing = false; // a 0xFE has arrived on this port
      let deliver: (e: InputEvent) => void = () => {};
      let active = false;
      let generation = 0;

      const onRaw = (m: Event) => {
        last = performance.now();
        if ((m as MIDIMessageEvent).data?.[0] === 0xfe) sensing = true;
        if (notice !== RECONNECTING) return;
        notice = "";
        record("recovered", "a MIDI message arrived");
        toast(RECONNECTED);
      };
      const onState = (e: Event) => {
        const p = (e as MIDIConnectionEvent).port;
        if (!p || p.id !== port?.id) return;
        if (p.state === "disconnected" && notice !== DISCONNECTED) {
          notice = DISCONNECTED; // laptop keys are always on in /play; this says so
          record("disconnected", `${p.name} unplugged`);
          toast(DISCONNECTED);
        } else if (p.state === "connected" && notice === DISCONNECTED) {
          notice = "";
          last = performance.now(); // silence while unplugged isn't a stall
          record("connected", `${p.name} plugged back in`);
          toast(CONNECTED);
          void reconnect();
        }
      };
      // Same port pick as core: the DGX-660, else the first input. Watches raw messages, which core filters.
      async function attach(run = generation) {
        if (!navigator.requestMIDIAccess) return;
        try {
          const a = await navigator.requestMIDIAccess();
          if (!active || run !== generation) return;
          const inputs = [...a.inputs.values()];
          const p = inputs.find((i) => i.name?.includes("Portable Grand")) ?? inputs[0] ?? null;
          port?.removeEventListener("midimessage", onRaw);
          access?.removeEventListener("statechange", onState);
          access = a;
          port = p;
          a.addEventListener("statechange", onState);
          p?.addEventListener("midimessage", onRaw);
          await p?.open();
        } catch {
          // core already shows the MIDI error on its status line
        }
      }
      // Core's start re-requests access and swaps its handler onto the port in one assignment: no gap. If Chrome
      // hands back a new port object, the old one's handler can still fire, so deliver() drops exact repeats.
      async function reconnect() {
        const run = generation;
        if (!active) return;
        await device.start(deliver);
        if (!active || run !== generation) return;
        await attach(run);
      }
      function check() {
        if (!port || port.state !== "connected" || paused) return;
        const now = performance.now();
        const silent = now - Math.max(last, resumedAt);
        const stalled = sensing ? silent >= watchdogSettings.stallMs : silent >= watchdogSettings.fallbackMs && notesDue(last, now);
        if (!stalled) return;
        record("stall", `no MIDI for ${Math.round(silent)} ms${sensing ? "" : " while notes were due"}; reconnecting`);
        if (notice !== RECONNECTING) toast(RECONNECTING); // a still-silent port retries; it says so once
        notice = RECONNECTING;
        last = now; // a still-silent port retries after another full window
        void reconnect();
      }

      return {
        kind: device.kind,
        async start(onEvent) {
          active = true;
          const run = ++generation;
          const seen = new Map<string, number>();
          deliver = (e) => {
            const key = `${e.type}:${e.pitch}:${e.timeMs}`;
            if (seen.has(key)) return;
            seen.set(key, e.timeMs);
            for (const [k, t] of seen) if (t < e.timeMs - 1000) seen.delete(k);
            onEvent(e);
          };
          await device.start(deliver);
          if (!active || run !== generation) return;
          await attach(run);
          if (!active || run !== generation) return;
          last = performance.now();
          timer = setInterval(check, watchdogSettings.checkMs);
        },
        stop() {
          active = false;
          generation++;
          clearInterval(timer);
          port?.removeEventListener("midimessage", onRaw);
          access?.removeEventListener("statechange", onState);
          port = null;
          access = null;
          notice = "";
          device.stop();
        },
      };
    },
  };
}
