import { describe, expect, it, vi } from "vitest";
import type { Chart } from "../../contracts";
import {
  audioTrack,
  fileTimeAt,
  getRecordingOffset,
  getRecordingVolume,
  RECORDING_OFFSET_MAX,
  setRecordingOffset, loopWindow, parseSidecar, segmentsFrom, setRecordingVolume,
  skipReason,
  recordingLevelAt,
  stopMusic,
  subscribeRecordingVolume,
  tailNow,
} from ".";
import { countInBeats } from "../count-in";
import { levelEnvelope } from "../milestone-sfx";
import { clickDrift, makeFixture } from "../record-seams";

// 120 bpm, 4/4: a beat is 500 ms, a bar 2000 ms. Eight bars, one note a bar.
const chart: Chart = {
  id: "local/t",
  title: "T",
  composer: "C",
  source: "S",
  bpm: 120,
  beatsPerBar: 4,
  notes: Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, pitch: 60, beat: i * 4, duration: 1, hand: "R" as const })),
};
const q = (s: string) => new URLSearchParams(s);

describe("audio-track timing", () => {
  it("fileTimeAt(chartMs) = offsetMs + chartMs", () => {
    expect(fileTimeAt(0, 1234)).toBe(1234);
    expect(fileTimeAt(5000, 1234)).toBe(6234);
    expect(fileTimeAt(-2000, 1234)).toBe(-766); // the count-in: before the file starts, silence
  });

  it("a resume after a pause restarts at the chart's current file time", () => {
    // Paused at 7.5 s: the resume's atMs is 7500, so the file picks up at offset + 7500.
    expect(segmentsFrom(7500, 1234)).toEqual([{ atMs: 7500, fileMs: 8734, endMs: Infinity }]);
  });

  it("a bar loop starts at the window's start, and each pass restarts there", () => {
    // Bars 3–4, two passes: the window is song 4000–8000 ms; a pass is 2 bars plus a gap bar, 6000 ms.
    const w = loopWindow(chart, q("from=3&to=4&passes=2"))!;
    expect(w).toEqual({ startMs: 4000, passMs: 6000, barMs: 2000, passes: 2 });
    expect(fileTimeAt(0, 1000, w)).toBe(5000); // pass 1's first downbeat: bar 3
    expect(fileTimeAt(-2000, 1000, w)).toBe(3000); // the count-in plays bar 2, the lead-in
    expect(fileTimeAt(6000, 1000, w)).toBe(5000); // pass 2's first downbeat: bar 3 again
    expect(fileTimeAt(5000, 1000, w)).toBe(4000); // pass 2's gap bar plays the lead-in, as the count-in did
    expect(segmentsFrom(-4000, 1000, w)).toEqual([
      { atMs: -4000, fileMs: 1000, endMs: 4000 },
      { atMs: 4000, fileMs: 3000, endMs: 10000 },
    ]);
    // A resume in pass 2 plays the rest of that pass only.
    expect(segmentsFrom(7000, 1000, w)).toEqual([{ atMs: 7000, fileMs: 6000, endMs: 10000 }]);
  });

  it("the whole song, or Speed alone at 100%, is no loop", () => {
    expect(loopWindow(chart, q(""))).toBeNull();
    expect(loopWindow(chart, q("tempo=100"))).toBeNull();
    expect(loopWindow(chart, q("from=9&to=12"))).toBeNull(); // a bad request: bar-loop reports it
  });

  it("no recording plays with tempo≠100, wait mode, flow mode or ?audio=off", () => {
    expect(skipReason(q("tempo=80"))).toMatch(/tempo 80%/);
    expect(skipReason(q("mode=wait"))).toMatch(/wait mode/);
    expect(skipReason(q("mode=flow"))).toMatch(/flow mode/);
    expect(skipReason(q("audio=off"))).toMatch(/audio=off/);
    expect(skipReason(q("tempo=100&from=2&to=3"))).toBeNull();
    expect(skipReason(q(""))).toBeNull();
  });

  it("a sidecar needs a src and a finite offsetMs", () => {
    expect(parseSidecar({ src: "golden.mp3", offsetMs: 1234 })).toEqual({ src: "golden.mp3", offsetMs: 1234 });
    expect(parseSidecar({ src: "golden.mp3" })).toBeNull();
    expect(parseSidecar({ src: "", offsetMs: 0 })).toBeNull();
    expect(parseSidecar(null)).toBeNull();
  });

  it("the recording volume clamps to 0–1 and tells its listeners", () => {
    let heard = 0;
    const off = subscribeRecordingVolume(() => heard++);
    setRecordingVolume(1.5);
    expect(getRecordingVolume()).toBe(1);
    setRecordingVolume(-1);
    expect(getRecordingVolume()).toBe(0);
    off();
    setRecordingVolume(0.4);
    expect([getRecordingVolume(), heard]).toEqual([0.4, 2]);
  });
});

