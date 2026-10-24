import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { chartToMusicXml, DIVISIONS, keyAndMeter, placeNotes } from ".";
import { overrides } from "./overrides";

const songs = new URL("../../../public/songs/", import.meta.url);
const charts: Chart[] = readdirSync(songs)
  .filter((d) => d !== "local")
  .map((d) => JSON.parse(readFileSync(new URL(`${d}/chart.json`, songs), "utf8")));
const byId = (id: string) => charts.find((c) => c.id === id)!;

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

// Every sounding note read back (tied pieces joined), and each bar's per-voice totals.
function readBack(xml: string) {
  const score = parse(xml);
  const measures = kids(kid(score, "part")!, "measure");
  const notes: { staff: number; onset: number; end: number; pitch: number }[] = [];
  const open = new Map<string, (typeof notes)[number]>(); // a tie in progress, by staff:pitch
  const voiceTotals: { bar: number; voice: string; total: number; barLen: number }[] = [];
  let divisions = 0;
  let barLen = 0;
  measures.forEach((m, b) => {
    const attrs = kid(m, "attributes");
    if (attrs) {
      divisions = num(kid(attrs, "divisions"));
      const t = kid(attrs, "time")!;
      barLen = (divisions * 4 * num(kid(t, "beats"))) / num(kid(t, "beat-type"));
    }
    const start = b * barLen;
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
      const k = `${staff}:${midi}`;
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
    for (const [voice, total] of totals) voiceTotals.push({ bar: b + 1, voice, total, barLen });
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
});

// ---------- fixed cases ----------

const attrs = (c: Chart) => {
  const a = kid(kid(kid(parse(chartToMusicXml(c)), "part")!, "measure")!, "attributes")!;
  const key = kid(a, "key")!;
  const time = kid(a, "time")!;
  return { fifths: num(kid(key, "fifths")), mode: kid(key, "mode")!.text, beats: num(kid(time, "beats")), beatType: num(kid(time, "beat-type")) };
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
    expect(readBack(xml).notes).toEqual([{ staff: 1, onset: 14, end: 19, pitch: 60 }]);
  });

  it("a title with & < > is escaped and well formed", () => {
    const xml = chartToMusicXml(synthetic({ title: "A & B <C>", notes: [{ id: "a", pitch: 60, beat: 0, duration: 1, hand: "L" }] }));
    expect(() => parse(xml)).not.toThrow();
    expect(xml).toContain("<work-title>A &amp; B &lt;C&gt;</work-title>");
  });
});

it("a fifth voice in one hand throws, naming the note", () => {
  const notes = [0, 0.25, 0.5, 0.75, 1].map((beat, i) => ({ id: `v${i}`, pitch: 60 + i, beat, duration: 4, hand: "R" as const }));
  expect(() => chartToMusicXml(synthetic({ notes }))).toThrow(/fifth voice .* v4/);
});

it("the charts use what the spec's planning check found: at most 2 voices a hand, and some use 2", () => {
  const most = charts.map((c) => Math.max(0, ...[...chartToMusicXml(c).matchAll(/<voice>(\d)<\/voice>/g)].map((m) => ((Number(m[1]) - 1) % 4) + 1)));
  expect(Math.max(...most)).toBe(2);
});
