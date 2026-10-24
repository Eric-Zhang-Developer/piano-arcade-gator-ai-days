import { describe, expect, it } from "vitest";
import { evidenceDir, parseResults, parseRun, parseTestLog, parseVitest, pickShot } from "./freeze.mjs";

describe("unit results", () => {
  it("full artifact: per-file suites from vitest's JSON, paths from web/ on, and the totals", () => {
    const u = parseVitest({
      numTotalTests: 4,
      numPassedTests: 2,
      numFailedTests: 1,
      numPendingTests: 1,
      numTodoTests: 0,
      testResults: [
        { name: "/home/runner/work/r/r/web/src/b/b.test.ts", assertionResults: [{ status: "passed" }, { status: "failed" }] },
        { name: "/home/runner/work/r/r/web/src/a/a.test.ts", assertionResults: [{ status: "passed" }, { status: "skipped" }] },
      ],
    });
    expect(u.source).toBe("artifact");
    expect(u.totals).toEqual({ files: 2, tests: 4, passed: 2, failed: 1, skipped: 1 });
    expect(u.suites).toEqual([
      { path: "web/src/a/a.test.ts", tests: 2, passed: 1, failed: 0, skipped: 1 },
      { path: "web/src/b/b.test.ts", tests: 2, passed: 1, failed: 1, skipped: 0 },
    ]);
  });

  it("a field the report lacks is null, not zero", () => {
    expect(parseVitest({ testResults: [] }).totals).toEqual({ files: 0, tests: null, passed: null, failed: null, skipped: null });
    expect(parseVitest(null)).toBeNull();
  });

  it("the log-only fallback: the Test Files and Tests lines, ANSI stripped, suites null", () => {
    const log = [
      "ci\tProject checks\t2026-10-24T17:00:00Z \u001b[2m Test Files \u001b[22m \u001b[1m\u001b[32m88 passed\u001b[39m\u001b[22m\u001b[90m (88)\u001b[39m",
      "ci\tProject checks\t2026-10-24T17:00:00Z \u001b[2m      Tests \u001b[22m \u001b[1m\u001b[32m687 passed\u001b[39m\u001b[22m | 1 skipped\u001b[90m (688)\u001b[39m",
    ].join("\n");
    expect(parseTestLog(log)).toEqual({ source: "log", totals: { files: 88, tests: 688, passed: 687, failed: 0, skipped: 1 }, suites: null });
    expect(parseTestLog("     Tests  3 failed | 684 passed (687)").totals).toMatchObject({ tests: 687, passed: 684, failed: 3 });
    expect(parseTestLog("no vitest here")).toBeNull();
  });
});

describe("browser results", () => {
  it("every shard's rows in one list, by check; a missing artifact is null", () => {
    const rows = parseResults([
      { shard: "2/8", rows: [{ check: "web/src/z/verify-z.mjs", result: "pass", seconds: 30 }] },
      null,
      { shard: "1/8", rows: [{ check: "web/e2e/verify.mjs", result: "FAIL", seconds: 90, knownRed: 429 }] },
    ]);
    expect(rows).toEqual([
      { check: "web/e2e/verify.mjs", result: "FAIL", seconds: 90, knownRed: 429 },
      { check: "web/src/z/verify-z.mjs", result: "pass", seconds: 30, knownRed: null },
    ]);
    expect(parseResults([])).toBeNull();
    expect(parseResults([null, { shard: "1/8" }])).toBeNull();
  });

  it("a check's screenshot: the first PNG by name in its passing attempt's folder", () => {
    const check = "web/src/game/sim/verify-sim.mjs";
    expect(evidenceDir(check, false)).toBe("web_src_game_sim_verify-sim");
    const pngs = ["web_src_game_sim_verify-sim/b.png", "web_src_game_sim_verify-sim/a.png", "web_src_game_sim_verify-sim-retry/0.png", "other/0.png"];
    expect(pickShot({ check, result: "pass" }, pngs)).toBe("web_src_game_sim_verify-sim/a.png");
    expect(pickShot({ check, result: "flaky" }, pngs)).toBe("web_src_game_sim_verify-sim-retry/0.png");
    expect(pickShot({ check, result: "FAIL" }, pngs)).toBeNull();
    expect(pickShot({ check, result: "pass" }, ["web_src_game_sim_verify-sim/log.txt"])).toBeNull();
  });
});

it("the run: gh run view's fields, a missing one null", () => {
  const r = parseRun({ databaseId: 7, url: "u", headSha: "abc", createdAt: "t", conclusion: "success", jobs: [{ name: "ci", conclusion: "success" }, { name: "browser (1)", conclusion: "" }] });
  expect(r).toEqual({ run: { id: 7, url: "u", sha: "abc", createdAt: "t", conclusion: "success" }, jobs: [{ name: "ci", conclusion: "success" }, { name: "browser (1)", conclusion: null }] });
  expect(parseRun({}).jobs).toBeNull();
});
