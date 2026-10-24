// Server-only: collects the operator board's inputs from the repo on disk and GitHub through the `gh` CLI (the user's
// own login; the app never handles a token). Any failure leaves a board built from files plus a banner. Never throws.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildBoard, parseMilestones, specFrom, type Board, type Ci, type Gh, type Inputs, type OpenPr } from "./board";

export type GhResult = { code: number; stdout: string; stderr: string };
export type GhRun = (args: string[]) => Promise<GhResult>;

const run = (cmd: string, args: string[], cwd: string): Promise<GhResult> =>
  new Promise((res) =>
    execFile(cmd, args, { cwd, timeout: 30_000, maxBuffer: 64 << 20 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : -1) : 0;
      res({ code, stdout, stderr: err && err.code === "ENOENT" ? `${cmd}: not installed` : stderr || String(err ?? "") });
    }),
  );

const git = async (root: string, ...args: string[]) => {
  const r = await run("git", args, root);
  return r.code === 0 ? r.stdout.trim() : null;
};

export async function repoRoot(cwd = process.cwd()): Promise<string> {
  return (await git(cwd, "rev-parse", "--show-toplevel")) ?? resolve(cwd, "..");
}

// statusCheckRollup mixes CheckRuns (status, conclusion) and StatusContexts (state).
type Check = { status?: string; conclusion?: string; state?: string };
export function ciOf(checks: Check[] | null | undefined): Ci {
  if (!checks?.length) return "none";
  const results = checks.map((c) => (c.state ?? (c.status === "COMPLETED" ? c.conclusion : "PENDING") ?? "").toUpperCase());
  if (results.some((r) => ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(r)))
    return "fail";
  if (results.some((r) => ["PENDING", "EXPECTED", "QUEUED", "IN_PROGRESS", "WAITING", ""].includes(r))) return "pending";
  return "pass";
}

function why(r: GhResult): { status: Gh["status"]; text: string } {
  const e = r.stderr;
  if (/not installed/.test(e)) return { status: "failed", text: "gh isn't installed" };
  if (r.code === 4 || /auth login|not logged in/i.test(e)) return { status: "not logged in", text: "gh isn't logged in" };
  if (/rate limit/i.test(e)) return { status: "failed", text: "GitHub's rate limit was hit" };
  if (/resolve|network|connect|timed? ?out|offline/i.test(e)) return { status: "failed", text: "GitHub couldn't be reached" };
  return { status: "failed", text: `gh failed (${e.trim().split("\n")[0].slice(0, 120) || `exit ${r.code}`})` };
}

async function heartbeats(root: string): Promise<Inputs["heartbeats"]> {
  const common = await git(root, "rev-parse", "--git-common-dir");
  if (!common) return null;
  const dir = join(resolve(root, common), "agent-heartbeats");
  try {
    const names = await readdir(dir);
    const rows = await Promise.all(names.map(async (worker) => ({ worker, at: (await stat(join(dir, worker))).mtime.toISOString() })));
    return rows.sort((a, b) => a.worker.localeCompare(b.worker));
  } catch {
    return []; // no folder yet: nobody has written a heartbeat
  }
}

