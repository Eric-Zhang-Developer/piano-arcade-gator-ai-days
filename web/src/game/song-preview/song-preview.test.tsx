import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Chart } from "../../contracts";
import { isLearnKey, SongPreview } from ".";
import { opening, playOnPiano, practiceUrl } from "./opening";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const twinkle = song("twinkle");

describe("opening", () => {
  it("holds exactly the notes that start in the first 5 s, at the chart's tempo", () => {
    const notes = opening(twinkle); // 100 bpm, 600 ms a beat: beats 0–8 start before 5 s
    expect(notes.map((n) => n.pitch)).toEqual(twinkle.notes.filter((n) => n.beat * 600 < 5000).map((n) => n.pitch));
    expect(notes[0].startMs).toBe(0);
    expect(notes.at(-1)!.startMs).toBeLessThan(5000);
  });

  it("every song stops at 5 s: a held note is cut there, however slow the chart", () => {
    const slow: Chart = { ...twinkle, bpm: 30 }; // 2 s a beat
    const notes = opening(slow);
    expect(notes.map((n) => n.startMs)).toEqual([0, 2000, 4000]);
    expect(Math.max(...notes.map((n) => n.startMs + n.durMs))).toBe(5000);
  });

  it("starts on the first note when the chart opens on rests", () => {
    const late: Chart = { ...twinkle, notes: twinkle.notes.map((n) => ({ ...n, beat: n.beat + 3 })) };
    expect(opening(late)[0].startMs).toBe(0);
    expect(opening(late).map((n) => n.pitch)).toEqual(opening(twinkle).map((n) => n.pitch));
  });
});

it("PRACTICE 70% opens bar-loop on the whole song", () => {
  expect(practiceUrl("twinkle", twinkle)).toBe("/play?song=twinkle&from=1&to=12&tempo=70&passes=1");
});

it("the piano gets only the notes due soon, and stopping sends All Notes Off on channel 1", () => {
  const sent: number[][] = [];
  let cleared = 0;
  const stop = playOnPiano({ send: (m) => void sent.push([...m]), clear: () => void cleared++ }, opening(twinkle));
  expect(sent[0]).toEqual([0x90, 60, 80]);
  expect(sent.filter((m) => m[0] === 0x90)).toHaveLength(1); // the next note is 600 ms away: not sent yet
  stop();
  expect(cleared).toBe(1);
  expect(sent.at(-1)).toEqual([0xb0, 123, 0]);
});

// What the piano hears, and when: a Web MIDI output plays a timestamped message at its timestamp, and Chrome has no
// clear() to take one back (the stand-in in verify-preview played everything at once, so it never caught this).
it("a stopped preview leaves no key down, and nothing queued sounds seconds later", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "performance"] });
  try {
    const heard: { at: number; msg: number[] }[] = [];
    const stop = playOnPiano({ send: (m, ts) => void heard.push({ at: ts ?? performance.now(), msg: [...m] }) }, opening(twinkle));
    vi.advanceTimersByTime(1000); // the highlight moves on mid-opening
    stop();
    const stoppedAt = performance.now();
    vi.advanceTimersByTime(10_000);
    const down = new Set<number>();
    for (const { msg } of [...heard].sort((a, b) => a.at - b.at)) {
      if (msg[0] === 0x90) down.add(msg[1]);
      else if (msg[0] === 0x80) down.delete(msg[1]);
      else if (msg[0] === 0xb0 && msg[1] === 123) down.clear();
    }
    expect([...down]).toEqual([]);
    expect(heard.filter((e) => e.msg[0] === 0x90 && e.at > stoppedAt + 100).map((e) => e.at - stoppedAt)).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it("left alone, the whole opening reaches the piano, each note stamped with its own time", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
  try {
    const at = performance.now();
    const ons: number[] = [];
    playOnPiano({ send: (m, ts) => void ([...m][0] === 0x90 && ons.push(ts! - at)) }, opening(twinkle));
    vi.advanceTimersByTime(6000);
    expect(ons).toEqual(opening(twinkle).map((n) => n.startMs));
  } finally {
    vi.useRealTimers();
  }
});

it("the panel keeps the status line, and leaves best, LEARN and PRACTICE to the select's panel (duo-select)", () => {
  const html = renderToStaticMarkup(<SongPreview id="fur-elise" />);
  expect(html).toContain("Press any key for previews");
  for (const gone of ["preview-best", "preview-learn", "preview-practice", "preview-nps"]) expect(html).not.toContain(gone);
});

it("L is plain l or L: no Ctrl, Meta or Alt, no repeat", () => {
  const k = (key: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "repeat", boolean>> = {}) =>
    isLearnKey({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...mods });
  expect([k("l"), k("L")]).toEqual([true, true]);
  expect([k("l", { metaKey: true }), k("l", { ctrlKey: true }), k("l", { altKey: true }), k("l", { repeat: true }), k("k")]).toEqual([false, false, false, false, false]);
});
