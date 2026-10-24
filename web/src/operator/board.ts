// The operator board's model: pure functions from collected inputs to what the page shows. No I/O here (see
// collect.ts). The state rules are AGENTS.md's and status.py's; anything the inputs can't answer is null/unknown.

export type Spec = { slug: string; name: string; dependsOn: string[]; assignee: string };
export type Milestone = { name: string; features: string[]; cut: string[] };
export type Ci = "pass" | "fail" | "pending" | "none";
export type OpenPr = {
  number: number;
  title: string;
  body: string;
  isDraft: boolean;
  url: string;
  createdAt: string;
  updatedAt: string;
  ci: Ci;
};
export type AnyPr = {
  number: number;
  title: string;
  state: string; // OPEN | MERGED | CLOSED
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  url: string;
  body?: string; // for the worker; dropped from the board
};
export type Issue = { number: number; title: string; url: string; labels: string[] };
export type MainRun = { conclusion: string; url: string; updatedAt: string };
export type Heartbeat = { worker: string; at: string };
export type Gh = { status: "ok" | "not logged in" | "failed"; calls: number };

export type Inputs = {
  at: string; // collection time, ISO
  sha: string; // HEAD of the checkout the files came from
  mainSha: string | null; // origin/main, when git knows it
  specs: Spec[];
  done: string[]; // slugs with changes/<slug>.md
  milestones: Milestone[] | null; // null: milestones.toml couldn't be read
  stop: boolean;
  openPrs: OpenPr[] | null; // null: no PR data
  allPrs: AnyPr[] | null;
  issues: Issue[] | null;
  mainRun: MainRun | null;
  heartbeats: Heartbeat[] | null;
  gh: Gh;
  banner: string[]; // what's missing, in words
  songRequests?: { number: number; createdAt: string }[] | null; // issues labeled song-request, any state
};

export type State = "done" | "in flight" | "ready" | "blocked" | "backlog" | "cut" | "unknown";
export type Feature = {
  slug: string;
  name: string;
  state: State;
  milestone: string | null;
  assignee: string;
  pr: string | null; // its open feat PR
  dependsOn: string[];
};
export type NeedItem = { kind: string; text: string; url: string | null };
export type CrewPr = { number: number; title: string; url: string; ci: Ci; isDraft: boolean };
export type BoardPr = Omit<AnyPr, "body"> & { worker: string };
export type Board = {
  at: string;
  sha: string;
  mainSha: string | null;
  gh: Gh;
  banner: string[];
  features: Feature[];
  needs: NeedItem[];
  needsUnknown: string[]; // parts of "needs a person" the data can't answer
  crew: { worker: string; prs: CrewPr[] }[] | null;
  prs: BoardPr[] | null; // every PR, oldest first, for the replay at /attract
  heartbeats: Heartbeat[] | null; // live only; never in a snapshot
  books: {
    milestones: { name: string; done: number; planned: number; cut: number }[];
    mergedByType: [string, number][] | null;
    medianMergeMin: number | null;
    longest: { number: number; title: string; url: string; minutes: number }[] | null;
    firstPrAt: string | null;
    songRequests?: SongRequestTime[] | null; // absent in snapshots older than song-requests
  };
};
export type SongRequestTime = { issue: number; pr: number; url: string; minutes: number };

const CLOSES = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;

// song-requests: each merged PR that closed a song-request issue, timed from the issue's creation to the merge.
export function songRequestTimes(merged: AnyPr[], requests: { number: number; createdAt: string }[]): SongRequestTime[] {
  const created = new Map(requests.map((r) => [r.number, r.createdAt]));
  return merged
    .flatMap((p) =>
      [...(p.body ?? "").matchAll(CLOSES)]
        .map((m) => Number(m[1]))
        .filter((n) => created.has(n))
        .map((n) => ({ issue: n, pr: p.number, url: p.url, minutes: Math.round(minutesBetween(created.get(n)!, p.mergedAt!)) })),
    )
    .sort((a, b) => a.issue - b.issue);
}

export const STALE_DRAFT_MIN = 45; // the watchdog's stale_claim_minutes

const TITLE = /^([a-z]+)(?:\(([^)]*)\))?!?:\s*\S/;
const TYPES = ["feat", "fix", "refactor", "perf", "test", "chore", "style", "docs", "contract", "plan", "revert"];

// Conventional Commits type and scope, exactly as lib.py's parse_title accepts them (a feat must name its feature).
// GitHub's revert button writes 'Revert "..."'.
export function titleType(title: string): { type: string; scope: string | null } | null {
  if (title.trim().startsWith('Revert "')) return { type: "revert", scope: null };
  const m = TITLE.exec(title.trim());
  if (!m || !TYPES.includes(m[1])) return null;
  const scope = m[2]?.trim() || null;
  return m[1] === "feat" && !scope ? null : { type: m[1], scope };
}