describe("Recording offset (golden-demo, part 6)", () => {
  it("is 0 until set, clamps to ±300 ms, and tells its listeners", () => {
    expect(getRecordingOffset()).toBe(0);
    setRecordingOffset(1000);
    expect(getRecordingOffset()).toBe(RECORDING_OFFSET_MAX);
    setRecordingOffset(-40);
    expect(getRecordingOffset()).toBe(-40);
    setRecordingOffset(0);
  });

  it("moves the recording only: file time = offsetMs + recording offset + chart time", async () => {
    vi.stubGlobal("window", { addEventListener() {}, location: { origin: "http://localhost" } });
    vi.stubGlobal("fetch", async (url: string) => ({
      ok: true,
      json: async () => ({ src: "a.mp3", offsetMs: 3000 }),
      arrayBuffer: async () => new ArrayBuffer(8),
      url,
    }));
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        decodeAudioData = async () => ({ duration: 60 });
      },
    );
    try {
      audioTrack().transformChart!(chart, q("song=local/t"));
      await vi.waitFor(() => expect(window.__pianoArcadeAudio?.loaded).toBe(true));
      expect(window.__pianoArcadeAudio!.fileTimeAt(1000)).toBe(4000);
      setRecordingOffset(120);
      expect(window.__pianoArcadeAudio!.fileTimeAt(1000)).toBe(4120);
    } finally {
      setRecordingOffset(0);
      vi.unstubAllGlobals();
    }
  });
});

