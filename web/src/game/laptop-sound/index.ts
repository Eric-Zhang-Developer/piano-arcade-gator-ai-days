// Laptop sound (spec: laptop-sound): with no DGX connected, a virtual "Portable Grand" MIDI output that plays on the
// laptop, so the ~12 features that look for the piano by that name sound without a change. A real DGX always wins.
import { createSynth, type Audio, type Synth } from "./synth";
import { getPianoVolume, subscribePianoVolume } from "./volume";
import { loadBank } from "../sampled-piano";

export { getPianoVolume, setPianoVolume, subscribePianoVolume, DEFAULT_PIANO_VOLUME } from "./volume";

export const PIANO_NAME = "Portable Grand";
const hasPiano = (a: MIDIAccess | null) => !!a && [...a.outputs.values()].some((o) => o.name?.includes(PIANO_NAME));

export type Mode = "auto" | "laptop" | "off" | "sim";
// ?midi=laptop forces it on beside a real DGX, ?midi=off keeps it silent, ?midi=sim is piano-sim's own fake.
export function modeFrom(params: URLSearchParams): Mode {
  const m = params.get("midi");
  return m === "laptop" || m === "off" || m === "sim" ? m : "auto";
}

// The virtual output: what features see in `access.outputs`. send(data, timestamp) as Web MIDI's, clear() drops
// what's queued; while disabled (a DGX took over) it ignores everything.
export interface VirtualOutput {
  id: string;
  name: string;
  manufacturer: string;
  type: "output";
  state: "connected";
  connection: "open";
  enabled: boolean;
  send(data: number[] | Uint8Array, timestamp?: number): void;
  clear(): void;
  open(): Promise<VirtualOutput>;
  close(): Promise<VirtualOutput>;
  onstatechange: null;
  addEventListener(): void;
  removeEventListener(): void;
}

export function virtualOutput(synth: Synth, audio: () => Audio | null): VirtualOutput {
  let queued: ReturnType<typeof setTimeout>[] = [];
  const out: VirtualOutput = {
    id: "laptop-sound",
    name: PIANO_NAME,
    manufacturer: "Laptop sound",
    type: "output",
    state: "connected",
    connection: "open",
    enabled: true,
    send(data, timestamp) {
      if (!out.enabled) return;
      const bytes = Array.from(data);
      const lead = timestamp === undefined ? 0 : timestamp - performance.now();
      const a = audio();
      // Audio is placed exactly on the AudioContext clock; the bookkeeping follows within a timer's accuracy.
      const atS = a ? a.ctx.currentTime + Math.max(0, lead) / 1000 : undefined;
      if (lead <= 15) return synth.message(bytes, atS);
      const t = setTimeout(() => {
        queued = queued.filter((q) => q !== t);
        if (out.enabled) synth.message(bytes, atS);
      }, lead - 10);
      queued.push(t);
    },
    clear() {
      queued.forEach(clearTimeout);
      queued = [];
    },
    open: async () => out,
    close: async () => out,
    onstatechange: null,
    addEventListener() {},
    removeEventListener() {},
  };
  return out;
}

// All Notes Off on every channel, now.
export const silence = (out: { send(d: number[]): void }) => {
  for (let ch = 0; ch < 16; ch++) out.send([0xb0 + ch, 123, 0]);
};

