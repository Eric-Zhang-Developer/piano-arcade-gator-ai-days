import { describe, expect, it, vi } from "vitest";
import { createSynth, DRUMS, synthSettings, type Audio } from "../laptop-sound/synth";
import { loadBank, pick, type Bank, type SampleRow } from ".";

// A fake AudioContext: buffer sources log which buffer they start and at what rate ("noise" for the drums' own).
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
    createOscillator: () => ({ ...node(), start: () => log.push("osc"), stop() {} }),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource() {
      const src = {
        ...node(),
        buffer: null as { file?: string } | null,
        playbackRate: param(),
        start: () => log.push(`${src.buffer?.file ?? "noise"} @${src.playbackRate.value.toFixed(4)}`),
        stop: () => log.push(`stop ${src.buffer?.file ?? "noise"}`),
      };
      return src;
    },
  };
  return { audio: { ctx, out: node() } as unknown as Audio, log };
}

// Every third semitone from A0, two layers, as the committed subset is shaped.
const rows: SampleRow[] = [21, 24, 27, 30, 33].flatMap((pitch) => [64, 112].map((vel) => ({ pitch, vel, file: `${pitch}v${vel}.mp3` })));
const bank: Bank = { rows, buffers: rows.map((r) => ({ file: r.file }) as unknown as AudioBuffer) };

const on = (ch: number, p: number, v = 80) => [0x90 + ch, p, v];
const off = (ch: number, p: number) => [0x80 + ch, p, 0];
const cc = (ch: number, n: number, v: number) => [0xb0 + ch, n, v];

describe("pick", () => {
  it("the nearest sample in the nearest layer, shifted by playbackRate", () => {
    expect(rows[pick(rows, 24, 100).index].file).toBe("24v112.mp3");
    expect(pick(rows, 24, 100).rate).toBe(1);
    const up = pick(rows, 25, 40); // one above 24, soft
    expect(rows[up.index].file).toBe("24v64.mp3");
    expect(up.rate).toBeCloseTo(2 ** (1 / 12));
    const down = pick(rows, 26, 127); // one below 27
    expect(rows[down.index].file).toBe("27v112.mp3");
    expect(down.rate).toBeCloseTo(2 ** (-1 / 12));
    expect(rows[pick(rows, 108, 80).index].pitch).toBe(33); // past the top: the highest, shifted up
  });
});

describe("loadBank", () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, arrayBuffer: async () => new ArrayBuffer(4) }) as unknown as Response;

  it("decodes every file the manifest lists", async () => {
    const fetcher = vi.fn(async (url: string) => ok(url.endsWith("manifest.json") ? rows : null));
    const decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
    const b = await loadBank({ decodeAudioData } as unknown as BaseAudioContext, fetcher as unknown as typeof fetch);
    expect(b?.rows).toEqual(rows);
    expect(decodeAudioData).toHaveBeenCalledTimes(rows.length);
    expect(fetcher).toHaveBeenCalledWith("/samples/piano/21v64.mp3");
  });

  it("a failed fetch or decode: null and one warning, nothing thrown", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missing = async (url: string) => (url.endsWith("30v64.mp3") ? ({ ok: false, status: 404 } as Response) : ok(rows));
    const ctx = { decodeAudioData: async () => ({}) as AudioBuffer } as unknown as BaseAudioContext;
    await expect(loadBank(ctx, missing as typeof fetch)).resolves.toBeNull();
    const bad = { decodeAudioData: async () => Promise.reject(new Error("EncodingError")) } as unknown as BaseAudioContext;
    await expect(loadBank(bad, (async () => ok(rows)) as unknown as typeof fetch)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledTimes(2); // once per load
    warn.mockRestore();
  });
});

describe("the synth with samples", () => {
  it("before load: the oscillator voice; after: the nearest sample at the right rate", () => {
    const { audio, log } = fakeAudio();
    const s = createSynth(() => audio);
    s.message(on(0, 25));
    expect(log).toEqual(["osc", "osc"]);
    audio.bank = bank;
    log.length = 0;
    s.message(on(0, 28, 120));
    expect(log).toEqual([`27v112.mp3 @${(2 ** (1 / 12)).toFixed(4)}`]);
    s.message(off(0, 28));
    expect(log).toContain("stop 27v112.mp3");
  });

  it("the 32-voice cap still steals the oldest, and All Notes Off still ends every voice", () => {
    const { audio, log } = fakeAudio();
    audio.bank = bank;
    const s = createSynth(() => audio);
    for (let p = 40; p < 40 + synthSettings.maxVoices + 1; p++) s.message(on(0, p));
    expect(s.voices()).toBe(32);
    expect(log.filter((l) => l.startsWith("stop")).length).toBe(1); // the oldest, stolen
    s.message(cc(0, 123, 0));
    expect(s.voices()).toBe(0);
    expect(log.filter((l) => l.startsWith("stop")).length).toBe(33);
    expect(log.some((l) => l === "osc")).toBe(false);
  });

  it("channel 10 still drums with its own noise, and other channel-10 notes are silent", () => {
    const { audio, log } = fakeAudio();
    audio.bank = bank;
    const s = createSynth(() => audio);
    for (const n of [...DRUMS, 49, 60]) s.message(on(9, n));
    expect(s.drumHits()).toBe(4);
    expect(log.some((l) => l.includes(".mp3"))).toBe(false);
    expect(s.voices()).toBe(0);
  });
});
