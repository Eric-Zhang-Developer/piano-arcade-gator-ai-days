// CI's browser job (specs/features/ci-browser/spec.md): pick the headless checks a change needs, split them across
// shards, run them one at a time. On main a failure reruns once (a pass on the rerun is `flaky`; two failures fail
// the shard); on a pull request the first failure fails it. Node stdlib only, so `--list` runs before
// `pnpm install` and an empty shard skips the Chromium install.
// Usage (from anywhere in the repo):
//   node web/e2e/run-checks.mjs --list [--base <ref> | --all] [--shard i/n]   print the selected checks, one per line
//   node web/e2e/run-checks.mjs --out <dir> [--base <ref> | --all] [--shard i/n]   run them
// --base <ref>: the smoke check (verify.mjs) alone, or every check when the runner or workflow changed since <ref>.
// --all (or no --base): every check. A PR and a push to main use --base; the full run (schedule, by hand) uses --all.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MAIN_CHECK = "web/e2e/verify.mjs";
const say = (s) => process.stdout.write(`${s}\n`);

// The paths whose change runs every check on a pull request or a push: the runner and the workflow themselves.
// Everything else gets the smoke check only; the full suite runs every 30 min and by hand (Eric, 2026-10-25;
// decision ci-browser-pr-scope.md).
export const FULL_RUN = ["web/e2e/", ".github/workflows/ci.yml"];
// The runner's own ceiling, so a hung check still fails its shard (and uploads evidence) inside the job's 20 min.
// Not a check's timeout: decision ci-browser-check-timeout.md.
const CHECK_TIMEOUT_MS = 8 * 60_000;
// Checks already red on main when the job landed: each still runs and is reported ("known red #N"), but doesn't fail
// the shard. Check -> its issue. The list only shrinks: an entry leaves after its check passes 2 browser runs in a
// row that include the fix (one green run can be luck).
// Decision ci-browser-known-red.md.
// 2026-10-25: eight checks that went red unseen while main's full run didn't fire (#1021), each red on main's own run
// 40187861996 and not yet fixed on main, pointing at its fix PR (or #754, the ci-red issue, where none exists yet).
export const KNOWN_RED = {
  "web/src/game/duo-results/verify-results.mjs": 754, // a localStorage page error, under repro
  "web/src/game/ghost/verify-ghost.mjs": 1032, // stale after judging-tiers' +60 ms late bot (#859)
  "web/src/game/learn-from-select/verify-learn.mjs": 1025, // the ? card repeats the Learn line (#796)
  "web/src/game/records/verify-records.mjs": 754, // failed its first attempt on main too: red on any one-attempt PR
  "web/src/game/sheet-beams/verify-beams.mjs": 1053, // the paper's darker hues (#730)
  "web/src/game/song-options/verify-options.mjs": 754, // hands-R times out after a take, under repro
  "web/src/game/take-graph/verify-take-graph.mjs": 1032, // the +60 ms late bot (#859), the graph across its card (#839)
  "web/src/game/wait-mode/verify-wait.mjs": 1034, // the Flow rung read mid-take (#841)
};

// Checks CI skips because other checks cover them in smaller pieces. Each stays a whole run for people and specs.
// verify-sheet.mjs: verify-sheet-a/-b/-c.mjs run its follow run split by song (#682), so no shard waits 7 min on it.
export const NOT_IN_CI = ["web/src/game/sheet-view/verify-sheet.mjs"];

/** Every check: verify.mjs first, then each verify*.mjs under web/src/ not in NOT_IN_CI, sorted. Repo-relative paths. */
export function allChecks(files) {
  const feature = files.filter((f) => f.startsWith("web/src/") && /\/verify[^/]*\.mjs$/.test(f) && !NOT_IN_CI.includes(f)).sort();
  return [MAIN_CHECK, ...feature];
}

/** The checks a change needs: the smoke check alone, or every check when a FULL_RUN path changed. */
export function selectChecks(checks, changed) {
  const full = changed.some((f) => FULL_RUN.some((s) => f === s || (s.endsWith("/") && f.startsWith(s))));
  return full ? checks : checks.filter((c) => c === MAIN_CHECK);
}

// Each check's seconds on CI (main's full run 40174538738, 2026-10-25), to balance the shards; a check not in the
// table counts DEFAULT_SECONDS, about the median. Refresh it from a full run's logs when a shard nears the job's 20 min.
export const SECONDS = JSON.parse(readFileSync(new URL("./run-checks.seconds.json", import.meta.url), "utf8"));
export const DEFAULT_SECONDS = 90;

/**
 * Shard i of n (1-based), balanced by time: longest check first, each onto the shard with the fewest seconds so far
 * (the lower shard on a tie). Round-robin by index put 17 of the 84 minutes in one shard, past the 20 min job (#673).
 * Every runner computes the same split from the same list. A shard keeps the list's order.
 */
export function shard(checks, i, n, seconds = SECONDS) {
  if (!(Number.isInteger(i) && Number.isInteger(n) && n >= 1 && i >= 1 && i <= n)) throw new Error(`bad shard ${i}/${n}`);
  const cost = (c) => seconds[c] ?? DEFAULT_SECONDS;
  const load = new Array(n).fill(0);
  const owner = new Map();
  for (const c of [...checks].sort((a, b) => cost(b) - cost(a) || (a < b ? -1 : 1))) {
    const k = load.indexOf(Math.min(...load));
    load[k] += cost(c);
    owner.set(c, k);
  }
  return checks.filter((c) => owner.get(c) === i - 1);
}

