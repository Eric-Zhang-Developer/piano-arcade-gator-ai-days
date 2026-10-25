#!/usr/bin/env node
// Freezes /how/ci's data from GitHub: every workflow run since --since, each run's jobs, the PRs merged in that
// window and the fixes the page marks. Writes web/src/how/ci-snapshot.json; the page reads only that file.
//   node web/src/how/ci-freeze.mjs [--since 2026-10-25T01:00:00Z] [--out <file>]
// Times are stored as seconds after `since`, so the file stays small. Needs `gh`, authenticated.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The fixes the timeline marks: #673 opened (an issue), the rest merged (PRs).
export const MARKS = [
  { n: 673, kind: "issue", label: "opened: a shard over the job limit" },
  { n: 674, kind: "pr", label: "shards balanced by seconds" },
  { n: 679, kind: "pr", label: "cap raised to 16 shards" },
  { n: 692, kind: "pr", label: "full suite on a schedule" },
  { n: 687, kind: "pr", label: "PRs run the smoke check" },
];

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", maxBuffer: 256 << 20 });
const lines = (text) => text.split("\n").filter(Boolean).map((l) => JSON.parse(l));

// Seconds after `since`, or null.
export const offset = (since, iso) => (iso ? Math.round((Date.parse(iso) - Date.parse(since)) / 1000) : null);

// The PR a run belongs to: the run's own link, else the newest PR on its branch opened before the run.
export function prFor(run, prsByBranch) {
  if (run.pull_requests?.length) return run.pull_requests[0].number;
  if (run.head_branch === "main") return null;
  const before = (prsByBranch.get(run.head_branch) ?? []).filter((p) => p.createdAt <= run.created_at);
  return before.length ? before[before.length - 1].number : null;
}

function main() {
  const since = arg("--since", "2026-10-25T01:00:00Z");
  const out = arg("--out", join(dirname(fileURLToPath(import.meta.url)), "ci-snapshot.json"));
  const repo = gh("repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner").trim();
  const at = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  const runs = lines(
    gh("api", "--paginate", `repos/${repo}/actions/runs?created=>=${since}&per_page=100`, "-q",
      ".workflow_runs[] | {id, event, head_branch, created_at, run_started_at, updated_at, status, conclusion, pull_requests}"),
  ).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const prs = JSON.parse(gh("pr", "list", "--state", "all", "--limit", "1000", "--json", "number,headRefName,createdAt,mergedAt"));
  const prsByBranch = new Map();
  for (const p of [...prs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    prsByBranch.set(p.headRefName, [...(prsByBranch.get(p.headRefName) ?? []), p]);
  }

  const jobs = [];
  runs.forEach((r, i) => {
    const js = lines(gh("api", `repos/${repo}/actions/runs/${r.id}/jobs?per_page=100`, "-q", ".jobs[] | {name, created_at, started_at, completed_at, conclusion, status}"));
    for (const j of js) {
      // A queued job has no start yet; a job that never ran (skipped, cancelled while queued) may start and end at once.
      jobs.push([i, j.name.startsWith("browser") ? 1 : 0, offset(since, j.created_at), offset(since, j.status === "queued" ? null : j.started_at), offset(since, j.completed_at), j.conclusion === "success" ? 1 : 0]);
    }
  });

  const marks = MARKS.map((m) => {
    const at = m.kind === "issue"
      ? JSON.parse(gh("issue", "view", String(m.n), "--json", "createdAt")).createdAt
      : JSON.parse(gh("pr", "view", String(m.n), "--json", "mergedAt")).mergedAt;
    return { ...m, t: offset(since, at) };
  });

  const merges = prs.filter((p) => p.mergedAt && p.mergedAt >= since).map((p) => offset(since, p.mergedAt)).sort((a, b) => a - b);

  const snapshot = {
    at,
    since,
    repo: `https://github.com/${repo}`,
    // [event, branch ("main" or ""), pr, created, updated, conclusion]
    runs: runs.map((r) => [r.event, r.head_branch === "main" ? "main" : "", prFor(r, prsByBranch), offset(since, r.created_at), offset(since, r.updated_at), r.status === "completed" ? r.conclusion : r.status]),
    // [run index, browser (1/0), queued, started, completed, success (1/0)]
    jobs,
    marks,
    merges,
  };
  writeFileSync(out, JSON.stringify(snapshot) + "\n");
  process.stdout.write(`ci-freeze: ${runs.length} runs, ${jobs.length} jobs, ${merges.length} merges since ${since} -> ${out}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
