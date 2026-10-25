import { describe, expect, it, vi } from "vitest";
import type { Chart } from "../../contracts";
import { melody } from "../simon";
import { makeRound, newSet, pageKey, roundMessages, score, seeded, sendAhead, step, wrongNoteSettings } from ".";

// Synthetic charts only: no notes typed from a song.
const chartOf = (pitches: number[], bpm = 120): Chart =>
  ({
    id: "synthetic",
    title: "synthetic",
    bpm,
    beatsPerBar: 4,
    notes: pitches.map((pitch, i) => ({ id: `n${i}`, pitch, beat: i, duration: 0.5, hand: "R" as const })),
  }) as Chart;
const scale = chartOf([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]);

describe("makeRound", () => {
  it("8 notes, exactly one moved by exactly `shift`, at position 2–8, never onto a neighbor", () => {
    const tune = melody(scale);
    for (const shift of [1, 2]) {
      const rng = seeded(7);
      for (let k = 0; k < 200; k++) {
        const r = makeRound(tune, rng, shift)!;
        expect(r.played).toHaveLength(8);
        const diff = r.played.map((n, i) => n.pitch - r.source[i].pitch);
        expect(diff.filter((d) => d !== 0)).toHaveLength(1);
        expect(Math.abs(diff[r.changed - 1])).toBe(shift);
        expect(r.changed).toBeGreaterThanOrEqual(2);
        expect(r.changed).toBeLessThanOrEqual(8);
        const i = r.changed - 1;
        expect([r.source[i - 1].pitch, r.source[i + 1]?.pitch]).not.toContain(r.played[i].pitch);
        expect(r.source).toEqual(tune.slice(r.start, r.start + 8));
      }
    }
  });

  it("a note boxed in on both sides isn't moved: another one is", () => {
    // Note 2 (62) sits between 60 and 64: at shift 2 both moves land on a neighbor, so it's never the changed note.
    const tune = melody(chartOf([60, 62, 64, 64, 64, 64, 64, 64]));
    const rng = seeded(3);
    for (let k = 0; k < 100; k++) expect(makeRound(tune, rng, 2)!.changed).not.toBe(2);
    // A whole-tone run boxes in every inner note: only the last, with one neighbor, can move.
    for (let k = 0; k < 50; k++) expect(makeRound(melody(chartOf([60, 62, 64, 66, 68, 70, 72, 74])), rng, 2)!.changed).toBe(8);
    expect(makeRound(melody(chartOf([60, 62, 64])), seeded(1), 2)).toBeNull(); // shorter than a phrase
  });

  it("the same seed gives the same set", () => {
    const tune = melody(scale);
    expect(newSet(tune, 42)).toEqual(newSet(tune, 42));
    expect(newSet(tune, 42).rounds).not.toEqual(newSet(tune, 43).rounds);
  });
});

it("roundMessages: the moved pitch on channel 1, at the chart's beats and bpm, from startMs", () => {
  const r = newSet(melody(scale), 5).rounds[0];
  const ons = roundMessages(scale, r, 1000).filter((m) => m.bytes[0] === 0x90);
  expect(ons.map((m) => m.bytes[1])).toEqual(r.played.map((n) => n.pitch));
  expect(ons.map((m) => m.atMs)).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((k) => 1000 + k * 500)); // 120 bpm, a note a beat
  expect(roundMessages(scale, r, 0, true).filter((m) => m.bytes[0] === 0x90).map((m) => m.bytes[1])).toEqual(r.source.map((n) => n.pitch));
});

describe("step", () => {
  it("scores a right answer, not a wrong one, counts replays, and ends after round 10", () => {
    let s = newSet(melody(scale), 9);
    expect(s.rounds).toHaveLength(wrongNoteSettings.rounds);
    s = step(step(s, { type: "replay" }), { type: "replay" });
    s = step(s, { type: "answer", note: s.rounds[0].changed });
    expect(s.phase).toBe("reveal");
    expect(s.answers[0]).toEqual({ changed: s.rounds[0].changed, answer: s.rounds[0].changed, replays: 2 });
    expect(step(s, { type: "answer", note: 3 })).toBe(s); // one answer per round
    s = step(s, { type: "next" });
    const wrong = s.rounds[1].changed === 2 ? 3 : 2;
    s = step(s, { type: "answer", note: wrong });
    expect(score(s)).toBe(1);
    expect(step(step(s, { type: "next" }), { type: "answer", note: 1 }).phase).toBe("ask"); // note 1 never moves
    for (let k = 2; k < 10; k++) s = step(step(s, { type: "next" }), { type: "answer", note: 2 });
    expect(s.phase).toBe("reveal");
    s = step(s, { type: "next" });
    expect(s.phase).toBe("done");
    expect(s.answers).toHaveLength(10);
  });
});

it("sendAhead: a stop leaves no key down and nothing sounds later; left alone, every message goes out on time", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  try {
    const r = newSet(melody(scale), 1).rounds[0];
    const heard: { at: number; msg: number[] }[] = [];
    const out = { send: (m: Iterable<number>, ts?: number) => void heard.push({ at: ts ?? performance.now(), msg: [...m] }) };
    const msgs = roundMessages(scale, r, performance.now());
    const stop = sendAhead(out, msgs);
    vi.advanceTimersByTime(1200);
    stop();
    const stoppedAt = performance.now();
    vi.advanceTimersByTime(5000);
    const down = new Set<number>();
    for (const { msg } of [...heard].sort((a, b) => a.at - b.at)) {
      if (msg[0] === 0x90) down.add(msg[1]);
      else if (msg[0] === 0x80) down.delete(msg[1]);
      else if (msg[0] === 0xb0 && msg[1] === 123) down.clear();
    }
    expect([...down]).toEqual([]);
    expect(heard.filter((e) => e.msg[0] === 0x90 && e.at > stoppedAt + 100)).toEqual([]);

    heard.length = 0;
    sendAhead(out, roundMessages(scale, r, performance.now()));
    vi.advanceTimersByTime(5000);
    expect(heard.map((e) => e.msg)).toEqual(roundMessages(scale, r, 0).map((m) => m.bytes));
  } finally {
    vi.useRealTimers();
  }
});

describe("the page's keys (#1323)", () => {
  // Node has no DOM: a stand-in Element whose closest() answers for a link, a button or plain page.
  class El {
    constructor(private tag: string) {}
    closest(sel: string) {
      return sel.split(", ").includes(this.tag) ? this : null;
    }
  }
  const press = (code: string, tag: string, phase?: "ask" | "reveal" | "done") => {
    vi.stubGlobal("Element", El);
    const e = { key: code === "Space" ? " " : code, code, repeat: false, metaKey: false, ctrlKey: false, altKey: false, target: new El(tag), defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    const dispatch = vi.fn();
    const start = vi.fn();
    pageKey(e as unknown as KeyboardEvent, phase, dispatch, start);
    vi.unstubAllGlobals();
    return { e, dispatch, start };
  };

  it("leaves Enter and Space on a link or button to it", () => {
    for (const tag of ["a", "button"])
      for (const code of ["Enter", "Space"]) {
        const { e, dispatch, start } = press(code, tag, "done");
        expect(e.defaultPrevented).toBe(false);
        expect(start).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
      }
  });

  it("still starts and moves on from the page itself", () => {
    const begin = press("Enter", "main");
    expect(begin.e.defaultPrevented).toBe(true);
    expect(begin.start).toHaveBeenCalledOnce();
    const next = press("Space", "main", "reveal");
    expect(next.dispatch).toHaveBeenCalledWith({ type: "next" });
  });
});
