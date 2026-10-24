// CI's browser job (specs/features/ci-browser/spec.md): pick the headless checks a change needs, split them across
// shards, run them one at a time, and rerun each failure once. A pass on the rerun is `flaky`; two failures fail the
// shard. Node stdlib only, so `--list` runs before `pnpm install` and an empty shard skips the Chromium install.
// Usage (from anywhere in the repo):
//   node web/e2e/run-checks.mjs --list [--base <ref> | --all] [--shard i/n]   print the selected checks, one per line
//   node web/e2e/run-checks.mjs --out <dir> [--base <ref> | --all] [--shard i/n]   run them
// --base <ref>: verify.mjs plus the checks nearest each file changed since <ref>, or every check when shared code
// changed. --all (or no --base): every check.
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MAIN_CHECK = "web/e2e/verify.mjs";
const say = (s) => process.stdout.write(`${s}\n`);

// Code every screen runs through: a change here can break any check, so every check runs.
export const SHARED = [
  "web/src/game/core/",
  "web/src/contracts/",
  "web/src/app/",
  "web/src/game/layers.ts",
  "web/e2e/",
  "web/package.json",
  "web/pnpm-lock.yaml",
  "web/next.config.ts",
  "web/public/songs/twinkle/",
  ".github/workflows/ci.yml",
];
// The runner's own ceiling, so a hung check still fails its shard (and uploads evidence) inside the job's 20 min.
// Not a check's timeout: decision ci-browser-check-timeout.md.
const CHECK_TIMEOUT_MS = 8 * 60_000;
// Checks already red on main when the job landed: each still runs and is reported ("known red #N"), but doesn't fail
// the shard. Check -> its issue. The list only shrinks: an entry leaves after its check passes 2 browser runs in a
// row that include the fix (one green run can be luck).
// Decision ci-browser-known-red.md.
export const KNOWN_RED = {
  "web/src/game/notice-toast/verify-toast.mjs": 584,
  "web/src/replay/verify-replay.mjs": 552,
};

/** Every check: verify.mjs first, then each verify*.mjs under web/src/, sorted. `files` are repo-relative paths. */
export function allChecks(files) {
  const feature = files.filter((f) => f.startsWith("web/src/") && /\/verify[^/]*\.mjs$/.test(f)).sort();
  return [MAIN_CHECK, ...feature];
}

/**
 * The checks a change needs: verify.mjs, plus for each changed file under web/src/ the checks of the nearest folder
 * (its own, then each parent) that has any. Every check when a SHARED path changed.
 */
export function selectChecks(checks, changed) {
  if (changed.some((f) => SHARED.some((s) => f === s || (s.endsWith("/") && f.startsWith(s))))) return checks;
  const byFolder = Map.groupBy(checks.filter((c) => c !== MAIN_CHECK), (c) => dirname(c));
  const picked = new Set([MAIN_CHECK]);
  for (const f of changed.filter((f) => f.startsWith("web/src/"))) {
    for (let dir = dirname(f); dir.startsWith("web/src"); dir = dirname(dir)) {
      const here = byFolder.get(dir);
      if (here) {
        here.forEach((c) => picked.add(c));
        break;
      }
    }
  }
  return checks.filter((c) => picked.has(c));
}

/** Shard i of n (1-based): the entries whose index mod n is i - 1. */
export function shard(checks, i, n) {
  if (!(Number.isInteger(i) && Number.isInteger(n) && n >= 1 && i >= 1 && i <= n)) throw new Error(`bad shard ${i}/${n}`);
  return checks.filter((_, k) => k % n === i - 1);
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
 * Run each check once, rerun a failure once into a fresh folder. Returns [{ check, result, seconds, knownRed? }], and
 * keeps them with the shard in <out>/results.json, rewritten after each check so a job cut short keeps what ran.
 */
export async function runChecks(root, checks, out, shardLabel = "1/1") {
  const rows = [];
  for (const check of checks) {
    const name = check.replace(/\.mjs$/, "").replaceAll("/", "_");
    const start = Date.now();
    let result = "FAIL";
    for (const attempt of [1, 2]) {
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
    else if (result === "FAIL") say(`::error title=FAIL::${check} failed twice`);
    rows.push({ check, result, seconds: Math.round((Date.now() - start) / 1000), ...(issue && { knownRed: issue }) });
    writeFileSync(join(out, "results.json"), `${JSON.stringify({ shard: shardLabel, rows }, null, 2)}\n`);
  }
  return rows;
}

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
  const rows = await runChecks(root, picked, resolve(outArg), `${i}/${n}`);
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
