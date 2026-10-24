import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { buildBoard, featureState, needsPerson, parseFrontmatter, parseMilestones, specFrom, titleType, toSnapshot, workerOf, type Inputs, type OpenPr } from "./board";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const AT = "2026-10-24T12:00:00.000Z";
const minsBefore = (m: number) => new Date(Date.parse(AT) - m * 60_000).toISOString();

const spec = (slug: string, dependsOn: string[] = []) => ({ slug, name: slug, dependsOn, assignee: "" });
const pr = (number: number, title: string, more: Partial<OpenPr> = {}): OpenPr => ({
  number, title, body: "", isDraft: false, url: `https://github.com/o/r/pull/${number}`,
  createdAt: minsBefore(100), updatedAt: minsBefore(1), ci: "pass", ...more,
});
const inputs = (more: Partial<Inputs> = {}): Inputs => ({
  at: AT, sha: "abc1234", mainSha: "abc1234", specs: [], done: [], milestones: [], stop: false,
  openPrs: [], allPrs: [], issues: [], mainRun: { conclusion: "success", url: "u", updatedAt: AT },
  heartbeats: [], gh: { status: "ok", calls: 4 }, banner: [], ...more,
});

test("state rules: done, in flight, ready, blocked, backlog, cut, and unknown without PR data", () => {
  const ms = [{ name: "m1", features: ["a", "b", "c", "d", "e"], cut: ["e"] }];
  const done = new Set(["a"]);
  const flying = new Set(["b"]);
  expect(featureState(spec("a"), done, ms, flying)).toBe("done");
  expect(featureState(spec("b", ["a"]), done, ms, flying)).toBe("in flight");
  expect(featureState(spec("c", ["a"]), done, ms, flying)).toBe("ready");
  expect(featureState(spec("d", ["b"]), done, ms, flying)).toBe("blocked");
  expect(featureState(spec("e"), done, ms, flying)).toBe("cut");
  expect(featureState(spec("z"), done, ms, flying)).toBe("backlog");
  expect(featureState(spec("c", ["a"]), done, ms, null)).toBe("unknown");
  expect(featureState(spec("a"), done, ms, null)).toBe("done");
  expect(featureState(spec("z"), done, ms, null)).toBe("backlog");
});

test("in flight comes from open feat(<slug>) PR titles only", () => {
  const b = buildBoard(inputs({
    specs: [spec("a"), spec("b")],
    milestones: [{ name: "m", features: ["a", "b"], cut: [] }],
    openPrs: [pr(1, "feat(a): build a"), pr(2, "fix(b): fix b")],
  }));
  expect(b.features.map((f) => f.state)).toEqual(["in flight", "ready"]);
  expect(b.features.map((f) => f.pr)).toEqual(["https://github.com/o/r/pull/1", null]);
  expect(buildBoard(inputs({ specs: [spec("b", ["a"])] })).features[0].dependsOn).toEqual(["a"]);
});

test("milestones reader on the real milestones.toml; one spec per feature folder", () => {
  const ms = parseMilestones(readFileSync(join(root, "specs/milestones.toml"), "utf8"));
  expect(ms.length).toBeGreaterThan(0);
  expect(ms[0].name).toBe("playable");
  expect(ms[0].features).toContain("core-loop");
  for (const m of ms) expect(m.name).not.toBe("");
  const folders = readdirSync(join(root, "specs/features")).filter(
    (d) => d !== "_template" && statSync(join(root, "specs/features", d)).isDirectory(),
  );
  const specs = folders.map((d) => specFrom(d, readFileSync(join(root, "specs/features", d, "spec.md"), "utf8")));
  expect(buildBoard(inputs({ specs, milestones: ms })).features.length).toBe(folders.length);
  expect(specs.find((s) => s.slug === "operator-board")?.dependsOn).toEqual(["core-loop"]);
});