// One check in its own process group, so a server it leaves behind (on a timeout, say) is stopped too. Its output
// comes through pipes of ours, not our own stdout and stderr: a check's detached `next dev` inherits stderr, and one
// that outlives its check held the CI step's pipe open until the job timed out (#415, run 6).
function runOnce(root, check, out) {
  return new Promise((done) => {
    const p = spawn(process.execPath, [check, "--out", out], { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: true });
    p.stdout.pipe(process.stdout, { end: false });
    p.stderr.pipe(process.stderr, { end: false });
    const kill = (sig) => {
      try {
        process.kill(-p.pid, sig);
      } catch {
        // already gone
      }
    };
    const timer = setTimeout(() => {
      say(`run-checks: ${check} still running after ${CHECK_TIMEOUT_MS / 1000} s, stopping it`);
      kill("SIGKILL");
    }, CHECK_TIMEOUT_MS);
    p.on("exit", (code) => {
      clearTimeout(timer);
      kill("SIGTERM");
      // Let what it wrote drain, then let go of pipes a leftover server may still hold.
      const release = () => {
        p.stdout.destroy();
        p.stderr.destroy();
        done(code === 0);
      };
      const grace = setTimeout(release, 2000);
      p.on("close", () => {
        clearTimeout(grace);
        release();
      });
    });
  });
}

/**
 * Run each check once; with `attempts` 2, rerun a failure once into a fresh folder. Returns
 * [{ check, result, seconds, knownRed? }], and keeps them with the shard in <out>/results.json, rewritten after each
 * check so a job cut short keeps what ran.
 */
export async function runChecks(root, checks, out, shardLabel = "1/1", attempts = 2) {
  const rows = [];
  for (const check of checks) {
    const name = check.replace(/\.mjs$/, "").replaceAll("/", "_");
    const start = Date.now();
    let result = "FAIL";
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const dir = join(out, attempt === 1 ? name : `${name}-retry`);
      mkdirSync(dir, { recursive: true });
      say(`::group::${check}${attempt === 2 ? " (retry)" : ""}`);
      const ok = await runOnce(root, check, dir);
      say("::endgroup::");
      if (ok) {
        result = attempt === 1 ? "pass" : "flaky";
        break;
      }
    }
    const issue = KNOWN_RED[check];
    if (issue) say(`::warning title=known red #${issue}::${check}: ${result === "FAIL" ? "fail" : "pass"}`);
    else if (result === "flaky") say(`::warning title=flaky::flaky: ${check}`);
    else if (result === "FAIL") say(`::error title=FAIL::${check} failed${attempts > 1 ? " twice" : ""}`);
    rows.push({ check, result, seconds: Math.round((Date.now() - start) / 1000), ...(issue && { knownRed: issue }) });
    writeFileSync(join(out, "results.json"), `${JSON.stringify({ shard: shardLabel, rows }, null, 2)}\n`);
  }
  return rows;
}

// One attempt on a pull request (GitHub sets GITHUB_EVENT_NAME), two on main: a PR's failure is its author's to read
// at once, and only 1 of ~520 sampled check runs passed on a rerun; main keeps the rerun so a flake can't redden it.
export const retriesFor = (env) => (env.GITHUB_EVENT_NAME === "pull_request" ? 1 : 2);

/** The shard's exit code: 0 when every check passed (flaky counts as passed) or is known red, 1 otherwise. */
export const exitCode = (rows) => (rows.some((r) => r.result === "FAIL" && !r.knownRed) ? 1 : 0);

function arg(name) {
  const k = process.argv.indexOf(name);
  return k < 0 ? undefined : process.argv[k + 1];
}

async function main() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const base = process.argv.includes("--all") ? undefined : arg("--base");
  const [i, n] = (arg("--shard") ?? "1/1").split("/").map(Number);

  const checks = allChecks(git("ls-files", "web/src", MAIN_CHECK));
  const picked = shard(base ? selectChecks(checks, git("diff", "--name-only", `${base}...HEAD`)) : checks, i, n);
  if (process.argv.includes("--list")) {
    for (const c of picked) say(c);
    return 0;
  }
  const outArg = arg("--out");
  if (!outArg) {
    console.error("usage: run-checks.mjs (--list | --out <dir>) [--base <ref> | --all] [--shard i/n]");
    return 2;
  }
  const start = Date.now();
  const rows = await runChecks(root, picked, resolve(outArg), `${i}/${n}`, retriesFor(process.env));
  const lines = [
    ...rows.map((r) => `${r.check} ${r.knownRed ? `known red #${r.knownRed}: ${r.result === "FAIL" ? "fail" : "pass"}` : r.result} ${r.seconds} s`),
    `shard ${i}/${n}: ${rows.length} check(s) in ${Math.round((Date.now() - start) / 1000)} s`,
  ];
  say(lines.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.map((l) => `- ${l}\n`).join(""));
  return exitCode(rows);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`run-checks: ${e.message}`);
      process.exit(2);
    },
  );
}
