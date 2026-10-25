import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_SECONDS, KNOWN_RED, MAIN_CHECK, SECONDS, allChecks, exitCode, runChecks, selectChecks, shard } from "./run-checks.mjs";

const TOAST = "web/src/game/notice-toast/verify-toast.mjs";
const SIM = "web/src/game/sim/verify-sim.mjs";
const OPERATOR = "web/src/operator/verify-operator.mjs";
const REPLAY = "web/src/replay/verify-replay.mjs";
const checks = allChecks([SIM, "web/src/game/sim/sim.ts", REPLAY, OPERATOR, TOAST, MAIN_CHECK, "web/src/game/sim/verify.test.ts"]);

describe("allChecks", () => {
  it("puts verify.mjs first, then the verify*.mjs files sorted, and skips files that aren't checks", () => {
    expect(checks).toEqual([MAIN_CHECK, TOAST, SIM, OPERATOR, REPLAY]);
  });
});

describe("selectChecks", () => {
  it("takes the check of the changed file's folder", () => {
    expect(selectChecks(checks, ["web/src/game/notice-toast/index.ts"])).toEqual([MAIN_CHECK, TOAST]);
    expect(selectChecks(checks, ["web/src/operator/x.tsx"])).toEqual([MAIN_CHECK, OPERATOR]);
  });

  it("walks up to the nearest folder with a check", () => {
    expect(selectChecks(checks, ["web/src/operator/board/tile.tsx"])).toEqual([MAIN_CHECK, OPERATOR]);
  });

  it("gives verify.mjs alone when no folder on the way up has a check", () => {
    expect(selectChecks(checks, ["specs/features/x/spec.md"])).toEqual([MAIN_CHECK]);
    expect(selectChecks(checks, ["web/src/game/fever-stage/x.ts"])).toEqual([MAIN_CHECK]);
  });

  it("doesn't match a folder that only shares a name prefix", () => {
    expect(selectChecks(checks, ["web/src/game/simple/x.ts"])).toEqual([MAIN_CHECK]);
  });

  it.each([
    "web/src/game/core/judge.ts",
    "web/src/contracts/chart.ts",
    "web/src/app/play/page.tsx",
    "web/src/game/layers.ts",
    "web/e2e/verify.mjs",
    "web/package.json",
    "web/pnpm-lock.yaml",
    "web/next.config.ts",
    "web/public/songs/twinkle/chart.json",
    ".github/workflows/ci.yml",
  ])("gives every check when shared code changes (%s)", (f) => {
    expect(selectChecks(checks, [f])).toEqual(checks);
  });
});

describe("shard", () => {
  it("puts every check in exactly one of 4 shards, and their union is the whole list", () => {
    const parts = [1, 2, 3, 4].map((i) => shard(checks, i, 4));
    expect(parts.every((p) => p.length >= 1)).toBe(true);
    expect(parts.flat().sort()).toEqual([...checks].sort());
  });

  it("balances by seconds: the longest check alone, the short ones together", () => {
    const secs = { a: 400, b: 100, c: 100, d: 100, e: 100 };
    expect([1, 2].map((i) => shard(["a", "b", "c", "d", "e"], i, 2, secs))).toEqual([["a"], ["b", "c", "d", "e"]]);
    expect(shard(["x", "y"], 1, 2, {})).toEqual(["x"]); // unknown checks count DEFAULT_SECONDS each
  });

  it("a full run's 8 shards each fit well inside the 20 min job, by the table (#673)", () => {
    const all = allChecks(execFileSync("git", ["ls-files", "web/src", "web/e2e"], { cwd: new URL("../../", import.meta.url).pathname, encoding: "utf8" }).split("\n"));
    const minutes = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => shard(all, i, 8).reduce((s, c) => s + (SECONDS[c] ?? DEFAULT_SECONDS), 0) / 60);
    expect(Math.max(...minutes), minutes.map((m) => m.toFixed(1)).join(" ")).toBeLessThan(14);
  });

  it("leaves a shard empty when there are fewer checks than shards", () => {
    expect(shard([MAIN_CHECK], 2, 4)).toEqual([]);
  });

  it("rejects a shard outside 1..n", () => {
    expect(() => shard(checks, 0, 4)).toThrow();
    expect(() => shard(checks, 5, 4)).toThrow();
  });
});

