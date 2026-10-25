import { expect, test } from "vitest";
import type { BoardPr } from "../operator/board";
import { countLines, folderLines, folderOf, githubUrl, howData, incident, knownRedCount, mergesPerHour, ownerOf, parseCodeowners, parseLanes } from "./data";

const pr = (number: number, title: string, mergedAt: string | null, worker = "eric-agent-1"): BoardPr => ({
  number, title, state: mergedAt ? "MERGED" : "OPEN", createdAt: "2026-10-24T10:00:00Z", mergedAt, closedAt: mergedAt,
  url: `https://github.com/o/r/pull/${number}`, worker,
});

test("merges per hour: unmerged PRs skipped, hour edges, empty hours kept, kinds by kindOf, UTC buckets labeled in New York", () => {
  const hours = mergesPerHour([
    pr(1, "feat(a): x", "2026-10-24T13:59:59Z"),
    pr(2, "refactor(a): x", "2026-10-24T14:00:00Z"),
    pr(3, "contract: x", "2026-10-24T16:30:00Z"),
    pr(4, "feat(b): open", null),
    pr(5, "docs: x", "2026-10-24T14:10:00Z"),
  ]);
  expect(hours.map((h) => h.at)).toEqual(["2026-10-24T13:00:00.000Z", "2026-10-24T14:00:00.000Z", "2026-10-24T15:00:00.000Z", "2026-10-24T16:00:00.000Z"]);
  expect(hours.map((h) => h.total)).toEqual([1, 2, 0, 1]);
  expect(hours[1].counts).toEqual({ feat: 0, fix: 1, plan: 0, other: 1 }); // refactor counts as fix
  expect(hours[3].counts.plan).toBe(1); // contract counts as plan
  expect(hours[0].label).toBe("Sat 9 AM"); // 13:00Z is 9 AM EDT
  expect(mergesPerHour([])).toEqual([]);
  expect(mergesPerHour(null)).toEqual([]);
});

test("owner: the longest CODEOWNERS prefix, else the Lanes Folder column, else no owner listed", () => {
  const owners = parseCodeowners("# comment\n/web/src/app/  @a\n/web/src/app/api/takes/ @b\n\n/web/src/game/ @c\n");
  expect(owners).toEqual([{ path: "web/src/app/", owner: "@a" }, { path: "web/src/app/api/takes/", owner: "@b" }, { path: "web/src/game/", owner: "@c" }]);
  const lanes = parseLanes("## Lanes\nx\n\n| Person | GitHub | Lane | Folder |\n|---|---|---|---|\n| `eric` | `@e` | game | `web/src/game/` |\n| not set yet | not set yet | learning | `web/src/learn/`, `tools/` |\n\n## Next\n");
  expect(lanes.map((l) => [l.person, l.folders])).toEqual([["eric", ["web/src/game/"]], ["not set yet", ["web/src/learn/", "tools/"]]]);
  expect(ownerOf("web/src/app/api/takes/", owners, lanes)).toBe("@b");
  expect(ownerOf("web/src/app/how/", owners, lanes)).toBe("@a");
  expect(ownerOf("web/src/learn/", owners, lanes)).toBe("not set yet");
  expect(ownerOf("web/src/operator/", owners, lanes)).toBe("no owner listed");
});

test("lines and folders: \\n count plus one for an unterminated last line; app/ splits by route", () => {
  expect([countLines(""), countLines("a"), countLines("a\n"), countLines("a\nb")]).toEqual([0, 1, 1, 2]);
  expect([folderOf("web/src/game/core/judge.ts"), folderOf("web/src/app/play/page.tsx"), folderOf("web/src/app/layout.tsx"), folderOf("web/e2e/x.mjs")]).toEqual([
    "web/src/game/", "web/src/app/play/", "web/src/app/", null,
  ]);
  expect(folderLines([{ path: "web/src/game/a.ts", lines: 5 }, { path: "web/src/game/b/c.ts", lines: 7 }, { path: "web/src/how/d.ts", lines: 20 }])).toEqual([
    { folder: "web/src/how/", lines: 20 },
    { folder: "web/src/game/", lines: 12 },
  ]);
});

test("known red: entries in the KNOWN_RED block, null without one", () => {
  expect(knownRedCount('export const KNOWN_RED = {\n  "a.mjs": 1,\n  "b.mjs": 22,\n};\nconst x = { "c": 3 };')).toBe(2);
  expect(knownRedCount("export const KNOWN_RED = {};")).toBe(0);
  expect(knownRedCount(null)).toBeNull();
  expect(knownRedCount("nothing here")).toBeNull();
});

test("the incident: the gap from two mergedAt values; a missing PR gives unknown", () => {
  const prs = [pr(387, "chore(x): a", "2026-10-24T14:59:07Z"), pr(391, "fix(y): b", "2026-10-24T14:59:31Z"), pr(397, "fix(x): c", "2026-10-24T15:04:31Z")];
  expect(incident(prs)).toEqual({ gapSec: 24, fixMin: 5 });
  expect(incident(prs.slice(0, 2))).toBeNull();
  expect(incident([{ ...prs[0], mergedAt: null }, prs[1], prs[2]])).toBeNull();
  expect(incident(null)).toBeNull();
});

test("no snapshot: every snapshot value is unknown, and git and repo values still read", () => {
  const d = howData({
    snapshot: null,
    files: [{ path: "web/src/game/a.ts", lines: 3 }],
    runChecksAt433: 'KNOWN_RED = {\n "a": 1,\n}',
    runChecksNow: "KNOWN_RED = {\n}",
    codeowners: "/web/src/game/ @e",
    agentsMd: null,
    remote: null,
  });
  expect([d.at, d.mainSha, d.byWorker, d.stages, d.medianMergeMin, d.hours, d.totalMerged, d.busiest, d.incident, d.buildStamp, d.ciBrowser, d.repo]).toEqual(
    Array(12).fill(null),
  );
  expect(d.others).toEqual([]);
  expect(d.folders).toEqual([{ folder: "web/src/game/", lines: 3, owner: "@e" }]);
  expect([d.knownRedFirst, d.knownRedNow]).toEqual([1, 0]);
});

test("links: the repo URL from git's remote, either form", () => {
  expect(githubUrl("git@github.com:o/r.git")).toBe("https://github.com/o/r");
  expect(githubUrl("https://github.com/o/r.git\n")).toBe("https://github.com/o/r");
  expect(githubUrl("https://github.com/o/r")).toBe("https://github.com/o/r");
  expect(githubUrl(null)).toBeNull();
});
