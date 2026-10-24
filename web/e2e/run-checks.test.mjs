import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CHECK, allChecks, exitCode, runChecks, selectChecks, shard } from "./run-checks.mjs";

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
    expect(parts).toEqual([[MAIN_CHECK, REPLAY], [TOAST], [SIM], [OPERATOR]]);
    expect(parts.flat().sort()).toEqual([...checks].sort());
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
  const run = (names) => runChecks(dir, names, join(dir, "out"));

  it("reports a pass on the rerun as flaky, and the shard exits 0", async () => {
    const rows = await run(["pass.mjs", "flaky.mjs"]);
    expect(rows.map((r) => [r.check, r.result])).toEqual([
      ["pass.mjs", "pass"],
      ["flaky.mjs", "flaky"],
    ]);
    expect(exitCode(rows)).toBe(0);
  });

  it("reports two failures as FAIL, and the shard exits 1", async () => {
    const rows = await run(["pass.mjs", "fail.mjs"]);
    expect(rows.map((r) => r.result)).toEqual(["pass", "FAIL"]);
    expect(exitCode(rows)).toBe(1);
  });
});
