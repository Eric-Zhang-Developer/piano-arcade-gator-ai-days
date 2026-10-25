import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPedal, parsePedal, pedalEvents } from ".";

describe("pedal.json", () => {
  it("reads pairs in beats, a re-pedal's down allowed on the last up", () => {
    expect(parsePedal({ pedal: [[0, 1.9], [1.9, 4], [5, 6]] })).toEqual([[0, 1.9], [1.9, 4], [5, 6]]);
    expect(parsePedal({ pedal: [] })).toEqual([]);
  });

  it("refuses anything else: no list, a bad pair, down at or after up, out of order, overlapping", () => {
    for (const raw of [null, {}, { pedal: "0-1" }, { pedal: [[0]] }, { pedal: [[0, "1"]] }, { pedal: [[1, 1]] },
      { pedal: [[2, 1]] }, { pedal: [[4, 5], [0, 1]] }, { pedal: [[0, 2], [1, 3]] }])
      expect(parsePedal(raw)).toBeNull();
  });

  afterEach(() => vi.unstubAllGlobals());
  const serve = (res: Partial<Response>) => vi.stubGlobal("fetch", vi.fn(async () => res));

  it("a missing file is no pedal, quietly; an invalid one warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    serve({ ok: false, status: 404 });
    expect(await loadPedal("local/x")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    serve({ ok: true, json: async () => ({ pedal: [[2, 1]] }) });
    expect(await loadPedal("local/x")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/songs/local/x/pedal.json");
    warn.mockRestore();
  });
});

describe("pedal events", () => {
  const pedal: [number, number][] = [[0, 1], [1, 3]];
  it("down then up for each pair, in chart ms", () => {
    expect(pedalEvents(pedal, 500)).toEqual([
      { atMs: 0, value: 127 }, { atMs: 500, value: 0 }, { atMs: 500, value: 127 }, { atMs: 1500, value: 0 },
    ]);
  });

  it("from a resume: past pairs dropped, and the pair it falls in goes down at the resume", () => {
    expect(pedalEvents(pedal, 500, 900)).toEqual([{ atMs: 900, value: 127 }, { atMs: 1500, value: 0 }]);
  });
});
