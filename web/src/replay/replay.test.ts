import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";
import type { Chart } from "../contracts";
import { buildBoard, type AnyPr, type Inputs } from "../operator/board";
import { boardCounters, chapters, counters, doneAt, layout, msPerBeat, noteLeftMs, steps, timeline } from "./model";
import { pianoVoice, pickOutput } from "./piano";

const chart: Chart = JSON.parse(readFileSync(new URL("../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const AT = "2026-10-24T12:00:00.000Z";
const h = (hours: number) => new Date(Date.parse("2026-10-23T21:00:00Z") + hours * 3_600_000).toISOString();

const pr = (number: number, title: string, opened: number, merged: number | null, more: Partial<AnyPr> = {}): AnyPr => ({
  number, title, body: "Worker: eric-1", state: merged === null ? "OPEN" : "MERGED", createdAt: h(opened),
  mergedAt: merged === null ? null : h(merged), closedAt: merged === null ? null : h(merged), url: `u${number}`, ...more,
});

// a <- b <- c, and d alone; milestone m1 = a, b; m2 = c, d. a and b are done; c is in flight.
function board(prs: AnyPr[]) {
  const spec = (slug: string, dependsOn: string[] = []) => ({ slug, name: slug, dependsOn, assignee: "" });
  const inputs: Inputs = {
    at: AT, sha: "s", mainSha: "s", stop: false, banner: [], gh: { status: "ok", calls: 4 }, heartbeats: [],
    specs: [spec("a"), spec("b", ["a"]), spec("c", ["b", "a"]), spec("d")],
    done: ["a", "b"],
    milestones: [{ name: "m1", features: ["a", "b"], cut: [] }, { name: "m2", features: ["c", "d"], cut: [] }],
    openPrs: prs.filter((p) => p.state === "OPEN").map((p) => ({ ...p, body: p.body ?? "", isDraft: false, updatedAt: p.createdAt, ci: "pass" as const })),
    allPrs: prs, issues: [], mainRun: null,
  };
  return buildBoard(inputs);
}

const PRS = [
  pr(1, "plan: specs", 0, 1, { body: "" }),
  pr(2, "feat(a): a", 0.5, 2),
  pr(3, "fix(a): a", 2.5, 3, { body: "Worker: eric-2" }),
  pr(4, "feat(b): b", 1, 4),
  pr(5, "feat(c): c", 4.5, null, { body: "Worker: eric-2" }),
  pr(6, "feat(d): d, abandoned", 2, null, { state: "CLOSED", closedAt: h(3), mergedAt: null }),
];

test("layout: one position per spec, each a row behind its dependencies, no two the same", () => {
  const b = board(PRS);
  const pos = layout(b.features);
  expect([...pos.keys()].sort()).toEqual(["a", "b", "c", "d"]);
  for (const f of b.features) for (const d of f.dependsOn) expect(pos.get(f.slug)!.z).toBeGreaterThan(pos.get(d)!.z);
  const keys = [...pos.values()].map((p) => `${p.x},${p.z}`);
  expect(new Set(keys).size).toBe(keys.length);
  expect(pos.get("c")!.z).toBe(2);
  expect(layout([{ slug: "x", dependsOn: ["y"] }, { slug: "y", dependsOn: ["x"] }]).size).toBe(2); // a cycle can't hang it
});

test("steps: N merges give N steps in merge order, on the chart's beats, wrapping after the last note", () => {
  const ss = steps(board(PRS).prs!, chart);
  expect(ss.map((s) => s.pr.number)).toEqual([1, 2, 3, 4]);
  const beat = msPerBeat(chart);
  ss.forEach((s, k) => {
    expect(s.note).toBe(chart.notes[k]);
    expect(s.atMs).toBe(chart.notes[k].beat * beat);
    expect(s.noteMs).toBe(chart.notes[k].duration * beat);
  });
  expect(ss.map((s) => s.feat)).toEqual([null, "a", null, "b"]);
  const n = chart.notes.length;
  const many = Array.from({ length: n + 2 }, (_, k) => pr(100 + k, `fix: x${k}`, k, k + 0.5));
  const wrapped = steps(board(many).prs!, chart);
  const last = chart.notes[n - 1];
  expect(wrapped[n].note).toBe(chart.notes[0]);
  expect(wrapped[n].atMs).toBe((last.beat + last.duration) * beat);
  expect(wrapped[n].atMs).toBeGreaterThan(wrapped[n - 1].atMs);
  expect(wrapped[0].wallMs).toBe(0);
  expect(wrapped.at(-1)!.wallMs).toBeCloseTo(wrapped.at(-1)!.atMs);
});

test("the counters climb, and at the last step equal the board's", () => {
  const b = board(PRS);
  const ss = steps(b.prs!, chart);
  const done = doneAt(b, ss);
  expect(counters(b, ss, done, -1)).toEqual({ done: 0, planned: 4, merged: 0, agents: 0 });
  expect(counters(b, ss, done, 1)).toMatchObject({ done: 1, merged: 2 });
  expect(counters(b, ss, done, ss.length - 1)).toEqual(boardCounters(b));
  expect(boardCounters(b)).toEqual({ done: 2, planned: 4, merged: 4, agents: 1 });
});

test("chapters: the first PR, a milestone at its last live feature's merge, none unbuilt, the timeline's peak", () => {
  const b = board(PRS);
  const ss = steps(b.prs!, chart);
  const tl = timeline(b.prs!, Date.parse(AT));
  const cs = chapters(b, ss, doneAt(b, ss), tl.peak);
  expect(cs.find((c) => c.step === -1)?.text).toMatch(/^The first PR: #1 /);
  expect(cs.filter((c) => c.text.startsWith("Milestone"))).toEqual([{ step: 3, text: "Milestone built: m1" }]);
  const peak = cs.find((c) => c.text.startsWith("Peak"))!;
  expect(peak.text).toBe(`Peak: ${tl.peak.open} PRs open at once`);
  // Open at h(2.5): #4, #6 and #3 (#2 closed at 2 as #6 opened) -> 3; the first merge after that is #3, step 2.
  expect(tl.peak).toEqual({ open: 3, at: Date.parse(h(2.5)) });
  expect(peak.step).toBe(2);
});

test("timeline rows: one per worker by first PR, open bars end now, overlaps take sub-rows", () => {
  const now = Date.parse(AT);
  const tl = timeline(board(PRS).prs!, now);
  expect(tl.rows.map((r) => r.worker)).toEqual(["planner", "eric-1", "eric-2"]);
  const eric1 = tl.rows[1];
  // #4 overlaps #2, so it drops to sub-row 1; #6 opens as #2 merges, so it reuses sub-row 0.
  expect(eric1.bars.map((b) => [b.pr.number, b.lane])).toEqual([[2, 0], [4, 1], [6, 0]]);
  expect(eric1.lanes).toBe(2);
  const open = tl.rows[2].bars.find((b) => b.pr.number === 5)!;
  expect([open.how, open.end]).toEqual(["open", now]);
  expect(tl.rows[1].bars.find((b) => b.pr.number === 6)!.how).toBe("closed");
  expect(Math.max(...tl.open.map((o) => o.n))).toBe(tl.peak.open);
});

test("piano: picks Portable Grand over another output; stop sends CC 123 on all 16 channels", () => {
  const other = { name: "IAC Driver Bus 1", send: vi.fn() };
  const grand = { name: "Portable Grand", send: vi.fn() };
  const access = { outputs: new Map([["1", other], ["2", grand]]) } as unknown as MIDIAccess;
  const out = pickOutput(access)!;
  expect(out).toBe(grand);
  expect(pickOutput({ outputs: new Map([["1", other]]) } as unknown as MIDIAccess)).toBeNull();
  // A clock value where (now + 600) - now isn't exactly 600 in floating point: about 2% of real values are.
  const clock = vi.spyOn(performance, "now").mockReturnValue(519.8459128728183);
  const voice = pianoVoice(out);
  voice.note(60, 600);
  clock.mockRestore();
  expect(grand.send.mock.calls[0][0]).toEqual([0x90, 60, 80]);
  expect(grand.send.mock.calls[1][0]).toEqual([0x80, 60, 0]);
  expect(grand.send.mock.calls[1][1] - grand.send.mock.calls[0][1]).toBeCloseTo(600, 9);
  grand.send.mockClear();
  voice.stop();
  expect(grand.send.mock.calls.map((c) => c[0])).toEqual(Array.from({ length: 16 }, (_, ch) => [0xb0 | ch, 123, 0]));
  expect(other.send).not.toHaveBeenCalled();
});

test("a late step's note still ends before the next step's note-on, so a repeated pitch isn't cut short", () => {
  const [a, b] = steps(board(PRS).prs!, chart); // Twinkle opens C C: the same pitch twice
  expect(a.note.pitch).toBe(b.note.pitch);
  const origin = 1000;
  for (const late of [0, 40, 300]) {
    const on = origin + a.atMs + late;
    const off = on + noteLeftMs(origin, a, on);
    expect(off).toBeLessThan(origin + b.atMs); // b's note-on fires no earlier than its own time
  }
});
