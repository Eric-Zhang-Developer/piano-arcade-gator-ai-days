import { readdirSync, readFileSync } from "node:fs";
import { sep } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPedal, parsePedal, PEDAL_SONGS, pedalEvents } from ".";

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

  it("a library song not in library.json asks for nothing, so it logs no 404", async () => {
    serve({ ok: false, status: 404 });
    expect(await loadPedal("not-listed")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  // The committed library: every listed song has a valid pedal.json inside its chart, and every pedal.json is listed.
  it("library.json and the library's pedal.json files agree, each in order and inside its song", () => {
    const songs = new URL("../../../public/songs/", import.meta.url);
    const files = readdirSync(songs, { recursive: true, encoding: "utf8" }) // nested too: x/build-sonata
      .filter((f) => f.split(sep).pop() === "pedal.json")
      .map((f) => f.split(sep).slice(0, -1).join("/"));
    expect([...PEDAL_SONGS].sort()).toEqual(files.sort());
    for (const id of PEDAL_SONGS) {
      const pedal = parsePedal(JSON.parse(readFileSync(new URL(`${id}/pedal.json`, songs), "utf8")));
      expect(pedal, id).not.toBeNull();
      const chart = JSON.parse(readFileSync(new URL(`${id}/chart.json`, songs), "utf8"));
      const end = Math.max(...chart.notes.map((n: { beat: number; duration: number }) => n.beat + n.duration));
      expect(pedal![0][0], id).toBeGreaterThanOrEqual(0);
      expect(pedal!.at(-1)![1], id).toBeLessThanOrEqual(end);
    }
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