// The access a feature gets. Unchanged when a real DGX is there (auto) or the mode is off or sim; otherwise the
// browser's inputs and outputs plus the virtual one (first under ?midi=laptop, so lookups find it before the DGX).
export function wrapAccess(real: MIDIAccess | null, mode: Mode, virtual: VirtualOutput): MIDIAccess | null {
  if (mode === "off" || mode === "sim" || (mode === "auto" && hasPiano(real))) return real;
  virtual.enabled = true;
  let handler: MIDIAccess["onstatechange"] = null;
  return {
    get inputs() {
      return real?.inputs ?? (new Map() as unknown as MIDIInputMap);
    },
    get outputs() {
      const own = [...(real?.outputs.entries() ?? [])];
      const v: [string, MIDIOutput] = [virtual.id, virtual as unknown as MIDIOutput];
      return new Map(mode === "laptop" ? [v, ...own] : [...own, v]) as unknown as MIDIOutputMap;
    },
    sysexEnabled: false,
    get onstatechange() {
      return real ? real.onstatechange : handler;
    },
    set onstatechange(f) {
      if (real) real.onstatechange = f;
      else handler = f;
    },
    addEventListener: (...a: Parameters<MIDIAccess["addEventListener"]>) => real?.addEventListener(...a),
    removeEventListener: (...a: Parameters<MIDIAccess["removeEventListener"]>) => real?.removeEventListener(...a),
    dispatchEvent: (e: Event) => real?.dispatchEvent(e) ?? false,
  } as MIDIAccess;
}

// --- the page's one instance -------------------------------------------------------------------------------------

let audio: Audio | null = null;
const synth = createSynth(() => audio);
const virtual = virtualOutput(synth, () => audio);
let active = false;

// The browser lets an AudioContext start only after a gesture: create it on the first key press or click (capture,
// so it exists before keysDevice's own keydown handler sounds the key).
function startAudio() {
  if (!audio) {
    try {
      const ctx = new AudioContext({ latencyHint: "interactive" });
      const out = ctx.createGain();
      out.gain.value = getPianoVolume();
      out.connect(ctx.destination);
      audio = { ctx, out };
      const a = audio;
      void loadBank(ctx).then((bank) => bank && (a.bank = bank)); // the synth voice plays until then
      subscribePianoVolume(() => audio && (audio.out.gain.value = getPianoVolume()));
    } catch {
      return; // no Web Audio: laptop sound stays silent
    }
  }
  if (audio.ctx.state === "suspended") void audio.ctx.resume().catch(() => {});
}

// A laptop key from keysDevice: sounds only while the virtual output is the piano, so a DGX never doubles it.
export function laptopKey(type: "on" | "off", pitch: number, velocity: number): void {
  if (!active || !virtual.enabled) return;
  virtual.send(type === "on" ? [0x90, pitch, velocity] : [0x80, pitch, 0]);
}

export const laptopSoundActive = () => active && virtual.enabled;

// Wraps navigator.requestMIDIAccess for the page. Called once, from install.tsx, as its module loads.
export function installLaptopSound(): void {
  if ("__pianoArcadeLaptop" in window) return; // once per page, hot reloads included
  const browser = navigator.requestMIDIAccess?.bind(navigator);
  const request = async (opts?: MIDIOptions): Promise<MIDIAccess> => {
    const mode = modeFrom(new URLSearchParams(location.search));
    let real: MIDIAccess | null = null;
    if (browser) {
      try {
        real = await browser(opts);
      } catch (e) {
        if (mode === "off") throw e; // as the browser had it
      }
    }
    const access = wrapAccess(real, mode, virtual);
    active = access !== real;
    if (!access) throw new DOMException("Web MIDI isn't available", "NotSupportedError"); // off or sim, no browser MIDI
    if (!active) return access;
    // A DGX plugged in later takes over: the virtual output goes silent, and new lookups find the real one.
    real?.addEventListener("statechange", () => {
      if (mode === "auto" && hasPiano(real)) {
        silence(virtual);
        virtual.clear();
        virtual.enabled = false;
        active = false;
      }
    });
    return access;
  };
  Object.defineProperty(navigator, "requestMIDIAccess", { value: request, configurable: true, writable: true });
  for (const type of ["keydown", "pointerdown"]) window.addEventListener(type, startAudio, { capture: true });
  Object.defineProperty(window, "__pianoArcadeLaptop", {
    configurable: true,
    value: {
      get active() {
        return laptopSoundActive();
      },
      get voices() {
        return synth.voices();
      },
      get sampled() {
        return !!audio?.bank;
      },
    },
  });
}
