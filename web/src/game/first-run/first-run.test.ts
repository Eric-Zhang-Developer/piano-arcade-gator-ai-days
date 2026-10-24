import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart, GameEvent } from "../../contracts";
import { msPerBeat, settings } from "../core/settings";
import { cueAlpha, cueAt, cueBand, cuesFor, firstNote, firstRunSettings } from "./cues";
import { firstRun } from ".";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const mpb = msPerBeat(twinkle.bpm);
const songStart: GameEvent = { type: "songStart", atMs: -settings.countInBeats * mpb };

// Twinkle's first n notes, each hit on time: noteHit, then combo, as the judge sends them.
const onTime = (n: number): GameEvent[] =>
  [...twinkle.notes]
    .sort((a, b) => a.beat - b.beat)
    .slice(0, n)
    .flatMap((note, i): GameEvent[] => [
      { type: "noteHit", noteId: note.id, pitch: note.pitch, judgment: "PERFECT", offsetMs: 0, atMs: note.beat * mpb },
      { type: "combo", count: i + 1, atMs: note.beat * mpb },
    ]);

// The ids in the order they show, sampling the chart clock every 20 ms.
function shownOrder(events: GameEvent[], untilMs: number): string[] {
  const cues = cuesFor(twinkle, events);
  const order: string[] = [];
  for (let t = songStart.atMs; t < untilMs; t += 20) {
    const c = cueAt(cues, t);
    if (c && order.at(-1) !== c.id) order.push(c.id);
  }
  return order;
}

describe("first-run cues", () => {
  it("on Twinkle, every note on time: fall, press, perfect, combo5, one at a time", () => {
    expect(shownOrder([songStart, ...onTime(8)], 8 * mpb)).toEqual(["fall", "press", "perfect", "combo5"]);
  });

  it("the press cue names A, the laptop letter for C4, Twinkle's lowest pitch", () => {
    expect(firstNote(twinkle)).toEqual({ atMs: 0, letter: "A" });
    expect(cuesFor(twinkle, [songStart]).find((c) => c.id === "press")?.text).toBe("Press A when it touches the line");
  });

  it("a first GREAT at +40 ms is late; at −40 ms, early", () => {
    for (const [offsetMs, id, text] of [
      [40, "late", "GREAT, a little late"],
      [-40, "early", "GREAT, a little early"],
    ] as const) {
      const hit: GameEvent = { type: "noteHit", noteId: "n1", pitch: 60, judgment: "GREAT", offsetMs, atMs: offsetMs };
      expect(cueAt(cuesFor(twinkle, [songStart, hit]), offsetMs + 10)).toMatchObject({ id, text });
    }
  });

  it("a first MISS gives miss", () => {
    const miss: GameEvent = { type: "noteMiss", noteId: "n1", pitch: 60, atMs: 100 };
    expect(cueAt(cuesFor(twinkle, [songStart, miss]), 150)?.id).toBe("miss");
  });

  it("each cue lasts at most 2 s, and the press cue ends at the first judgment", () => {
    const cues = cuesFor(twinkle, [songStart, ...onTime(8)]);
    for (const c of cues) expect(c.toMs - c.fromMs).toBeLessThanOrEqual(firstRunSettings.showMs);
    expect(cues.find((c) => c.id === "press")?.toMs).toBe(0);
  });

  it("only the take since the last songStart counts", () => {
    const retry: GameEvent = { type: "songStart", atMs: songStart.atMs };
    expect(cuesFor(twinkle, [songStart, ...onTime(8), retry]).map((c) => c.id)).toEqual(["fall", "press"]);
  });

  it("cues sit between the HUD band and the 1 s mark: half-way with a 2000 ms lookahead", () => {
    expect(cueBand(84, 800, 2000)).toEqual({ top: 84, bottom: 400 });
  });

  it("fades in over 200 ms, and shows at once under reduced motion", () => {
    const c = { id: "fall" as const, text: "", fromMs: 0, toMs: 2000 };
    expect(cueAlpha(c, 100, false)).toBeCloseTo(0.5);
    expect(cueAlpha(c, 300, false)).toBe(1);
    expect(cueAlpha(c, 0, true)).toBe(1);
  });
});

describe("first-run plugin", () => {
  const play = (query: string) => {
    const p = firstRun();
    p.transformChart!(twinkle, new URLSearchParams(query));
    for (const e of [songStart, ...onTime(1)]) p.onEvent!(e);
    return p;
  };

  it("with firstrun=1 it gives the cue; without it, none", () => {
    expect(play("song=twinkle&firstrun=1&labels=keys").cue(10)?.id).toBe("perfect");
    expect(play("song=twinkle&input=test").cue(10)).toBeNull();
    expect(play("song=twinkle&input=test").cue(songStart.atMs + 10)).toBeNull();
  });
});