describe("runChecks", () => {
  // Tiny fake checks: `flaky` fails its first run and passes the second (a marker file says it already ran).
  const dir = mkdtempSync(join(tmpdir(), "run-checks-"));
  const marker = join(dir, "ran-once");
  writeFileSync(join(dir, "pass.mjs"), "process.exit(0);\n");
  writeFileSync(join(dir, "fail.mjs"), "process.exit(1);\n");
  writeFileSync(
    join(dir, "flaky.mjs"),
    `import { existsSync, writeFileSync } from "node:fs";\n` +
      `if (existsSync(${JSON.stringify(marker)})) process.exit(0);\n` +
      `writeFileSync(${JSON.stringify(marker)}, "");\nprocess.exit(1);\n`,
  );
  const run = (names, shardLabel) => runChecks(dir, names, join(dir, "out"), shardLabel);

  it("reports a pass on the rerun as flaky, and the shard exits 0", async () => {
    const rows = await run(["pass.mjs", "flaky.mjs"]);
    expect(rows.map((r) => [r.check, r.result])).toEqual([
      ["pass.mjs", "pass"],
      ["flaky.mjs", "flaky"],
    ]);
    expect(exitCode(rows)).toBe(0);
  });

  it("ends its output when the checks end, even if one leaves a server holding stderr", async () => {
    // The checks start `next dev` detached with stderr inherited. One that outlives its check kept the CI step's pipe
    // open, so the step hung until the job's timeout (#415, run 6). Run the runner the way the CI runner does: in a
    // child whose output is a pipe, and wait for that pipe to close.
    writeFileSync(
      join(dir, "orphan.mjs"),
      `import { spawn } from "node:child_process";\n` +
        `spawn("sleep", ["20"], { detached: true, stdio: ["ignore", "ignore", "inherit"] }).unref();\nprocess.exit(0);\n`,
    );
    const runner = new URL("./run-checks.mjs", import.meta.url).href;
    const script = `import(${JSON.stringify(runner)}).then((m) => m.runChecks(${JSON.stringify(dir)}, ["orphan.mjs"], ${JSON.stringify(join(dir, "out"))})).then(() => process.exit(0));`;
    const start = Date.now();
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.resume();
    child.stderr.resume();
    await new Promise((done) => child.on("close", done));
    expect(Date.now() - start).toBeLessThan(10_000);
  }, 30_000);

  it("reports two failures as FAIL, and the shard exits 1", async () => {
    const rows = await run(["pass.mjs", "fail.mjs"]);
    expect(rows.map((r) => r.result)).toEqual(["pass", "FAIL"]);
    expect(exitCode(rows)).toBe(1);
  });

  it("keeps the shard and its rows in results.json in --out (veritas reads them)", async () => {
    const rows = await run(["pass.mjs", "fail.mjs"], "3/8");
    const kept = JSON.parse(readFileSync(join(dir, "out", "results.json"), "utf8"));
    expect(kept).toEqual({ shard: "3/8", rows });
    expect(Object.keys(kept.rows[0])).toEqual(["check", "result", "seconds"]);
  });
});

describe("KNOWN_RED", () => {
  const repo = resolve(import.meta.dirname, "../..");
  it.each(Object.entries(KNOWN_RED))("%s names its issue and is a real check", (check, issue) => {
    expect(Number.isInteger(issue) && issue > 0).toBe(true);
    expect(existsSync(join(repo, check))).toBe(true);
  });

  it("doesn't fail the shard for a known-red check, but does for any other", () => {
    expect(exitCode([{ check: "a", result: "FAIL", knownRed: 1 }, { check: "b", result: "pass" }])).toBe(0);
    expect(exitCode([{ check: "a", result: "FAIL", knownRed: 1 }, { check: "b", result: "FAIL" }])).toBe(1);
  });
});
