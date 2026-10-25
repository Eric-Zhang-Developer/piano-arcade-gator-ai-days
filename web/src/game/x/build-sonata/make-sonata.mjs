// The Build Sonata's snapshot (spec: build-sonata): main's merged PRs, one note each. Re-run it at the freeze and commit
// what it writes:
//   node web/src/game/x/build-sonata/make-sonata.mjs [ref]     (ref: origin/main by default)
// Reads git (first-parent log with --numstat; never an author field), each spec's assignee for the lanes, AGENTS.md's
// Lanes table for the names to scrub, and `gh` for main-red issues' open and close times. Writes snapshot.json here,
// and the chart and pedal it makes into web/public/songs/x/build-sonata/.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { buildSonata, laneOf, parseSubject, scrub } from "./sonata.ts";

const here = new URL(".", import.meta.url).pathname;
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8" }).trim();
const ref = process.argv[2] ?? "origin/main";
const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8", maxBuffer: 2 ** 28 });

// Each feature's assignee, from its spec on the ref.
const assignees = {};
for (const slug of readdirSync(`${repo}/specs/features`)) {
  let spec = "";
  try { spec = git("show", `${ref}:specs/features/${slug}/spec.md`); } catch { continue; }
  const m = spec.match(/^assignee:\s*"?([^"\n]*)"?/m);
  if (m) assignees[slug] = m[1].trim();
}

// The Lanes table's people and GitHub handles: the words no subject may keep.
const agents = git("show", `${ref}:AGENTS.md`);
const lanes = agents.slice(agents.indexOf("| Person | GitHub |"), agents.indexOf("\n\n", agents.indexOf("| Person | GitHub |")));
const names = [...new Set(lanes.split("\n").slice(2).flatMap((row) => row.split("|").slice(1, 3).flatMap((cell) => [...cell.matchAll(/`@?([^`]+)`/g)].map((m) => m[1]))))];

// The first-parent log, oldest first: a header line per commit, then its numstat lines.
const commits = [];
let cur = null;
for (const line of git("log", "--first-parent", "--diff-merges=first-parent", "--reverse", "--numstat", "--format=@@%H%x09%cI%x09%s", ref).split("\n")) {
  if (line.startsWith("@@")) {
    const [hash, time, subject] = line.slice(2).split("\t");
    cur = { hash, time, subject, lines: 0, paths: [] };
    commits.push(cur);
  } else if (cur && line.trim()) {
    const [add, del, path] = line.split("\t");
    cur.lines += (Number(add) || 0) + (Number(del) || 0); // a binary file counts 0
    cur.paths.push(path.replace(/\{[^}]*=> ([^}]*)\}/, "$1").replace(/^.* => /, ""));
  }
}

const merged = commits.flatMap((c) => {
  const p = parseSubject(c.subject);
  if (!p) return [];
  const lane = laneOf(p.type, p.scope, c.paths, assignees);
  return [{ hash: c.hash, time: new Date(c.time).toISOString(), type: p.type, scope: p.scope, pr: p.pr, lines: c.lines, lane, subject: scrub(c.subject, names, lane) }];
});

let red = null;
try {
  red = JSON.parse(execFileSync("gh", ["issue", "list", "--label", "main-red", "--state", "all", "--limit", "500", "--json", "number,createdAt,closedAt"], { cwd: repo, encoding: "utf8" }))
    .map((i) => ({ number: i.number, from: i.createdAt, to: i.closedAt || null }))
    .sort((a, b) => a.from.localeCompare(b.from));
} catch {
  console.warn("make-sonata: gh couldn't read main-red issues; the snapshot has none (red-main data unavailable)");
}

const snapshot = { generatedAt: new Date().toISOString(), count: merged.length, from: merged[0].time, to: merged.at(-1).time, commits: merged, red };
writeFileSync(`${here}snapshot.json`, JSON.stringify(snapshot, null, 1) + "\n");
const { chart, pedal } = buildSonata(snapshot);
const out = `${repo}/web/public/songs/x/build-sonata`;
if (!existsSync(out)) mkdirSync(out, { recursive: true });
writeFileSync(`${out}/chart.json`, JSON.stringify(chart, null, 1) + "\n");
writeFileSync(`${out}/pedal.json`, JSON.stringify({ pedal: pedal.map(([d, u]) => [Math.round(d * 1000) / 1000, Math.round(u * 1000) / 1000]) }) + "\n");
process.stdout.write(`make-sonata: ${merged.length} merged PRs of ${commits.length} commits, ${red ? red.length : "no"} main-red issues, ${chart.notes.length} notes, scrubbed ${names.length} names\n`);