test("milestones reader: comments, multi-line lists, and a line it can't read", () => {
  const text = `start = "" # none\n[[milestone]]\nname = "x" # the # in a comment\nfeatures = [\n  "a",\n  "b",\n]\ncut = ["b"]\n`;
  expect(parseMilestones(text)).toEqual([{ name: "x", features: ["a", "b"], cut: ["b"] }]);
  expect(() => parseMilestones("[[milestone]]\nwhat is this\n")).toThrow(/can't read/);
});

test("workers: a Worker: line, a plan: PR without one is planner, a feat PR without one is unnamed", () => {
  expect(workerOf({ title: "feat(a): x", body: "Closes #1\n\nWorker: eric-agent-1. Eric approved." })).toBe("eric-agent-1");
  expect(workerOf({ title: "plan: spec it", body: "no line" })).toBe("planner");
  expect(workerOf({ title: "contract: rules", body: "" })).toBe("planner");
  expect(workerOf({ title: "feat(a): x", body: "made by someone" })).toBe("unnamed");
});

test("needs a person: plan/contract PRs, needs-human and blocked issues, stale drafts at 45 min, red CI, STOP", () => {
  const i = inputs({
    stop: true,
    mainRun: { conclusion: "failure", url: "run-url", updatedAt: AT },
    openPrs: [
      pr(1, "plan: spec x"),
      pr(2, "contract: y"),
      pr(3, "plan: draft plan", { isDraft: true, updatedAt: minsBefore(1) }),
      pr(4, "feat(a): stale", { isDraft: true, updatedAt: minsBefore(46) }),
      pr(5, "feat(b): fresh", { isDraft: true, updatedAt: minsBefore(44) }),
      pr(6, "feat(c): ready, old", { updatedAt: minsBefore(300) }),
    ],
    issues: [
      { number: 10, title: "q", url: "i10", labels: ["needs-human"] },
      { number: 11, title: "stuck", url: "i11", labels: ["blocked", "feature"] },
      { number: 12, title: "idea", url: "i12", labels: ["idea"] },
    ],
  });
  const { needs, needsUnknown } = needsPerson(i);
  expect(needs.map((n) => n.kind)).toEqual(["STOP", "main CI", "plan PR", "contract PR", "stale draft", "needs-human", "blocked"]);
  expect(needs.find((n) => n.kind === "stale draft")?.text).toMatch(/^#4 .*46 min/);
  expect(needsUnknown).toEqual([]);
  expect(needsPerson(inputs()).needs).toEqual([]);
  expect(needsPerson(inputs({ openPrs: null, issues: null, mainRun: null })).needsUnknown).toEqual(["main CI", "PRs", "issues"]);
});

test("bookkeeping: done of planned per milestone, merged by type, median merge time, longest builds, first PR", () => {
  const merged = (n: number, title: string, mins: number, created = minsBefore(1000)) => ({
    number: n, title, state: "MERGED", createdAt: created, mergedAt: new Date(Date.parse(created) + mins * 60_000).toISOString(), closedAt: null, url: `u${n}`,
  });
  const b = buildBoard(inputs({
    done: ["a"],
    milestones: [{ name: "m1", features: ["a", "b"], cut: ["c"] }],
    allPrs: [
      merged(1, "feat(a): a", 30, minsBefore(2000)),
      merged(2, "fix(a): a", 10),
      merged(3, "feat(b): b", 90),
      merged(4, "feat(c): c", 60),
      merged(5, "feat(d): d", 20),
      merged(6, 'Revert "feat(d): d"', 5),
      { number: 7, title: "feat(e): open", state: "OPEN", createdAt: minsBefore(10), mergedAt: null, closedAt: null, url: "u7" },
    ],
  }));
  expect(b.books.milestones).toEqual([{ name: "m1", done: 1, planned: 2, cut: 1 }]);
  expect(b.books.mergedByType).toEqual([["feat", 4], ["fix", 1], ["revert", 1]]);
  expect(b.books.medianMergeMin).toBe(25);
  expect(b.books.longest?.map((l) => [l.number, l.minutes])).toEqual([[3, 90], [4, 60], [1, 30]]);
  expect(b.books.firstPrAt).toBe(minsBefore(2000));
  const none = buildBoard(inputs({ openPrs: null, allPrs: null }));
  expect([none.books.mergedByType, none.books.medianMergeMin, none.books.longest, none.books.firstPrAt, none.crew, none.prs]).toEqual([null, null, null, null, null, null]);
});

test("crew groups open PRs by worker", () => {
  const b = buildBoard(inputs({
    openPrs: [pr(2, "feat(a): x", { body: "Worker: eric-1" }), pr(1, "plan: y"), pr(3, "fix(b): z", { body: "Worker: eric-1", ci: "fail" })],
  }));
  expect(b.crew?.map((c) => [c.worker, c.prs.map((p) => `${p.number}:${p.ci}`)])).toEqual([
    ["eric-1", ["2:pass", "3:fail"]],
    ["planner", ["1:pass"]],
  ]);
});

test("a snapshot has no heartbeat data and round-trips into the same board", () => {
  const b = buildBoard(inputs({ heartbeats: [{ worker: "eric-1", at: AT }], openPrs: [pr(1, "feat(a): x", { body: "Worker: eric-1" })] }));
  const snap = toSnapshot(b);
  expect(snap.heartbeats).toBeNull();
  expect(JSON.stringify(snap)).not.toContain(AT.slice(0, 16) + ":00.000Z\"}]"); // no heartbeat row left behind
  expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  expect({ ...snap, heartbeats: b.heartbeats }).toEqual(b);
});

test("frontmatter reads every form lib.py reads: quoted, unquoted, `- item` lists, trailing comments", () => {
  const fm = (body: string) => parseFrontmatter(`---\n${body}\n---\n# x`);
  expect(fm('depends_on: ["core-loop"]').depends_on).toEqual(["core-loop"]);
  expect(fm("depends_on: [core-loop, hud]").depends_on).toEqual(["core-loop", "hud"]);
  expect(fm("depends_on:\n  - core-loop\n  - hud").depends_on).toEqual(["core-loop", "hud"]);
  expect(fm('depends_on: ["core-loop"]  # note').depends_on).toEqual(["core-loop"]);
  expect(fm("depends_on: []").depends_on).toEqual([]);
  expect(fm('name: "Hi: there # not a comment"').name).toBe("Hi: there # not a comment");
  expect(specFrom("x", "---\ndepends_on:\n  - a\n---").dependsOn).toEqual(["a"]);
});

test("a Worker: line never borrows the next line", () => {
  expect(workerOf({ title: "feat(a): x", body: "Worker:\nCloses #12" })).toBe("unnamed");
});

test("titles: only parse_title's types count, and a feat must name its feature", () => {
  expect(titleType("feat(a): x")).toEqual({ type: "feat", scope: "a" });
  expect(titleType("feat: x")).toBeNull();
  expect(titleType("build: x")).toBeNull();
  expect(titleType('Revert "feat(a): x"')).toEqual({ type: "revert", scope: null });
});

test("main CI is red on any conclusion but success, neutral or skipped", () => {
  const red = (conclusion: string) => needsPerson(inputs({ mainRun: { conclusion, url: "r", updatedAt: AT } })).needs.length;
  expect([red("failure"), red("timed_out"), red("cancelled"), red("startup_failure")]).toEqual([1, 1, 1, 1]);
  expect([red("success"), red("neutral"), red("skipped")]).toEqual([0, 0, 0]);
});

test("unreadable milestones: every feature that isn't done is unknown, not backlog", () => {
  const b = buildBoard(inputs({ specs: [spec("a"), spec("b")], done: ["a"], milestones: null }));
  expect(b.features.map((f) => f.state)).toEqual(["done", "unknown"]);
  expect(b.books.milestones).toEqual([]);
});

test("STOP links to the file on main when any PR says where the repo is", () => {
  const url = (more: Partial<Inputs>) => needsPerson(inputs({ stop: true, ...more })).needs[0].url;
  expect(url({ openPrs: [pr(1, "feat(a): x")] })).toBe("https://github.com/o/r/blob/main/STOP");
  expect(url({ openPrs: null, allPrs: null })).toBeNull();
});

test("every PR, oldest first, with its worker and no body", () => {
  const b = buildBoard(inputs({
    allPrs: [
      { number: 3, title: "feat(a): x", body: "Worker: eric-1", state: "CLOSED", createdAt: minsBefore(9), mergedAt: null, closedAt: minsBefore(1), url: "u3" },
      { number: 2, title: "plan: y", state: "MERGED", createdAt: minsBefore(20), mergedAt: minsBefore(10), closedAt: minsBefore(10), url: "u2" },
    ],
  }));
  expect(b.prs).toEqual([
    { number: 2, title: "plan: y", state: "MERGED", createdAt: minsBefore(20), mergedAt: minsBefore(10), closedAt: minsBefore(10), url: "u2", worker: "planner" },
    { number: 3, title: "feat(a): x", state: "CLOSED", createdAt: minsBefore(9), mergedAt: null, closedAt: minsBefore(1), url: "u3", worker: "eric-1" },
  ]);
});