// record-seams: the tail under the results, on a fixture rendered at test time (no audio committed).
describe("the tail under the results (record-seams)", () => {
  const RATE = 8000;
  const fx = makeFixture({ sampleRate: RATE, bpm: 120, offsetMs: 4000, songMs: 40_000 });
  const fxBuffer = { duration: fx.durationMs / 1000, sampleRate: RATE, length: fx.samples.length, numberOfChannels: 1, getChannelData: () => fx.samples };
  const levels = levelEnvelope(fxBuffer);
  const levelOf = (chartMs: number) => levels[Math.floor((chartMs + fx.offsetMs) / 100)];

  // A context that records what each run's bus was told; disconnecting the bus is the instant silence.
  function setup(sidecarOffsetMs = fx.offsetMs) {
    setRecordingVolume(1); // the bus's level is the take level, so the tail's points read as gains
    const buses: { off: boolean; calls: string[] }[] = [];
    const loc = { pathname: "/play", origin: "http://localhost" };
    vi.stubGlobal("window", {
      addEventListener() {},
      location: loc,
      setInterval: (f: () => void, ms: number) => setInterval(f, ms),
      clearInterval: (id: number) => clearInterval(id),
      setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    });
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ src: "fx.wav", offsetMs: sidecarOffsetMs }), arrayBuffer: async () => new ArrayBuffer(8) }));
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        currentTime = 0;
        destination = {};
        decodeAudioData = async () => fxBuffer;
        resume = async () => {};
        createGain() {
          const bus = { off: false, calls: [] as string[] };
          buses.push(bus);
          const rec = (name: string) => (v: number) => void bus.calls.push(`${name} ${v.toFixed(4)}`);
          return {
            gain: { value: 1, setValueAtTime: rec("set"), linearRampToValueAtTime: rec("linear"), exponentialRampToValueAtTime: rec("exp"), cancelScheduledValues() {} },
            connect() {},
            disconnect: () => void (bus.off = true),
          };
        }
        createBufferSource() {
          return { connect() {}, start() {}, stop() {} };
        }
      },
    );
    return { buses, loc };
  }
  const results = {} as never;

  async function toResults(endMs = 16_500) {
    const env = setup();
    const p = audioTrack();
    p.transformChart!(chart, q("song=local/t"));
    await vi.waitFor(() => expect(window.__pianoArcadeAudio?.loaded).toBe(true));
    p.onEvent!({ type: "songStart", atMs: -4000 });
    p.onEvent!({ type: "songEnd", atMs: endMs, results });
    return { p, ...env };
  }

  it("plays on, ducked 6 dB, and reports that level until it ends; the tag says the bar", async () => {
    try {
      const { buses } = await toResults();
      const bus = buses.at(-1)!;
      expect(bus.off).toBe(false);
      expect(bus.calls[0]).toBe("set 1.0000");
      expect(bus.calls.at(-1)).toBe("set 0.0000"); // on the bar line
      expect(tailNow()).toMatchObject({ kind: "fade", bar: 12 }); // songEnd at 16.5 s, in bar 9: the fade runs 18–22 s, to the line that starts bar 12
      expect(recordingLevelAt(17_000)! - levelOf(17_000)).toBeCloseTo(-6.02, 1);
      expect(recordingLevelAt(20_000)!).toBeLessThan(levelOf(20_000) - 6.02 - 20); // halfway down the fade
      expect(recordingLevelAt(20_000)!).toBeGreaterThan(levelOf(20_000) - 6.02 - 40);
      expect(recordingLevelAt(20_001)).not.toBeNull();
      expect(recordingLevelAt(20_000 + 9999)).toBeNull(); // past the tail
      expect(audioTrack().resultsPanel).toBeDefined();
    } finally {
      stopMusic();
      vi.unstubAllGlobals();
    }
  });

  it("Stop music, Retry and leaving /play silence the tail at once", async () => {
    try {
      let { buses } = await toResults();
      stopMusic();
      expect([buses.at(-1)!.off, tailNow(), recordingLevelAt(17_000)]).toEqual([true, null, null]);

      const r = await toResults();
      r.p.transformChart!(chart, q("song=local/t")); // Retry
      expect([r.buses.at(-1)!.off, tailNow()]).toEqual([true, null]);

      const l = await toResults();
      buses = l.buses;
      l.loc.pathname = "/";
      await new Promise((ok) => setTimeout(ok, 300)); // the 250 ms watch
      expect([buses.at(-1)!.off, tailNow()]).toEqual([true, null]);
    } finally {
      stopMusic();
      vi.unstubAllGlobals();
    }
  });

  it("a quit mid-song is silent at once and leaves no tail", async () => {
    try {
      const { buses } = setup();
      const p = audioTrack();
      p.transformChart!(chart, q("song=local/t"));
      await vi.waitFor(() => expect(window.__pianoArcadeAudio?.loaded).toBe(true));
      p.onEvent!({ type: "songStart", atMs: -4000 });
      p.onEvent!({ type: "quit", atMs: 5000 });
      expect([buses.at(-1)!.off, tailNow()]).toEqual([true, null]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("the count-in clicks land on the recording's intro beats within 5 ms, through the Recording offset", async () => {
    for (const r of [0, 100, -100]) {
      // The sidecar is r off, and the player's Recording offset puts it back.
      setup(fx.offsetMs - r);
      setRecordingOffset(r);
      try {
        audioTrack().transformChart!(chart, q("song=local/t"));
        await vi.waitFor(() => expect(window.__pianoArcadeAudio?.loaded).toBe(true));
        const clicks = countInBeats(chart).map((b) => b.atMs);
        expect(clicks).toHaveLength(8);
        expect(clickDrift(clicks, window.__pianoArcadeAudio!.fileTimeAt(0), fx.beatsMs)).toBeLessThanOrEqual(5);
      } finally {
        setRecordingOffset(0);
        vi.unstubAllGlobals();
      }
    }
  });
});
