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
  subscribeRecordingVolume,
} from ".";

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
