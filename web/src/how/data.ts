// /how's data: pure functions from the snapshot, git and the repo's own files to what the page shows. Inputs are
// passed in (see read.ts); anything missing comes out null, and the page renders null as `unknown`.
import type { Board, BoardPr, Feature } from "../operator/board";
import { kindOf, type Kind } from "../replay/model";

// The one typed exception (spec: "Role copy"): the team's setup, not a measurement, so no numbers here.
export const ROLES = {
  eric: { name: "Eric", job: "decides, merges plans, plays the piano" },
  asking: { name: "eric-asking-agent", job: "Eric's main contact; read-only" },
  planning: { name: "eric-planning-agent", job: "writes specs, orders milestones" },
  workers: { names: ["eric-agent-1", "eric-agent-2", "eric-agent-3", "eric-agent-4", "eric-agent-5", "eric-agent-6"], standby: ["eric-agent-6"], job: "build features, one PR each" },
  foreman: { name: "eric-foreman-agent", job: "owns /operator and /attract; manages no one" },
} as const;

export const KINDS: Kind[] = ["feat", "fix", "plan", "other"];
export const KIND_LABEL: Record<Kind, string> = { feat: "feat", fix: "fix, refactor, perf, test", plan: "plan, contract", other: "other" };

// --- merges per hour ---------------------------------------------------------------------------------------------

