// Freeze /veritas's dashboard from a real CI run (spec: veritas, "The snapshot"): the run and its jobs, the unit
// results, the browser checks and a screenshot per check, written to web/public/veritas/. A missing artifact or field
// is null, never a guess or a zero. The parsing is pure and exported for freeze.test.mjs.
// Usage: node web/src/veritas/freeze.mjs [--run <id>]   (default: the newest completed `ci` run of a push to main)
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** vitest's JSON report -> per-file suites and the totals. Paths from web/ on, as the repo writes them. */
export function parseVitest(j) {
  if (!j || !Array.isArray(j.testResults)) return null;
  const count = (r, ...s) => (r.assertionResults ?? []).filter((a) => s.includes(a.status)).length;
  const suites = j.testResults.map((r) => ({
    path: String(r.name).replace(/^.*?\/(web\/)/, "$1"),
    tests: (r.assertionResults ?? []).length,
    passed: count(r, "passed"),
    failed: count(r, "failed"),
    skipped: count(r, "skipped", "pending", "todo"),
  }));
  const skipped = num(j.numPendingTests) === null ? null : j.numPendingTests + (num(j.numTodoTests) ?? 0);
  return {
    source: "artifact",
    totals: { files: suites.length, tests: num(j.numTotalTests), passed: num(j.numPassedTests), failed: num(j.numFailedTests), skipped },
    suites: suites.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

const ANSI = /\u001b\[[0-9;]*m/g;
// "687 passed | 1 skipped (688)" -> { passed: 687, skipped: 1, total: 688 }. vitest leaves out the parts that are 0.
function summary(line) {
  const m = /^(.*?)\s*\((\d+)\)\s*$/.exec(line.trim());
  if (!m) return null;
  const parts = Object.fromEntries(m[1].split("|").map((p) => /(\d+)\s+(.+)/.exec(p.trim())).filter(Boolean).map((x) => [x[2], Number(x[1])]));
  return { ...parts, total: Number(m[2]) };
}

/** The ci job's log -> vitest's totals from its "Test Files" and "Tests" lines; suites stay null. */
export function parseTestLog(text) {
  const lines = String(text ?? "").replace(ANSI, "").split("\n");
  const last = (re) => lines.map((l) => re.exec(l)?.[1]).filter(Boolean).at(-1);
  const files = last(/\bTest Files\s+(.+\(\d+\))\s*$/);
  const tests = last(/\bTests\s+(.+\(\d+\))\s*$/);
  if (!tests) return null;
  const t = summary(tests);
  const f = files ? summary(files) : null;
  return {
    source: "log",
    totals: { files: f?.total ?? null, tests: t.total, passed: t.passed ?? 0, failed: t.failed ?? 0, skipped: (t.skipped ?? 0) + (t.todo ?? 0) },
    suites: null,
  };
}

/** Every shard's results.json ({ shard, rows: [{ check, result, seconds, knownRed? }] }) -> one list, by check. */
export function parseResults(files) {
  const rows = files.flatMap((f) => (Array.isArray(f?.rows) ? f.rows : []));
  if (!rows.length) return null;
  return rows
    .map((r) => ({ check: String(r.check), result: String(r.result), seconds: num(r.seconds), knownRed: num(r.knownRed) }))
    .sort((a, b) => a.check.localeCompare(b.check));
}

// run-checks.mjs's evidence folder for a check: its path without .mjs, / as _, and -retry for the second attempt.
export const evidenceDir = (check, retry) => `${check.replace(/\.mjs$/, "").replaceAll("/", "_")}${retry ? "-retry" : ""}`;

/** The screenshot for a check: the first PNG by name in its passing attempt's folder. `pngs`: paths under the
 * artifact root, e.g. "web_e2e_verify/sim/a.png". Null for a check that failed both times or kept no PNG. */
export function pickShot(row, pngs) {
  if (row.result !== "pass" && row.result !== "flaky") return null;
  const dir = `${evidenceDir(row.check, row.result === "flaky")}/`;
  return pngs.filter((p) => p.startsWith(dir) && p.endsWith(".png")).sort()[0] ?? null;
}

/** gh run view's JSON -> the run and its jobs. */
export function parseRun(v) {
  return {
    run: { id: num(v?.databaseId), url: v?.url ?? null, sha: v?.headSha ?? null, createdAt: v?.createdAt ?? null, conclusion: v?.conclusion || null },
    jobs: Array.isArray(v?.jobs) ? v.jobs.map((j) => ({ name: String(j.name), conclusion: j.conclusion || null })) : null,
  };
}

// --- the command -------------------------------------------------------------------------------------------------

const say = (s) => process.stdout.write(`${s}\n`);
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "pipe"] });
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};
const walk = (dir, base = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name), base) : [join(dir, e.name).slice(base.length + 1)]));

function main() {
  const out = fileURLToPath(new URL("../../public/veritas/", import.meta.url));
  const k = process.argv.indexOf("--run");
  const id =
    k > 0
      ? process.argv[k + 1]
      : JSON.parse(gh("run", "list", "--workflow", "ci", "--branch", "main", "--event", "push", "--status", "completed", "--limit", "1", "--json", "databaseId"))[0]?.databaseId;
  if (!id) throw new Error("no completed ci run on main");
  const { run, jobs } = parseRun(JSON.parse(gh("run", "view", String(id), "--json", "databaseId,url,headSha,createdAt,conclusion,jobs")));
  const tmp = mkdtempSync(join(tmpdir(), "veritas-"));
  try {
    try {
      gh("run", "download", String(id), "--dir", tmp);
    } catch {
      // no artifacts on this run: unit falls back to the log, browser stays null
    }
    const arts = readdirSync(tmp);
    let unit = parseVitest(readJson(join(tmp, "unit-results", "vitest.json")));
    if (!unit) {
      const ciJob = JSON.parse(gh("run", "view", String(id), "--json", "jobs")).jobs.find((j) => j.name === "ci");
      unit = ciJob ? parseTestLog(gh("run", "view", String(id), "--log", "--job", String(ciJob.databaseId))) : null;
    }
    const evidence = arts.filter((a) => a.startsWith("browser-evidence-"));
    const browser = parseResults(evidence.map((a) => readJson(join(tmp, a, "results.json"))));
    let shots = null;
    rmSync(join(out, "shots"), { recursive: true, force: true });
    if (browser) {
      mkdirSync(join(out, "shots"), { recursive: true });
      let bytes = 0;
      shots = browser.flatMap((row) => {
        for (const a of evidence) {
          const png = pickShot(row, walk(join(tmp, a)));
          if (!png) continue;
          const file = `${evidenceDir(row.check, false)}.png`;
          copyFileSync(join(tmp, a, png), join(out, "shots", file));
          bytes += statSync(join(out, "shots", file)).size;
          return [{ check: row.check, src: `/veritas/shots/${file}` }];
        }
        return [];
      });
      say(`freeze: ${shots.length} screenshots, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    }
    const snapshot = { frozenAt: new Date().toISOString(), run, jobs, unit, browser, shots };
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
    say(
      `freeze: run ${run.id} (${run.sha?.slice(0, 7)}, ${run.conclusion}); unit ${unit ? `${unit.totals.tests} tests from the ${unit.source}` : "unknown"}; ` +
        `browser ${browser ? `${browser.length} checks` : "unknown"} -> ${join(out, "snapshot.json")}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    console.error(`freeze: ${e.message}`);
    process.exit(1);
  }
}
