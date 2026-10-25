import { describe, expect, it } from "vitest";
import type { Chart, Frame, GameEvent } from "../../contracts";
import { SHEET_CHANNEL, sheetUrl, sheetView, type SheetMessage } from "./plugin";

const chart: Chart = {
  id: "t",
  title: "T",
  composer: "C",
  source: "test",
  bpm: 120,
  beatsPerBar: 4,
  notes: [
    { id: "n1", pitch: 60, beat: 0, duration: 1, hand: "R" },
    { id: "n2", pitch: 62, beat: 1, duration: 1, hand: "R" },
  ],
};
const frame = (nowMs: number) => ({ nowMs }) as Frame;
const ctx = {} as CanvasRenderingContext2D;

// Collects what the plugin posts until `end`, through Node's own BroadcastChannel.
function listen(): Promise<SheetMessage[]> {
  const ch = new BroadcastChannel(SHEET_CHANNEL);
  const got: SheetMessage[] = [];
  return new Promise((resolve) => {
    ch.onmessage = (e: MessageEvent<SheetMessage>) => {
      got.push(e.data);
      if (e.data.type === "end") {
        ch.close();
        resolve(got);
      }
    };
  });
}

describe("sheet-view plugin", () => {
  it("posts take, clock, judgment and end in order, and nothing outside a take", async () => {
    const heard = listen();
    const p = sheetView();
    const played = p.transformChart!(chart, new URLSearchParams("song=t&hands=R"));
    p.draw!(ctx, frame(-500)); // the start screen: no take yet, no clock
    const events: GameEvent[] = [
      { type: "songStart", atMs: -2000 },
      { type: "noteHit", atMs: 0, noteId: "n1", pitch: 60, judgment: "PERFECT", offsetMs: 3 },
      { type: "extra", atMs: 100, pitch: 70 },
      { type: "noteMiss", atMs: 650, noteId: "n2", pitch: 62 },
      { type: "songEnd", atMs: 1500, results: {} as never },
    ];
    p.onEvent!(events[0]);
    p.draw!(ctx, frame(-1990));
    p.onEvent!(events[1]);
    p.onEvent!(events[2]);
    p.draw!(ctx, frame(16));
    p.onEvent!(events[3]);
    p.onEvent!(events[4]);
    p.draw!(ctx, frame(1600)); // the results screen: no clock

    expect(played).toBe(chart);
    expect(await heard).toEqual([
      { type: "take", chart },
      { type: "clock", nowMs: -1990 },
      { type: "judgment", noteId: "n1", judgment: "PERFECT" },
      { type: "clock", nowMs: 16 },
      { type: "judgment", noteId: "n2", judgment: "MISS" },
      { type: "end" },
    ]);
  });

  it("forwards the judge's combo, milestones and full combo for /stage", async () => {
    const heard = listen();
    const p = sheetView();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "songStart", atMs: -2000 });
    p.onEvent!({ type: "combo", count: 25, atMs: 0 });
    p.onEvent!({ type: "comboMilestone", count: 25, atMs: 0 });
    p.onEvent!({ type: "fullCombo", atMs: 900 });
    p.onEvent!({ type: "songEnd", atMs: 1500, results: {} as never });
    expect((await heard).slice(1)).toEqual([{ type: "combo", count: 25 }, { type: "milestone", count: 25 }, { type: "fullCombo" }, { type: "end" }]);
  });

  it("ends on quit too", async () => {
    const heard = listen();
    const p = sheetView();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "songStart", atMs: -2000 });
    p.onEvent!({ type: "quit", atMs: 10 });
    expect((await heard).map((m) => m.type)).toEqual(["take", "end"]);
  });

  it("answers a viewer's hello with the chart during a take, and stays quiet outside one (#1405)", async () => {
    const viewer = new BroadcastChannel(SHEET_CHANNEL);
    const got: SheetMessage[] = [];
    viewer.onmessage = (e: MessageEvent<SheetMessage>) => void got.push(e.data);
    const settle = () => new Promise((r) => setTimeout(r, 30));
    const p = sheetView();
    p.transformChart!(chart, new URLSearchParams());
    p.onEvent!({ type: "songStart", atMs: -2000 });
    await settle();
    got.length = 0; // a /stage opened after the take went out: it missed the take
    viewer.postMessage({ type: "hello" } satisfies SheetMessage);
    await settle();
    expect(got).toEqual([{ type: "catchUp", chart }]);
    p.onEvent!({ type: "songEnd", atMs: 1500, results: {} as never });
    await settle();
    got.length = 0;
    viewer.postMessage({ type: "hello" } satisfies SheetMessage); // the results screen: no take to catch up on
    await settle();
    expect(got).toEqual([]);
    viewer.close();
  });

  it("opens the song /play has, default twinkle", () => {
    expect(sheetUrl(new URLSearchParams("song=library/x&hands=R"))).toBe("/sheet?song=library%2Fx");
    expect(sheetUrl(new URLSearchParams())).toBe("/sheet?song=twinkle");
  });
});
