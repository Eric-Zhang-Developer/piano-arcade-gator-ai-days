import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart } from "../../contracts";
import { pianoVoice, voiceFor } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const honkyTonk: Chart = { ...twinkle, voice: 4 };

// One take through the plugin against a stubbed "Portable Grand": every message it sent.
async function take(chart: Chart, query: string, end: "songEnd" | "quit" = "songEnd"): Promise<number[][]> {
  const sent: number[][] = [];
  const output = { name: "Portable Grand", send: (data: number[]) => sent.push(data) };
  vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map([["o", output]]) }) });
  const plugin = pianoVoice();
  plugin.transformChart!(chart, new URLSearchParams(query));
  await Promise.resolve();
  await Promise.resolve();
  plugin.onEvent!({ type: "songStart", atMs: -4800 });
  plugin.onEvent!(end === "quit" ? { type: "quit", atMs: 100 } : { type: "songEnd", atMs: 30_000, results: {} as never });
  return sent;
}

describe("piano voice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("voice 4 sends [0xC0, 3] on songStart and [0xC0, 0] on songEnd and on quit", async () => {
    expect(await take(honkyTonk, "")).toEqual([[0xc0, 3], [0xc0, 0]]);
    expect(await take(honkyTonk, "", "quit")).toEqual([[0xc0, 3], [0xc0, 0]]);
  });

  it("a chart without voice sends nothing; ?voice=off sends nothing; ?voice=19 overrides the chart", async () => {
    expect(await take(twinkle, "")).toEqual([]);
    expect(await take(honkyTonk, "voice=off")).toEqual([]);
    expect(await take(honkyTonk, "voice=19")).toEqual([[0xc0, 18], [0xc0, 0]]);
  });

  it("ignores a ?voice outside 1–128 and falls back to the chart's", () => {
    expect([voiceFor(honkyTonk, "0"), voiceFor(honkyTonk, "129"), voiceFor(honkyTonk, "x"), voiceFor(twinkle, null)]).toEqual([4, 4, 4, null]);
  });

  it("no piano: no message and no error", async () => {
    vi.stubGlobal("navigator", { requestMIDIAccess: async () => ({ outputs: new Map() }) });
    const plugin = pianoVoice();
    plugin.transformChart!(honkyTonk, new URLSearchParams());
    await Promise.resolve();
    expect(() => {
      plugin.onEvent!({ type: "songStart", atMs: -4800 });
      plugin.onEvent!({ type: "quit", atMs: 0 });
    }).not.toThrow();
  });
});