export type Hour = { at: string; label: string; counts: Record<Kind, number>; total: number };
const HOUR = 3_600_000;
const ny = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric" });
// "Sat 9 AM", from parts: ICU's joined format (commas, spaces) varies between Node builds.
const nyLabel = (t: number) => {
  const p = Object.fromEntries(ny.formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.hour} ${p.dayPeriod}`;
};

// UTC hour buckets from the first merge's hour to the last's, empty hours included, labeled in New York time.
export function mergesPerHour(prs: BoardPr[] | null | undefined): Hour[] {
  const times = (prs ?? []).filter((p) => p.mergedAt).map((p) => ({ t: Date.parse(p.mergedAt!), kind: kindOf(p.title) }));
  if (!times.length) return [];
  const floor = (t: number) => Math.floor(t / HOUR) * HOUR;
  const first = floor(Math.min(...times.map((x) => x.t)));
  const last = floor(Math.max(...times.map((x) => x.t)));
  const hours: Hour[] = [];
  for (let h = first; h <= last; h += HOUR)
    hours.push({ at: new Date(h).toISOString(), label: nyLabel(h), counts: { feat: 0, fix: 0, plan: 0, other: 0 }, total: 0 });
  for (const { t, kind } of times) {
    const b = hours[(floor(t) - first) / HOUR];
    b.counts[kind]++;
    b.total++;
  }
  return hours;
}

// --- who does what ------------------------------------------------------------------------------------------------

// Merged PRs per worker, from each PR's Worker: line (operator-board's rule). null: no snapshot.
export function mergedByWorker(prs: BoardPr[] | null | undefined): Map<string, number> | null {
  if (!prs) return null;
  const out = new Map<string, number>();
  for (const p of prs) if (p.mergedAt) out.set(p.worker, (out.get(p.worker) ?? 0) + 1);
  return out;
}

const NAMED: string[] = [ROLES.asking.name, ROLES.planning.name, ...ROLES.workers.names, ROLES.foreman.name];

// Workers in the data that ROLES doesn't name: shown under "other", never dropped.
export function otherWorkers(byWorker: Map<string, number> | null): [string, number][] {
  return byWorker ? [...byWorker].filter(([w]) => !NAMED.includes(w)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) : [];
}

// --- a feature's life ---------------------------------------------------------------------------------------------

export type Stages = { backlog: number; ready: number; blocked: number; inFlight: number; done: number };
export function stageCounts(features: Feature[] | null | undefined): Stages | null {
  if (!features) return null;
  const n = (s: Feature["state"]) => features.filter((f) => f.state === s).length;
  return { backlog: n("backlog"), ready: n("ready"), blocked: n("blocked"), inFlight: n("in flight"), done: n("done") };
}

// --- the repo's lanes ---------------------------------------------------------------------------------------------

export const countLines = (text: string) => (text.match(/\n/g)?.length ?? 0) + (text && !text.endsWith("\n") ? 1 : 0);

// The folder a file counts toward: web/src/<dir>/, or web/src/app/<route>/ (CODEOWNERS splits app/ by route).
// Files directly in web/src/ or web/src/app/ count toward that folder.
export function folderOf(path: string): string | null {
  const m = /^web\/src\/(?:(app)\/)?([^/]+)\//.exec(path);
  if (m) return `web/src/${m[1] ? "app/" : ""}${m[2]}/`;
  if (/^web\/src\/app\/[^/]+$/.test(path)) return "web/src/app/";
  if (/^web\/src\/[^/]+$/.test(path)) return "web/src/";
  return null;
}

export function folderLines(files: { path: string; lines: number }[]): { folder: string; lines: number }[] {
  const by = new Map<string, number>();
  for (const f of files) {
    const folder = folderOf(f.path);
    if (folder) by.set(folder, (by.get(folder) ?? 0) + f.lines);
  }
  return [...by].map(([folder, lines]) => ({ folder, lines })).sort((a, b) => b.lines - a.lines || a.folder.localeCompare(b.folder));
}

export type CodeOwner = { path: string; owner: string };
export function parseCodeowners(text: string): CodeOwner[] {
  return text
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((l) => l.split(/\s+/))
    .filter((p) => p.length >= 2)
    .map(([path, owner]) => ({ path: path.replace(/^\//, ""), owner }));
}

export type Lane = { person: string; github: string; lane: string; folders: string[] };
// AGENTS.md's Lanes table: Person | GitHub | Lane | Folder, folders as `code` spans.
export function parseLanes(agentsMd: string): Lane[] {
  const section = agentsMd.split(/^## Lanes$/m)[1]?.split(/^## /m)[0] ?? "";
  const plain = (s: string) => s.replace(/`/g, "").trim();
  return section
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|\s*-/.test(l) && !/^\|\s*Person\s*\|/.test(l))
    .map((l) => l.split("|").slice(1, -1))
    .filter((c) => c.length >= 4)
    .map(([person, github, lane, folder]) => ({
      person: plain(person),
      github: plain(github),
      lane: plain(lane),
      folders: [...folder.matchAll(/`([^`]+)`/g)].map((m) => m[1]),
    }));
}

// The longest CODEOWNERS prefix covering the folder, else the Lanes Folder column, else "no owner listed".
export function ownerOf(folder: string, owners: CodeOwner[], lanes: Lane[]): string {
  const hit = owners.filter((o) => folder.startsWith(o.path)).sort((a, b) => b.path.length - a.path.length)[0];
  if (hit) return hit.owner;
  const lane = lanes.find((l) => l.folders.some((f) => folder.startsWith(f)));
  return lane ? lane.person : "no owner listed";
}

// --- what went wrong ----------------------------------------------------------------------------------------------

// Entries in run-checks.mjs's KNOWN_RED object: "path": issue, lines. null when the block isn't there.
export function knownRedCount(source: string | null): number | null {
  const block = source && /KNOWN_RED\s*=\s*\{([\s\S]*?)\}/.exec(source);
  return block ? (block[1].match(/^\s*"[^"]+"\s*:\s*\d+/gm)?.length ?? 0) : null;
}

const mergedAt = (prs: BoardPr[] | null | undefined, n: number) => {
  const p = prs?.find((x) => x.number === n);
  return p?.mergedAt ? Date.parse(p.mergedAt) : null;
};

// The red-main incident: seconds between #387's and #391's merges, and minutes from the later one to #397 (the fix).
export function incident(prs: BoardPr[] | null | undefined): { gapSec: number; fixMin: number } | null {
  const [a, b, fix] = [387, 391, 397].map((n) => mergedAt(prs, n));
  if (a === null || b === null || fix === null) return null;
  return { gapSec: Math.round(Math.abs(b - a) / 1000), fixMin: Math.round((fix - Math.max(a, b)) / 60_000) };
}

// git@github.com:o/r.git or https://github.com/o/r(.git) -> https://github.com/o/r
export function githubUrl(remote: string | null): string | null {
  const m = remote && /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\s*$/.exec(remote);
  return m ? `https://github.com/${m[1]}/${m[2]}` : null;
}

// --- everything the page shows ------------------------------------------------------------------------------------

export type Inputs = {
  snapshot: Board | null;
  files: { path: string; lines: number }[] | null; // git ls-files web/src, lines from disk
  runChecksAt433: string | null;
  runChecksNow: string | null;
  codeowners: string | null;
  agentsMd: string | null;
  remote: string | null; // git's origin URL, for links when there's no snapshot
};

export function howData(i: Inputs) {
  const s = i.snapshot;
  const prs = s?.prs ?? null;
  const owners = i.codeowners ? parseCodeowners(i.codeowners) : [];
  const lanes = i.agentsMd ? parseLanes(i.agentsMd) : [];
  const byWorker = mergedByWorker(prs);
  const hours = mergesPerHour(prs);
  const busiest = hours.reduce<Hour | null>((a, h) => (!a || h.total > a.total ? h : a), null);
  const featState = (slug: string) => s?.features.find((f) => f.slug === slug)?.state ?? null;
  return {
    at: s?.at ?? null,
    mainSha: s?.mainSha ?? null,
    byWorker,
    others: otherWorkers(byWorker),
    lanes,
    stages: stageCounts(s?.features),
    medianMergeMin: s?.books.medianMergeMin ?? null,
    folders: i.files ? folderLines(i.files).map((f) => ({ ...f, owner: ownerOf(f.folder, owners, lanes) })) : null,
    hours: hours.length ? hours : null,
    totalMerged: prs ? prs.filter((p) => p.mergedAt).length : null,
    busiest,
    incident: incident(prs),
    buildStamp: featState("build-stamp"),
    ciBrowser: featState("ci-browser"),
    knownRedFirst: knownRedCount(i.runChecksAt433),
    knownRedNow: knownRedCount(i.runChecksNow),
    repo: githubUrl(i.remote) ?? prs?.[0]?.url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+/)?.[0] ?? null,
  };
}
export type HowData = ReturnType<typeof howData>;