// Precedence: done, then cut and backlog (they hold with or without PR data), then in flight / ready / blocked,
// which need PR data to tell apart.
export function featureState(
  spec: Spec,
  done: Set<string>,
  milestones: Milestone[] | null, // null: milestones.toml couldn't be read
  inFlight: Set<string> | null,
): State {
  if (done.has(spec.slug)) return "done";
  if (milestones === null) return "unknown";
  if (milestones.some((m) => m.cut.includes(spec.slug))) return "cut";
  if (!milestones.some((m) => m.features.includes(spec.slug))) return "backlog";
  if (!inFlight) return "unknown";
  if (inFlight.has(spec.slug)) return "in flight";
  return spec.dependsOn.every((d) => done.has(d)) ? "ready" : "blocked";
}

export function workerOf(pr: { title: string; body: string }): string {
  const m = /^[ \t]*Worker:[ \t]*([A-Za-z0-9][\w-]*)/im.exec(pr.body || "");
  if (m) return m[1];
  const t = titleType(pr.title)?.type;
  return t === "plan" || t === "contract" ? "planner" : "unnamed";
}

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

export function needsPerson(i: Inputs): { needs: NeedItem[]; needsUnknown: string[] } {
  const needs: NeedItem[] = [];
  const needsUnknown: string[] = [];
  const repo = (i.openPrs ?? i.allPrs ?? [])[0]?.url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+/)?.[0];
  if (i.stop) needs.push({ kind: "STOP", text: "STOP file present: agents must stop", url: repo ? `${repo}/blob/main/STOP` : null });
  if (i.mainRun === null) needsUnknown.push("main CI");
  else if (!["success", "neutral", "skipped"].includes(i.mainRun.conclusion))
    needs.push({ kind: "main CI", text: `main CI is red (${i.mainRun.conclusion})`, url: i.mainRun.url });
  if (i.openPrs === null) needsUnknown.push("PRs");
  for (const pr of i.openPrs ?? []) {
    const t = titleType(pr.title)?.type;
    if (!pr.isDraft && (t === "plan" || t === "contract"))
      needs.push({ kind: `${t} PR`, text: `#${pr.number} ${pr.title}`, url: pr.url });
  }
  for (const pr of i.openPrs ?? []) {
    const age = minutesBetween(pr.updatedAt, i.at);
    if (pr.isDraft && age >= STALE_DRAFT_MIN)
      needs.push({ kind: "stale draft", text: `#${pr.number} ${pr.title} · no push for ${Math.floor(age)} min`, url: pr.url });
  }
  if (i.issues === null) needsUnknown.push("issues");
  for (const is of i.issues ?? []) {
    const label = ["needs-human", "blocked"].find((l) => is.labels.includes(l));
    if (label) needs.push({ kind: label, text: `#${is.number} ${is.title}`, url: is.url });
  }
  return { needs, needsUnknown };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function buildBoard(i: Inputs): Board {
  const done = new Set(i.done);
  const prOf = new Map<string, string>(); // slug -> its open feat PR's URL
  for (const p of i.openPrs ?? []) {
    const t = titleType(p.title);
    if (t?.type === "feat" && t.scope) prOf.set(t.scope, p.url);
  }
  const inFlight = i.openPrs ? new Set(prOf.keys()) : null;
  const milestoneOf = (slug: string) => i.milestones?.find((m) => m.features.includes(slug))?.name ?? null;
  const features = i.specs.map((s) => ({
    slug: s.slug,
    name: s.name,
    state: featureState(s, done, i.milestones, inFlight),
    milestone: milestoneOf(s.slug),
    assignee: s.assignee,
    pr: prOf.get(s.slug) ?? null,
    dependsOn: s.dependsOn,
  }));

  let crew: Board["crew"] = null;
  if (i.openPrs) {
    const by = new Map<string, CrewPr[]>();
    for (const pr of [...i.openPrs].sort((a, b) => a.number - b.number)) {
      const w = workerOf(pr);
      by.set(w, [...(by.get(w) ?? []), { number: pr.number, title: pr.title, url: pr.url, ci: pr.ci, isDraft: pr.isDraft }]);
    }
    crew = [...by].sort(([a], [b]) => a.localeCompare(b)).map(([worker, prs]) => ({ worker, prs }));
  }

  const merged = i.allPrs?.filter((p) => p.mergedAt) ?? null;
  let mergedByType: [string, number][] | null = null;
  let longest: Board["books"]["longest"] = null;
  if (merged) {
    const counts = new Map<string, number>();
    for (const p of merged) {
      const t = titleType(p.title)?.type ?? "other";
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    mergedByType = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    longest = merged
      .filter((p) => titleType(p.title)?.type === "feat")
      .map((p) => ({ number: p.number, title: p.title, url: p.url, minutes: Math.round(minutesBetween(p.createdAt, p.mergedAt!)) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3);
  }
  const mergeMins = merged?.map((p) => minutesBetween(p.createdAt, p.mergedAt!)) ?? [];
  const firstPr = i.allPrs?.length ? i.allPrs.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt : null;

  return {
    at: i.at,
    sha: i.sha,
    mainSha: i.mainSha,
    gh: i.gh,
    banner: i.banner,
    features,
    ...needsPerson(i),
    crew,
    prs:
      i.allPrs
        ?.map(({ body, ...p }) => ({ ...p, worker: workerOf({ title: p.title, body: body ?? "" }) }))
        .sort((a, b) => a.number - b.number) ?? null,
    heartbeats: i.heartbeats,
    books: {
      milestones: (i.milestones ?? []).map((m) => ({
        name: m.name,
        done: m.features.filter((s) => done.has(s)).length,
        planned: m.features.length,
        cut: m.cut.length,
      })),
      mergedByType,
      medianMergeMin: merged && mergeMins.length ? Math.round(median(mergeMins)!) : null,
      longest,
      firstPrAt: firstPr,
      songRequests: merged && i.songRequests ? songRequestTimes(merged, i.songRequests) : null,
    },
  };
}

// What judges see: the same board, minus anything local to this machine.
export function toSnapshot(b: Board): Board {
  return { ...b, heartbeats: null };
}

// --- readers for the repo's own file shapes (no YAML or TOML dependency); ports of lib.py's -------------------------

function scalar(raw: string): unknown {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]"))
    return v.slice(1, -1).split(",").filter((x) => x.trim()).map(scalar);
  if (v.length >= 2 && v[0] === v.at(-1) && `"'`.includes(v[0])) return v.slice(1, -1);
  if (v === "true" || v === "false") return v === "true";
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let k = 0; k < line.length; k++) {
    const ch = line[k];
    if (quote) quote = ch === quote ? null : quote;
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "#") return line.slice(0, k).trimEnd();
  }
  return line.trimEnd();
}

