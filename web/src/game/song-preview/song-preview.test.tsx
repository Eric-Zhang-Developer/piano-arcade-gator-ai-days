import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { isLearnKey, SongPreview } from ".";
import { opening, playOnPiano, practiceUrl } from "./opening";

const song = (id: string): Chart => JSON.parse(readFileSync(new URL(`../../../public/songs/${id}/chart.json`, import.meta.url), "utf8"));
const twinkle = song("twinkle");

describe("opening", () => {
  it("holds exactly the notes that start in bars 1–2", () => {
    const notes = opening(twinkle); // 4/4 at its own tempo: beats 0–7
    expect(notes.map((n) => n.pitch)).toEqual(twinkle.notes.filter((n) => n.beat < 8).map((n) => n.pitch));
    expect(notes[0].startMs).toBe(0);
  });

  it("is cut at 8 s", () => {
    const slow: Chart = { ...twinkle, bpm: 30 }; // 2 s a beat: bars 1–2 last 16 s
    const notes = opening(slow);
    expect(notes.length).toBeGreaterThan(0);
    expect(Math.max(...notes.map((n) => n.startMs + n.durMs))).toBeLessThanOrEqual(8000);
    expect(notes.map((n) => n.startMs)).toEqual([0, 2000, 4000, 6000]);
  });

  it("starts on the first note when the chart opens on rests", () => {
    const late: Chart = { ...twinkle, notes: twinkle.notes.map((n) => ({ ...n, beat: n.beat + 3 })) };
    expect(opening(late)[0].startMs).toBe(0);
    expect(opening(late)).toHaveLength(5); // beats 3–7 of bars 1–2
  });
});

it("PRACTICE 70% opens bar-loop on the whole song", () => {
  expect(practiceUrl("twinkle", twinkle)).toBe("/play?song=twinkle&from=1&to=12&tempo=70&passes=1");
});

it("stopping cancels the queue and sends All Notes Off on channel 1", () => {
  const sent: number[][] = [];
  let cleared = 0;
  const stop = playOnPiano({ send: (m) => void sent.push([...m]), clear: () => void cleared++ }, opening(twinkle), 0);
  expect(sent[0]).toEqual([0x90, 60, 80]);
  stop();
  expect(cleared).toBe(1);
  expect(sent.at(-1)).toEqual([0xb0, 123, 0]);
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
