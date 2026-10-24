// A virtual DGX-660 behind the standard Web MIDI interfaces. Every default cites spikes/piano-midi/RESULTS.md;
// anything the spike didn't measure stays null and is labeled "unmeasured".

export interface SimProfile {
  portName: string;
  manufacturer: string;
  keyChannel: number; // 1–16
  timestampResolutionMs: number;
  activeSensingMs: number | null; // null: none sent
  extraInputs: string[]; // other inputs listed before the piano, e.g. "IAC Driver Bus 1"
  jitterMs: number; // ± per message; 0 is off
  seed: number;
}

export const DEFAULT_PROFILE: SimProfile = {
  portName: "Portable Grand",
  manufacturer: "Yamaha Corporation",
  keyChannel: 1,
  timestampResolutionMs: 1,
  activeSensingMs: null,
  extraInputs: [],
  jitterMs: 0,
  seed: 1,
};

// Shown on /sim next to each value.
export const PROFILE_SOURCES: { label: string; value: string; source: string }[] = [
  { label: "Ports", value: "1 in, 1 out: Portable Grand (Yamaha Corporation)", source: "RESULTS R1" },
  { label: "Key channel", value: "1", source: "RESULTS R2" },
  { label: "Release", value: "note-on, velocity 0 (no 0x8n seen)", source: "RESULTS R2" },
  { label: "Sustain pedal", value: "CC 64 as a ramp, on channels 1 and 2", source: "RESULTS R2" },
  { label: "Timestamps", value: "1 ms resolution; chord notes may share one", source: "RESULTS R3" },
  { label: "Echo", value: "none: output never reaches the input", source: "RESULTS R7" },
  { label: "Active Sensing", value: "unmeasured (none sent)", source: "RESULTS R2: the spike filtered it" },
  { label: "Unplug in Chrome", value: "unmeasured: the port stays listed, disconnected", source: "not tested" },
];

export interface TimelineEntry {
  timeMs: number;
  bytes: number[];
  note?: string; // carried to the log, e.g. "gap capped"
}

// What the sim did, for the /sim log.
export type SimLog =
  | { kind: "message"; timeStamp: number; bytes: number[]; note?: string }
  | { kind: "state"; timeStamp: number; state: MIDIPortDeviceState }
  | { kind: "fault"; timeStamp: number; text: string };

// mulberry32: a seeded random source, so jitter repeats in tests.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function event<T extends object>(type: string, props: T): Event & T {
  const e = new Event(type);
  for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v });
  return e as Event & T;
}

class SimPort extends EventTarget {
  id: string;
  version = "sim";
  state: MIDIPortDeviceState = "connected";
  connection: MIDIPortConnectionState = "closed";
  onstatechange: ((e: Event) => void) | null = null;
  onmidimessage: ((e: MIDIMessageEvent) => void) | null = null;
  sent: { data: Uint8Array; timestamp?: number }[] = [];
  constructor(
    public type: MIDIPortType,
    public name: string,
    public manufacturer: string,
  ) {
    super();
    this.id = `${type}-${name}`;
  }
  async open() {
    this.connection = "open";
    return this as unknown as MIDIPort;
  }
  async close() {
    this.connection = "closed";
    return this as unknown as MIDIPort;
  }
  // Output only. Recorded for tests; never echoed to the input (R7).
  send(data: number[] | Uint8Array, timestamp?: number) {
    this.sent.push({ data: Uint8Array.from(data), timestamp });
  }
  clear() {}
}

export type SimMidi = ReturnType<typeof createSimMidiAccess>;

