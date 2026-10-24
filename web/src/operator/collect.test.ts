import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { ciOf, collect, type GhRun } from "./collect";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const folders = readdirSync(join(root, "specs/features")).filter(
  (d) => d !== "_template" && statSync(join(root, "specs/features", d)).isDirectory(),
);

test("gh failing (not logged in): a board from files plus the banner, no throw", async () => {
  let calls = 0;
  const gh: GhRun = async () => (calls++, { code: 4, stdout: "", stderr: "To get started with GitHub CLI, please run:  gh auth login" });
  const b = await collect({ root, gh });
  expect(calls).toBe(1); // the first failure stops the rest
  expect(b.gh).toEqual({ status: "not logged in", calls: 1 });
  expect(b.banner[0]).toMatch(/isn't logged in: PRs, issues, main CI unknown/);
  expect(b.features.length).toBe(folders.length);
  expect(b.features.find((f) => f.slug === "core-loop")?.state).toBe("done");
  expect(b.features.filter((f) => f.state === "ready" || f.state === "in flight" || f.state === "blocked")).toEqual([]);
  expect(b.crew).toBeNull();
  expect(b.needsUnknown).toEqual(["main CI", "PRs", "issues"]);
});

test("gh not installed or offline: failed, with the reason", async () => {
  const missing = await collect({ root, gh: async () => ({ code: -1, stdout: "", stderr: "gh: not installed" }) });
  expect(missing.gh.status).toBe("failed");
  expect(missing.banner[0]).toMatch(/^gh isn't installed/);
  const offline = await collect({ root, gh: async () => ({ code: 1, stdout: "", stderr: "error connecting to api.github.com" }) });
  expect(offline.banner[0]).toMatch(/^GitHub couldn't be reached/);
  const slow = await collect({ root, gh: async () => ({ code: -1, stdout: "", stderr: "gh: timed out" }) });
  expect(slow.banner[0]).toMatch(/^GitHub couldn't be reached/);
  const thrown = await collect({ root, gh: async () => ({ code: 0, stdout: "<html>", stderr: "" }) });
  expect(thrown.gh.status).toBe("failed");
});

test("against a fake gh: no more than 5 calls, and the data lands on the board", async () => {
  const seen: string[][] = [];
  const now = new Date("2026-10-24T12:00:00Z");
  // Any scheduled feature that isn't done yet: a fixed slug would break the day it ships.
  const filesOnly = await collect({ root, gh: async () => ({ code: 4, stdout: "", stderr: "gh auth login" }) });
  const slug = filesOnly.features.find((f) => f.state === "unknown")?.slug ?? "none-left";
  const gh: GhRun = async (args) => {
    seen.push(args);
    const key = `${args[0]} ${args[3]}`; // "pr open", "pr all", "issue open", "run main"
    const data: Record<string, unknown> = {
      "pr open": [
        { number: 9, title: `feat(${slug}): x`, body: "Worker: eric-foreman-agent", isDraft: true, url: "p9",
          createdAt: "2026-10-24T10:00:00Z", updatedAt: "2026-10-24T11:00:00Z",
          statusCheckRollup: [{ status: "COMPLETED", conclusion: "SUCCESS" }] },
        { number: 8, title: "plan: y", body: "", isDraft: false, url: "p8", createdAt: "2026-10-24T10:00:00Z",
          updatedAt: "2026-10-24T11:59:00Z", statusCheckRollup: [] },
      ],
      "pr all": [{ number: 1, title: "feat(core-loop): x", body: "Worker: eric-1", state: "MERGED", createdAt: "2026-10-23T21:00:00Z", mergedAt: "2026-10-23T22:00:00Z", closedAt: "2026-10-23T22:00:00Z", url: "p1" }],
      "issue open": [{ number: 5, title: "q", url: "i5", labels: [{ name: "needs-human" }] }],
      "run main": [{ conclusion: "success", url: "r", updatedAt: "2026-10-24T11:00:00Z" }],
    };
    return key in data ? { code: 0, stdout: JSON.stringify(data[key]), stderr: "" } : { code: 1, stdout: "", stderr: `unexpected ${args}` };
  };
  const b = await collect({ root, gh, now });
  expect(seen.length).toBeLessThanOrEqual(5);
  expect(b.gh).toEqual({ status: "ok", calls: seen.length });
  expect(b.banner.filter((x) => /unknown/.test(x))).toEqual([]);
  expect(b.features.find((f) => f.slug === slug)?.state).toBe("in flight");
  expect(b.crew?.map((c) => c.worker)).toEqual(["eric-foreman-agent", "planner"]);
  expect(b.crew?.[0].prs[0].ci).toBe("pass");
  expect(b.needs.map((n) => n.kind)).toEqual(["plan PR", "stale draft", "needs-human"]);
  expect(b.books.medianMergeMin).toBe(60);
  expect(b.prs?.map((p) => [p.number, p.worker])).toEqual([[1, "eric-1"]]);
});

test("head CI from a status check rollup", () => {
  expect(ciOf([])).toBe("none");
  expect(ciOf(null)).toBe("none");
  expect(ciOf([{ status: "COMPLETED", conclusion: "SUCCESS" }, { status: "COMPLETED", conclusion: "SKIPPED" }])).toBe("pass");
  expect(ciOf([{ status: "IN_PROGRESS" }, { status: "COMPLETED", conclusion: "SUCCESS" }])).toBe("pending");
  expect(ciOf([{ status: "IN_PROGRESS" }, { status: "COMPLETED", conclusion: "FAILURE" }])).toBe("fail");
  expect(ciOf([{ state: "PENDING" }])).toBe("pending");
  expect(ciOf([{ state: "SUCCESS" }])).toBe("pass");
});