export async function collect(opts: { root: string; gh?: GhRun; now?: Date }): Promise<Board> {
  const { root } = opts;
  const gh = opts.gh ?? ((args) => run("gh", args, root));
  const banner: string[] = [];

  const featuresDir = join(root, "specs/features");
  const slugs = (await readdir(featuresDir, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory() && d.name !== "_template" && existsSync(join(featuresDir, d.name, "spec.md")))
    .map((d) => d.name)
    .sort();
  const specs = await Promise.all(slugs.map(async (s) => specFrom(s, await readFile(join(featuresDir, s, "spec.md"), "utf8"))));
  const done = (await readdir(join(root, "changes")).catch(() => [] as string[]))
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
  let milestones: Inputs["milestones"] = [];
  try {
    milestones = parseMilestones(await readFile(join(root, "specs/milestones.toml"), "utf8"));
  } catch (e) {
    banner.push(`Milestones unknown: ${(e as Error).message}`);
  }
  const [sha, mainSha, beats] = await Promise.all([
    git(root, "rev-parse", "--short", "HEAD"),
    git(root, "rev-parse", "--short", "origin/main"),
    heartbeats(root),
  ]);
  if (sha && mainSha && sha !== mainSha) banner.push(`Files are from ${sha}, not main (${mainSha}).`);

  // At most 4 gh calls. The first failure stops the rest: a logged-out or offline gh fails them all alike.
  let calls = 0;
  const st: { failure: ReturnType<typeof why> | null } = { failure: null };
  const ghJson = async <T,>(args: string[]): Promise<T | null> => {
    if (st.failure) return null;
    calls++;
    const r = await gh(args);
    if (r.code === 0) {
      try {
        return JSON.parse(r.stdout) as T;
      } catch {
        st.failure = { status: "failed", text: "gh returned something that isn't JSON" };
        return null;
      }
    }
    st.failure = why(r);
    return null;
  };

  type RawOpen = Omit<OpenPr, "ci"> & { statusCheckRollup?: Check[] };
  const open = await ghJson<RawOpen[]>([
    "pr", "list", "--state", "open", "--limit", "200",
    "--json", "number,title,body,isDraft,url,createdAt,updatedAt,statusCheckRollup",
  ]);
  const all = await ghJson<{ number: number; title: string; state: string; createdAt: string; mergedAt: string | null; url: string }[]>([
    "pr", "list", "--state", "all", "--limit", "1000", "--json", "number,title,state,createdAt,mergedAt,url",
  ]);
  const issues = await ghJson<{ number: number; title: string; url: string; labels: { name: string }[] }[]>([
    "issue", "list", "--state", "open", "--limit", "300", "--json", "number,title,url,labels",
  ]);
  const runs = await ghJson<{ conclusion: string; url: string; updatedAt: string }[]>([
    "run", "list", "--branch", "main", "--status", "completed", "--limit", "1", "--json", "conclusion,url,updatedAt",
  ]);

  const missing = [!open || !all ? "PRs" : "", !issues ? "issues" : "", !runs?.length ? "main CI" : ""].filter(Boolean);
  const { failure } = st;
  if (failure) banner.unshift(`${failure.text}: ${missing.join(", ")} unknown. The board is built from repo files.`);
  else if (runs && !runs.length) banner.push("main CI unknown: no finished run on main yet.");

  return buildBoard({
    at: (opts.now ?? new Date()).toISOString(),
    sha: sha ?? "unknown",
    mainSha,
    specs,
    done,
    milestones,
    stop: existsSync(join(root, "STOP")),
    openPrs: open && all ? open.map(({ statusCheckRollup, ...p }) => ({ ...p, body: p.body ?? "", ci: ciOf(statusCheckRollup) })) : null,
    allPrs: open && all ? all : null,
    issues: issues?.map((i) => ({ ...i, labels: i.labels.map((l) => l.name) })) ?? null,
    mainRun: runs?.[0] ?? null,
    heartbeats: beats,
    gh: { status: failure ? failure.status : "ok", calls },
    banner,
  });
}

// Live mode: collect at most once every 60 s, shared across requests (and dev reloads, through globalThis).
export const CACHE_MS = 60_000;
const g = globalThis as typeof globalThis & { __operatorCache?: { at: number; board: Promise<Board> } };

export function cachedBoard(): Promise<Board> {
  const now = Date.now();
  if (!g.__operatorCache || now - g.__operatorCache.at >= CACHE_MS) {
    const started = now;
    const board = repoRoot().then((root) => collect({ root }));
    board.then((b) => console.info(`operator: collected in ${Date.now() - started} ms, gh: ${b.gh.status} · ${b.gh.calls} calls`));
    g.__operatorCache = { at: now, board };
  }
  return g.__operatorCache.board;
}