export function createSimMidiAccess(overrides: Partial<SimProfile> = {}) {
  const profile = { ...DEFAULT_PROFILE, ...overrides };
  const random = seededRandom(profile.seed);
  const input = new SimPort("input", profile.portName, profile.manufacturer);
  const output = new SimPort("output", profile.portName, profile.manufacturer);
  const others = profile.extraInputs.map((name) => new SimPort("input", name, "sim"));
  const ports = [...others, input].map((p) => [p.id, p] as const);

  const access = Object.assign(new EventTarget(), {
    inputs: new Map(ports) as unknown as MIDIInputMap,
    outputs: new Map([[output.id, output]]) as unknown as MIDIOutputMap,
    sysexEnabled: false,
    onstatechange: null as ((e: Event) => void) | null,
  });

  const timers = new Set<ReturnType<typeof setTimeout>>();
  let stalledUntil = -Infinity;
  let lastStamp = -Infinity;
  const dropReleases = new Set<number>();
  const listeners = new Set<(l: SimLog) => void>();
  const log = (l: SimLog) => listeners.forEach((f) => f(l));

  // One message arrives at the input now, unless a fault eats it.
  function arrive(bytes: number[], stamp: number, note?: string) {
    if (input.state !== "connected" || performance.now() < stalledUntil) return;
    const [status, pitch, velocity] = bytes;
    const isRelease = (status & 0xf0) === 0x80 || ((status & 0xf0) === 0x90 && velocity === 0);
    if (isRelease && dropReleases.delete(pitch)) {
      log({ kind: "fault", timeStamp: stamp, text: `dropped the release of ${pitch} (stuck note)` });
      return;
    }
    const data = Uint8Array.from(bytes);
    const e = event("midimessage", { data, timeStamp: stamp }) as unknown as MIDIMessageEvent;
    input.onmidimessage?.(e);
    input.dispatchEvent(e);
    log({ kind: "message", timeStamp: stamp, bytes, note });
  }

  // Deliver bytes at a performance.now() time, with jitter, never reordered, floored to the timestamp resolution.
  function deliver(bytes: number[], atPerfMs: number, note?: string) {
    const j = profile.jitterMs ? (random() * 2 - 1) * profile.jitterMs : 0;
    const res = profile.timestampResolutionMs;
    const stamp = Math.max(lastStamp, Math.floor((atPerfMs + j) / res) * res);
    lastStamp = stamp;
    const t = setTimeout(() => {
      timers.delete(t);
      arrive(bytes, stamp, note);
    }, Math.max(0, stamp - performance.now()));
    timers.add(t);
  }

  function setState(state: MIDIPortDeviceState) {
    input.state = output.state = state;
    for (const port of [input, output]) {
      const e = event("statechange", { port });
      access.onstatechange?.(e);
      access.dispatchEvent(e);
      port.onstatechange?.(e);
      port.dispatchEvent(e);
    }
    log({ kind: "state", timeStamp: performance.now(), state });
  }

  if (profile.activeSensingMs !== null) setInterval(() => deliver([0xfe], performance.now()), profile.activeSensingMs);

  return {
    profile,
    access: access as unknown as MIDIAccess,
    input,
    output,
    // A timeline's timeMs are relative to startPerfMs (a performance.now() time).
    play(timeline: TimelineEntry[], startPerfMs = performance.now()) {
      for (const m of timeline) deliver(m.bytes, startPerfMs + m.timeMs, m.note);
    },
    send(bytes: number[]) {
      deliver(bytes, performance.now());
    },
    stall(ms: number) {
      stalledUntil = performance.now() + ms;
      log({ kind: "fault", timeStamp: performance.now(), text: `stall ${ms} ms (port still connected)` });
    },
    unplug: () => setState("disconnected"),
    replug: () => setState("connected"),
    setJitter(ms: number) {
      profile.jitterMs = ms;
      log({ kind: "fault", timeStamp: performance.now(), text: ms ? `jitter ±${ms} ms` : "jitter off" });
    },
    dropRelease(pitch: number) {
      dropReleases.add(pitch);
      log({ kind: "fault", timeStamp: performance.now(), text: `next release of ${pitch} will be dropped` });
    },
    onLog(f: (l: SimLog) => void) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    // Cancel everything scheduled, e.g. before a new replay.
    cancel() {
      timers.forEach(clearTimeout);
      timers.clear();
    },
  };
}

// Key bytes as the piano sends them: note-on, and a release as note-on with velocity 0 (R2).
export const keyOn = (pitch: number, velocity: number, channel = DEFAULT_PROFILE.keyChannel) => [0x90 | (channel - 1), pitch, velocity];
export const keyOff = (pitch: number, channel = DEFAULT_PROFILE.keyChannel) => [0x90 | (channel - 1), pitch, 0];

// Swap the browser's requestMIDIAccess for the sim's. Only /play?midi=sim calls this.
export function installSim(sim: SimMidi) {
  Object.defineProperty(navigator, "requestMIDIAccess", { value: async () => sim.access, configurable: true });
}
