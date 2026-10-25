import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { chartToMusicXml, DIVISIONS, keyAndMeter, pickupBeats, placeNotes } from ".";
import { overrides } from "./overrides";
import { shouldBeam } from "../sheet-beams";
import { LAB_ONLY } from "../song-select/load";

const songs = new URL("../../../public/songs/", import.meta.url);
const charts: Chart[] = readdirSync(songs)
  .filter((d) => d !== "local" && !LAB_ONLY.includes(d))
  .map((d) => JSON.parse(readFileSync(new URL(`${d}/chart.json`, songs), "utf8")));
const byId = (id: string) => charts.find((c) => c.id === id)!;
const S = DIVISIONS / 4; // a 16th

// ---------- a small tag reader (no dependency) ----------

type El = { name: string; attrs: Record<string, string>; kids: El[]; text: string };
function parse(xml: string): El {
  const root: El = { name: "#root", attrs: {}, kids: [], text: "" };
  const stack = [root];
  const re = /<\?[^>]*\?>|<(\/?)([\w-]+)((?:\s+[\w-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  for (const m of xml.matchAll(re)) {
    if (m[0].startsWith("<?")) continue;
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      top.text += m[5];
      continue;
    }
    const [, close, name, attrText, selfClose] = m;
    if (close) {
      if (top.name !== name) throw new Error(`</${name}> closes <${top.name}>`);
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries([...attrText.matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
    const el: El = { name, attrs, kids: [], text: "" };
    top.kids.push(el);
    if (!selfClose) stack.push(el);
  }
  if (stack.length !== 1) throw new Error(`<${stack[stack.length - 1].name}> never closed`);
  if (root.kids.length !== 1) throw new Error(`${root.kids.length} roots`);
  return root.kids[0];
}
const kid = (e: El, n: string) => e.kids.find((k) => k.name === n);
const kids = (e: El, n: string) => e.kids.filter((k) => k.name === n);
const num = (e: El | undefined) => Number(e?.text ?? NaN);
const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// A measure's length as its first voice fills it: everything before the first <backup>.
function firstVoiceLength(m: El): number {
  let len = 0;
  for (const e of m.kids) {
    if (e.name === "backup") break;
    if (e.name === "forward" || (e.name === "note" && !kid(e, "chord"))) len += num(kid(e, "duration"));
  }
  return len;
}

// Every sounding note read back (tied pieces joined), and each bar's per-voice totals. An implicit bar 0 (a pickup)
// is the end of the chart's first bar, so the read-back stays in chart time.
function readBack(xml: string) {
  const score = parse(xml);
  const measures = kids(kid(score, "part")!, "measure");
  const notes: { staff: number; onset: number; end: number; pitch: number }[] = [];
  const open = new Map<string, (typeof notes)[number]>(); // a tie in progress, by staff:voice:pitch (#989)
  const voiceTotals: { bar: number; voice: string; total: number; barLen: number }[] = [];
  let divisions = 0;
  let barLen = 0;
  measures.forEach((m, b) => {
    const attrs = kid(m, "attributes");
    const t = attrs && kid(attrs, "time"); // a later bar's attributes are only a clef change
    if (attrs && t) {
      divisions = num(kid(attrs, "divisions"));
      barLen = (divisions * 4 * num(kid(t, "beats"))) / num(kid(t, "beat-type"));
    }
    const start = b === 0 && m.attrs.implicit === "yes" ? barLen - firstVoiceLength(m) : b * barLen;
    let at = start;
    let last = start;
    const totals = new Map<string, number>();
    for (const e of m.kids) {
      if (e.name === "backup") at -= num(kid(e, "duration"));
      if (e.name === "forward") {
        const v = kid(e, "voice")!.text;
        totals.set(v, (totals.get(v) ?? 0) + num(kid(e, "duration")));
        at += num(kid(e, "duration"));
      }
      if (e.name !== "note") continue;
      const d = num(kid(e, "duration"));
      const v = kid(e, "voice")!.text;
      const chord = !!kid(e, "chord");
      const onset = chord ? last : at;
      if (!chord) {
        totals.set(v, (totals.get(v) ?? 0) + d);
        at += d;
      }
      last = onset;
      const p = kid(e, "pitch");
      if (!p) continue;
      const midi = (num(kid(p, "octave")) + 1) * 12 + STEP_PC[kid(p, "step")!.text] + (kid(p, "alter") ? num(kid(p, "alter")) : 0);
      const staff = num(kid(e, "staff"));
      const ties = kids(e, "tie").map((t) => t.attrs.type);
      const k = `${staff}:${v}:${midi}`; // a held note and a new one at its pitch can overlap in two voices
      if (ties.includes("stop") && open.has(k)) {
        const n = open.get(k)!;
        n.end = onset + d;
        if (!ties.includes("start")) open.delete(k);
      } else {
        const n = { staff, onset, end: onset + d, pitch: midi };
        notes.push(n);
        if (ties.includes("start")) open.set(k, n);
      }
    }
    for (const [voice, total] of totals) voiceTotals.push({ bar: b + 1, voice, total, barLen: (b + 1) * barLen - start });
  });
  return { score, notes, voiceTotals, divisions };
}

const sortNotes = <T extends { staff: number; onset: number; pitch: number }>(ns: T[]) =>
  [...ns].sort((a, b) => a.staff - b.staff || a.onset - b.onset || a.pitch - b.pitch);

describe.each(charts.map((c) => [c.id, c] as const))("%s", (_, chart) => {
  const xml = chartToMusicXml(chart);
  const back = readBack(xml);

  it("is well formed, and each staff reads back as exactly its hand's notes", () => {
    expect(back.score.name).toBe("score-partwise");
    expect(back.divisions).toBe(DIVISIONS);
    const want = placeNotes(chart).map(({ staff, onset, end, pitch }) => ({ staff, onset, end, pitch }));
    expect(sortNotes(back.notes)).toEqual(sortNotes(want));
  });

  it("fills every voice of every bar exactly", () => {
    const bad = back.voiceTotals.filter((t) => t.total !== t.barLen);
    expect(bad).toEqual([]);
  });

  it("places every note at a different (staff, onset, pitch)", () => {
    const keys = placeNotes(chart).map((p) => `${p.staff}:${p.onset}:${p.pitch}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is the same string every time", () => {
    expect(chartToMusicXml(chart)).toBe(xml);
  });

  it("writes sheet-beams' beams: one begin … end run per beam, on each chord's first note only", () => {
    const marks = [...xml.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]);
    const beams = shouldBeam(placeNotes(chart), keyAndMeter(chart).meter);
    expect(marks.filter((m) => m === "begin")).toHaveLength(beams.length);
    expect(marks.join(" ")).toMatch(/^(begin( continue)* end ?)*$/); // a beam is one voice in one bar, so it's contiguous
    const chords = beams.reduce((n, ids) => n + new Set(ids.map((id) => placeNotes(chart).find((p) => p.id === id)!.onset)).size, 0);
    expect(marks).toHaveLength(chords);
  });
});

// ---------- fixed cases ----------

const attrs = (c: Chart, song = c) => {
  const m = kid(kid(parse(chartToMusicXml(c, song)), "part")!, "measure")!;
  const a = kid(m, "attributes")!;
  const key = kid(a, "key")!;
  const time = kid(a, "time")!;
  return {
    fifths: num(kid(key, "fifths")),
    mode: kid(key, "mode")!.text,
    beats: num(kid(time, "beats")),
    beatType: num(kid(time, "beat-type")),
    ...(m.attrs.implicit === "yes" && { pickup: true }),
  };
};
const spelled = (c: Chart, midi: number) => {
  const xml = chartToMusicXml(c);
  const n = parse(xml);
  for (const m of kids(kid(n, "part")!, "measure"))
    for (const e of kids(m, "note")) {
      const p = kid(e, "pitch");
      if (!p) continue;
      const s = kid(p, "step")!.text;
      const alter = kid(p, "alter") ? num(kid(p, "alter")) : 0;
      const oct = num(kid(p, "octave"));
      if ((oct + 1) * 12 + STEP_PC[s] + alter === midi) return `${s}${alter > 0 ? "♯" : alter < 0 ? "♭" : ""}${oct}`;
    }
  return null;
};
const synthetic = (over: Partial<Chart>): Chart => ({
  id: "synthetic",
  title: "t",
  composer: "c",
  source: "test",
  bpm: 100,
  beatsPerBar: 4,
  notes: [],
  ...over,
});

describe("fixed cases", () => {
  it("Twinkle is C major in 4/4", () => {
    expect(attrs(byId("twinkle"))).toEqual({ fifths: 0, mode: "major", beats: 4, beatType: 4 });
  });

  it("Für Elise is 3/8 and spells MIDI 75 as D♯5", () => {
    expect(attrs(byId("fur-elise"))).toMatchObject({ beats: 3, beatType: 8 });
    expect(spelled(byId("fur-elise"), 75)).toBe("D♯5");
  });

  it("a transformed chart keeps its song's key: Für Elise's right hand alone is still A minor", () => {
    const song = byId("fur-elise");
    const right = { ...song, notes: song.notes.filter((n) => n.hand === "R") }; // what ?hands=R plays
    expect(keyAndMeter(right, song).key).toEqual({ fifths: 0, mode: "minor" });
    expect(attrs(right, song)).toMatchObject({ fifths: 0, mode: "minor" });
  });

  it("moonlight-3, in C♯ minor, spells MIDI 72 as B♯4", () => {
    expect(attrs(byId("moonlight-3"))).toMatchObject({ fifths: 4, mode: "minor" });
    expect(spelled(byId("moonlight-3"), 72)).toBe("B♯4");
  });

  it("every table entry is what its chart writes", () => {
    for (const [id, o] of Object.entries(overrides)) expect(attrs(byId(id)), id).toMatchObject(o);
  });

  it("an entry whose meter isn't beatsPerBar throws", () => {
    overrides["synthetic"] = { beats: 3, beatType: 4 };
    try {
      expect(() => keyAndMeter(synthetic({ notes: [{ id: "a", pitch: 60, beat: 0, duration: 1, hand: "R" }] }))).toThrow(/beatsPerBar/);
    } finally {
      delete overrides["synthetic"];
    }
  });

  it("a 5-16th note across a barline comes back as tied pieces of the right total", () => {
    const c = synthetic({ notes: [{ id: "a", pitch: 60, beat: 3.5, duration: 1.25, hand: "R" }] });
    const xml = chartToMusicXml(c);
    expect((xml.match(/<tie type="start"\/>/g) ?? []).length).toBeGreaterThan(0);
    expect(readBack(xml).notes).toEqual([{ staff: 1, onset: 14 * S, end: 19 * S, pitch: 60 }]);
  });

  it("a title with & < > is escaped and well formed", () => {
    const xml = chartToMusicXml(synthetic({ title: "A & B <C>", notes: [{ id: "a", pitch: 60, beat: 0, duration: 1, hand: "L" }] }));
    expect(() => parse(xml)).not.toThrow();
    expect(xml).toContain("<work-title>A &amp; B &lt;C&gt;</work-title>");
  });
});

describe("pickups (sheet-pickups)", () => {
  const firstBars = (c: Chart, song = c) =>
    kids(kid(parse(chartToMusicXml(c, song)), "part")!, "measure")
      .slice(0, 2)
      .map((m) => ({ number: m.attrs.number, implicit: m.attrs.implicit, len: firstVoiceLength(m) }));

  it.each([
    ["chopin-prelude-4", 4],
    ["fur-elise", 2],
    ["maple-leaf-rag", 2],
    ["nocturne-op9-2", 2],
  ] as const)("%s prints its pickup as an implicit bar 0 of %i 16ths, then bar 1", (id, sixteenths) => {
    const [zero, one] = firstBars(byId(id));
    expect(zero).toEqual({ number: "0", implicit: "yes", len: sixteenths * S });
    expect(one).toMatchObject({ number: "1", implicit: undefined });
    expect(pickupBeats(byId(id)) * DIVISIONS).toBe(sixteenths * S);
  });

  it("every other chart opens on bar 1, as before", () => {
    const pickups = ["chopin-prelude-4", "fur-elise", "maple-leaf-rag", "nocturne-op9-2"];
    for (const c of charts.filter((c) => !pickups.includes(c.id))) expect(firstBars(c)[0], c.id).toMatchObject({ number: "1", implicit: undefined });
  });

  it("a chart marked pickup whose first note is at beat 0 has no bar 0", () => {
    overrides["synthetic"] = { pickup: true };
    try {
      const c = synthetic({ notes: [{ id: "a", pitch: 60, beat: 0, duration: 1, hand: "R" }] });
      expect(pickupBeats(c)).toBe(0);
      expect(firstBars(c)[0].number).toBe("1");
    } finally {
      delete overrides["synthetic"];
    }
  });

  it("Für Elise's left hand alone (?hands=L) keeps bar 0", () => {
    const song = byId("fur-elise");
    const left = { ...song, notes: song.notes.filter((n) => n.hand === "L") };
    expect(firstBars(left, song)[0]).toEqual({ number: "0", implicit: "yes", len: 2 * S });
  });

  it("a part of the song with a note before the pickup (a loop shifted to beat 0) has no bar 0", () => {
    const song = byId("fur-elise");
    const shifted = { ...song, notes: song.notes.map((n) => ({ ...n, beat: n.beat - 1 })).filter((n) => n.beat >= 0) };
    expect(pickupBeats(shifted, song)).toBe(0);
  });
});

it("a fifth voice in one hand throws, naming the note", () => {
  const notes = [0, 0.25, 0.5, 0.75, 1].map((beat, i) => ({ id: `v${i}`, pitch: 60 + i, beat, duration: 4, hand: "R" as const }));
  expect(() => chartToMusicXml(synthetic({ notes }))).toThrow(/fifth voice .* v4/);
});

// The Lab's charts open in /sheet too (its Sheet music link), so each one prints (#1330).
const labCharts: Chart[] = LAB_ONLY.flatMap((dir) =>
  readdirSync(new URL(`${dir}/`, songs)).map((d) => JSON.parse(readFileSync(new URL(`${dir}/${d}/chart.json`, songs), "utf8"))),
);
it.each(labCharts.map((c) => [c.id, c] as const))("the Lab's %s prints", (_, c) => {
  expect(() => chartToMusicXml(c)).not.toThrow();
});

it("the charts stay within the writer's 4 voices a hand, and some use 2 or more", () => {
  const most = charts.map((c) => Math.max(0, ...[...chartToMusicXml(c).matchAll(/<voice>(\d)<\/voice>/g)].map((m) => ((Number(m[1]) - 1) % 4) + 1)));
  expect(Math.max(...most)).toBeLessThanOrEqual(4); // Chopin's Op. 28 No. 7 holds a note under two moving voices (#986)
  expect(Math.max(...most)).toBeGreaterThanOrEqual(2);
});

// ---------- engraving (sheet-engraving) ----------

describe("engraving", () => {
  const measures = (c: Chart) => kids(kid(parse(chartToMusicXml(c)), "part")!, "measure");
  const clefsIn = (m: El) => kids(kid(m, "attributes") ?? m, "clef").map((c) => `${c.attrs.number}=${kid(c, "sign")!.text}`);
  // n quarter notes a bar for `bars` bars, from bar `from`, at one pitch
  const bar = (from: number, bars: number, pitch: number, hand: "R" | "L") =>
    Array.from({ length: bars * 4 }, (_, i) => ({ id: `${hand}${pitch}-${from * 4 + i}`, pitch, beat: from * 4 + i, duration: 1, hand }));

  it("a left hand that climbs mid-piece changes to treble for the passage and back to bass after", () => {
    const c = synthetic({ notes: [...bar(0, 2, 48, "L"), ...bar(2, 2, 72, "L"), ...bar(4, 2, 48, "L"), ...bar(0, 6, 76, "R")] });
    const ms = measures(c);
    expect(ms.map(clefsIn)).toEqual([["1=G", "2=F"], [], ["2=G"], [], ["2=F"], []]);
    // the notes stay on the left hand's staff
    expect(readBack(chartToMusicXml(c)).notes.filter((n) => n.pitch === 72).every((n) => n.staff === 2)).toBe(true);
  });

  it("one stray high note doesn't change the clef", () => {
    const notes = [...bar(0, 3, 48, "L")];
    notes[5] = { ...notes[5], pitch: 79 };
    expect(measures(synthetic({ notes })).map(clefsIn)).toEqual([["1=G", "2=F"], [], []]);
  });

  it("a high right-hand run starts and stops an 8va, and the notes keep their real pitch", () => {
    const c = synthetic({ notes: [...bar(0, 1, 72, "R"), ...bar(1, 2, 96, "R"), ...bar(3, 1, 72, "R")] });
    const xml = chartToMusicXml(c);
    const shifts = measures(c).map((m) => [...JSON.stringify(m).matchAll(/"type":"(down|up|stop)","size":"8"/g)].map((x) => x[1]));
    expect(shifts).toEqual([[], ["down"], ["stop"], []]);
    expect(readBack(xml).notes.filter((n) => n.onset >= 4 * DIVISIONS && n.onset < 12 * DIVISIONS).map((n) => n.pitch)).toEqual(Array(8).fill(96));
    expect(placeNotes(c).filter((p) => p.pitch === 96)).toHaveLength(8);
  });

  it("a run of eighths each a little off the grid prints as beamed eighths, with no ties", () => {
    const off = [0.03, -0.04, 0.05, -0.02, 0.04, -0.05, 0.02, -0.03];
    const notes = off.map((d, i) => ({ id: `e${i}`, pitch: 72 + (i % 3), beat: Math.max(0, i / 2 + d), duration: 0.45, hand: "R" as const }));
    const xml = chartToMusicXml(synthetic({ notes }));
    expect([...xml.matchAll(/<type>(\w+)<\/type>/g)].map((m) => m[1]).filter((t) => t !== "whole")).toEqual(Array(8).fill("eighth"));
    expect([...xml.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]).join(" ")).toBe("begin end begin end begin end begin end");
    expect(xml).not.toContain("<tie ");
  });

  it("six notes a sixth of a beat apart print as triplet 16ths in two 3s, under one beam (the Pathétique, bar 8)", () => {
    const notes = [0, 1, 2, 3, 4, 5].map((i) => ({ id: `s${i}`, pitch: 60 + i, beat: i / 6, duration: 1 / 6, hand: "R" as const }));
    const c = synthetic({ notes });
    const X = DIVISIONS / 6; // a triplet 16th
    expect(placeNotes(c).map((p) => [p.onset, p.end])).toEqual([0, 1, 2, 3, 4, 5].map((i) => [i * X, (i + 1) * X]));
    const xml = chartToMusicXml(c);
    expect((xml.match(/<time-modification>/g) ?? []).length).toBe(6);
    expect((xml.match(/<tuplet type="start"\/>/g) ?? []).length).toBe(2);
    expect([...xml.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]).join(" ")).toBe("begin continue continue continue continue end");
  });

  it("a 16th figure ending in two 32nds prints them as 32nds, under one beam (the Pathétique, bar 5)", () => {
    const at = [0, 1 / 4, 1 / 2, 3 / 4, 7 / 8, 1];
    const notes = at.slice(0, -1).map((b, i) => ({ id: `t${i}`, pitch: 60 + i, beat: b, duration: at[i + 1] - b, hand: "R" as const }));
    const c = synthetic({ notes });
    expect(placeNotes(c).map((p) => [p.onset, p.end])).toEqual(at.slice(0, -1).map((b, i) => [b * DIVISIONS, at[i + 1] * DIVISIONS]));
    const xml = chartToMusicXml(c);
    expect((xml.match(/<type>32nd<\/type>/g) ?? []).length).toBe(2);
    expect(xml).not.toContain("<time-modification>");
    expect(xml).not.toContain("<tie ");
    expect([...xml.matchAll(/<beam number="1">(\w+)<\/beam>/g)].map((m) => m[1]).join(" ")).toBe("begin continue continue continue end");
  });

  it("a 32nd at the end of a beat prints there, not at a sextuplet's 5/6 (the Pathétique, bar 16)", () => {
    const notes = [
      { id: "w0", pitch: 60, beat: 0, duration: 1 / 2, hand: "R" as const },
      { id: "w1", pitch: 60, beat: 7 / 8, duration: 1 / 8, hand: "R" as const },
    ];
    expect(placeNotes(synthetic({ notes })).map((p) => p.onset)).toEqual([0, (7 / 8) * DIVISIONS]);
  });

  it("a beat of 16ths over triplets snaps to 16ths and triplets, not to 32nds", () => {
    const tune = [0, 1, 2, 3].map((i) => ({ id: `u${i}`, pitch: 72 + i, beat: i / 4, duration: 1 / 4, hand: "R" as const }));
    const trip = [0, 1, 2].map((i) => ({ id: `v${i}`, pitch: 60 + i, beat: i / 3, duration: 1 / 3, hand: "R" as const }));
    const onsets = placeNotes(synthetic({ notes: [...tune, ...trip] })).map((p) => p.onset);
    expect(onsets.every((o) => o % (DIVISIONS / 4) === 0 || o % (DIVISIONS / 3) === 0)).toBe(true);
  });

  it("a moonlight-1 triplet comes back as three triplet eighths in one beat", () => {
    const moon = byId("moonlight-1");
    const beat = moon.notes.find((n) => n.hand === "R" && Math.abs(n.beat % 1 - 1 / 3) < 0.01)!.beat;
    const k = Math.floor(beat);
    const three = moon.notes.filter((n) => n.hand === "R" && n.beat >= k && n.beat < k + 1 && n.duration < 0.5);
    const placed = placeNotes(moon).filter((p) => three.some((n) => n.id === p.id));
    const T = DIVISIONS / 3; // an eighth triplet
    expect(placed.map((p) => [p.onset - k * DIVISIONS, p.end - k * DIVISIONS])).toEqual([
      [0, T],
      [T, 2 * T],
      [2 * T, 3 * T],
    ]);
    const xml = chartToMusicXml(moon);
    expect(xml).toContain("<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>");
    expect((xml.match(/<tuplet type="start"\/>/g) ?? []).length).toBe((xml.match(/<tuplet type="stop"\/>/g) ?? []).length);
  });
});