const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : v === "" || v == null ? [] : [String(v)]);

// A spec's `---` frontmatter, as lib.py's front_matter reads it: `key: value`, `key: [a, b]` (quoted or not), and
// `key:` followed by `  - item` lines.
export function parseFrontmatter(text: string): Record<string, unknown> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out: Record<string, unknown> = {};
  let current: string | null = null;
  for (const raw of m?.[1].split(/\r?\n/) ?? []) {
    const line = stripComment(raw);
    if (!line.trim()) continue;
    if (!/^[ \t]/.test(line)) {
      const k = line.indexOf(":");
      const [key, val] = k < 0 ? [line, ""] : [line.slice(0, k), line.slice(k + 1)];
      current = key.trim();
      out[current] = val.trim() ? scalar(val) : [];
    } else if (current !== null && line.trim().startsWith("- ") && Array.isArray(out[current])) {
      (out[current] as unknown[]).push(scalar(line.trim().slice(2)));
    }
  }
  return out;
}

export function specFrom(slug: string, text: string): Spec {
  const fm = parseFrontmatter(text);
  return { slug, name: String(fm.name ?? ""), dependsOn: strings(fm.depends_on), assignee: String(fm.assignee ?? "") };
}

// specs/milestones.toml's own shape: top-level keys, then [[milestone]] tables of strings, booleans and string lists
// (a list may span lines). Throws on a line it doesn't understand, so a new shape is noticed, not misread.
export function parseMilestones(text: string): Milestone[] {
  const tables: Record<string, unknown>[] = [];
  let cur: Record<string, unknown> = {};
  let pending = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = pending + stripComment(raw).trim();
    if (!line) continue;
    if (line === "[[milestone]]") {
      tables.push((cur = {}));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*)\s*=\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`milestones.toml: can't read "${raw.trim()}"`);
    if (kv[2].startsWith("[") && !kv[2].endsWith("]")) {
      pending = line + " ";
      continue;
    }
    pending = "";
    cur[kv[1]] = scalar(kv[2]);
  }
  return tables.map((t) => ({ name: String(t.name ?? ""), features: strings(t.features), cut: strings(t.cut) }));
}
