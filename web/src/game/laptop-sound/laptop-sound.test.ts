import { describe, expect, it, vi } from "vitest";
import { modeFrom, virtualOutput, wrapAccess } from ".";
import { createSynth, DRUMS, synthSettings, type Audio } from "./synth";

// A fake AudioContext: enough nodes for the synth, recording what starts and stops.
function fakeAudio() {
  const log: string[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect: (n: unknown) => n, gain: param(), frequency: param(), type: "" });
  const ctx = {
    currentTime: 1,
    sampleRate: 48000,
    destination: node(),
    createGain: node,
    createBiquadFilter: node,
    createOscillator: () => ({ ...node(), start: () => log.push("osc start"), stop: () => log.push("osc stop") }),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ ...node(), buffer: null, start: () => log.push("hit"), stop() {} }),
  };
  return { audio: { ctx, out: node() } as unknown as Audio, log };
}

const on = (ch: number, p: number, v = 80) => [0x90 + ch, p, v];
const off = (ch: number, p: number) => [0x80 + ch, p, 0];
const cc = (ch: number, n: number, v: number) => [0xb0 + ch, n, v];

describe("the synth", () => {
  it("note-on starts a voice, note-off releases it, velocity 0 counts as a release", () => {
    const { audio, log } = fakeAudio();
    const s = createSynth(() => audio);
    s.message(on(0, 60));
    s.message(on(0, 64));
    expect(s.voices()).toBe(2);
    expect(log.filter((l) => l === "osc start").length).toBe(4); // two partials a voice
    s.message(off(0, 60));
    s.message([0x90, 64, 0]);
    expect(s.voices()).toBe(0);
    expect(log.filter((l) => l === "osc stop").length).toBe(4);
  });

  it("the pedal: notes released while CC64 ≥ 64 sound until CC64 < 64, then all end", () => {
    const s = createSynth(() => fakeAudio().audio);
    s.message(cc(0, 64, 127));
    s.message(on(0, 60));
    s.message(on(0, 62));
    s.message(off(0, 60));
    s.message(off(0, 62));
    expect(s.voices()).toBe(2);
    s.message(on(0, 67)); // still held when the pedal lifts: keeps sounding
    s.message(cc(0, 64, 0));
    expect(s.voices()).toBe(1);
    s.message(off(0, 67));
    expect(s.voices()).toBe(0);
  });

  it("All Notes Off (CC123) ends every voice on its channel", () => {
    const s = createSynth(() => fakeAudio().audio);
    s.message(on(0, 60));
    s.message(on(1, 62));
    s.message(cc(0, 123, 0));
    expect(s.voices()).toBe(1);
    s.message(cc(1, 123, 0));
    expect(s.voices()).toBe(0);
  });

  it("the 32-voice cap steals the oldest", () => {
    const s = createSynth(() => fakeAudio().audio);
    for (let p = 40; p < 40 + synthSettings.maxVoices + 1; p++) s.message(on(0, p));
    expect(s.voices()).toBe(32);
    s.message(off(0, 40)); // the oldest is gone already: nothing to release
    expect(s.voices()).toBe(32);
    s.message(off(0, 41));
    expect(s.voices()).toBe(31);
  });

  it("channel 10's 36/38/37/42 make drum hits; other channel-10 notes are silent", () => {
    const { audio, log } = fakeAudio();
    const s = createSynth(() => audio);
    for (const n of [...DRUMS, 49, 60]) s.message(on(9, n));
    expect(s.drumHits()).toBe(4);
    expect(s.voices()).toBe(0);
    expect(log.filter((l) => l === "hit" || l === "osc start").length).toBe(4); // the kick is a tone, the rest noise
  });

  it("before the AudioContext exists, notes are counted and nothing throws", () => {
    const s = createSynth(() => null);
    s.message(on(0, 60));
    s.message(on(9, 36));
    expect([s.voices(), s.drumHits()]).toEqual([1, 1]);
    s.message(off(0, 60));
    expect(s.voices()).toBe(0);
  });

  it("program changes are accepted and ignored", () => {
    const s = createSynth(() => null);
    s.message([0xc0, 5]);
    s.message(on(0, 60));
    expect(s.voices()).toBe(1);
  });
});

// A fake browser access with these output names.
const access = (...names: string[]) =>
  ({
    inputs: new Map([["in", { name: "in" }]]),
    outputs: new Map(names.map((n, i) => [`o${i}`, { id: `o${i}`, name: n }])),
    onstatechange: null,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MIDIAccess;
const names = (a: MIDIAccess | null) => [...(a?.outputs.values() ?? [])].map((o) => `${o.name}${o.manufacturer ? ` (${o.manufacturer})` : ""}`);

describe("the wrapper", () => {
  const v = () => virtualOutput(createSynth(() => null), () => null);

  it("a real DGX comes back unchanged", () => {
    const real = access("Digital Piano-1 Portable Grand");
    expect(wrapAccess(real, "auto", v())).toBe(real);
  });
  it("without one, the virtual Portable Grand is added after the browser's outputs, and inputs stay the browser's", () => {
    const real = access("IAC Driver Bus 1");
    const a = wrapAccess(real, "auto", v())!;
    expect(names(a)).toEqual(["IAC Driver Bus 1", "Portable Grand (Laptop sound)"]);
    expect([...a.inputs.keys()]).toEqual(["in"]);
  });
  it("with no Web MIDI at all, an access with no inputs and only the virtual output", () => {
    const a = wrapAccess(null, "auto", v())!;
    expect([names(a), a.inputs.size]).toEqual([["Portable Grand (Laptop sound)"], 0]);
  });
  it("?midi=off adds nothing", () => {
    const real = access("IAC Driver Bus 1");
    expect(wrapAccess(real, "off", v())).toBe(real);
    expect(wrapAccess(null, "off", v())).toBeNull();
  });
  it("?midi=laptop adds it first, even beside a real DGX", () => {
    const a = wrapAccess(access("Digital Piano-1 Portable Grand"), "laptop", v())!;
    expect(names(a)).toEqual(["Portable Grand (Laptop sound)", "Digital Piano-1 Portable Grand"]);
  });
  it("?midi=sim is left to piano-sim", () => {
    const real = access("Portable Grand");
    expect(wrapAccess(real, "sim", v())).toBe(real);
  });
  it("the mode comes from ?midi=", () => {
    expect(["", "midi=laptop", "midi=off", "midi=sim", "midi=x"].map((q) => modeFrom(new URLSearchParams(q)))).toEqual(["auto", "laptop", "off", "sim", "auto"]);
  });
  it("the virtual output plays what it's sent, drops nothing sent for now, and a disabled one plays nothing", () => {
    const s = createSynth(() => null);
    const out = virtualOutput(s, () => null);
    out.send([0x90, 60, 80]);
    out.send([0x90, 62, 80], performance.now());
    expect(s.voices()).toBe(2);
    out.enabled = false;
    out.send([0x90, 64, 80]);
    expect(s.voices()).toBe(2);
  });
  it("a timestamped send plays at its time, and clear() drops what's still queued", () => {
    vi.useFakeTimers();
    const s = createSynth(() => null);
    const out = virtualOutput(s, () => null);
    out.send([0x90, 60, 80], performance.now() + 100);
    out.send([0x90, 62, 80], performance.now() + 300);
    expect(s.voices()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(s.voices()).toBe(1);
    out.clear();
    vi.advanceTimersByTime(500);
    expect(s.voices()).toBe(1);
    vi.useRealTimers();
  });
});
