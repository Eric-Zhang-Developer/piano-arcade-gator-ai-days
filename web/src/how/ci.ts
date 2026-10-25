// /how/ci's numbers, computed from ci-snapshot.json (frozen from GitHub by ci-freeze.mjs). Pure: the snapshot is
// passed in, nothing is typed by hand. A value the data can't give is null, shown as `unknown` or "measuring".

export type Run = [event: string, branch: string, pr: number | null, created: number, updated: number, conclusion: string | null];
export type Job = [run: number, browser: 0 | 1, queued: number | null, started: number | null, completed: number | null, ok: 0 | 1];
export type Mark = { n: number; kind: "pr" | "issue"; label: string; t: number | null };
export type CiSnapshot = { at: string; since: string; repo: string; runs: Run[]; jobs: Job[]; marks: Mark[]; merges: number[] };

// "After" stays "measuring" until the smoke-only checks have run this long, with at least this many green PR runs.
export const AFTER_MIN_HOURS = 3;
export const AFTER_MIN_RUNS = 3;
export const STEP_SEC = 300;

const HOUR = 3600;
export const end = (s: CiSnapshot) => Math.round((Date.parse(s.at) - Date.parse(s.since)) / 1000);

// New York time of an offset, e.g. "1:09 AM".
export const clock = (s: CiSnapshot, t: number) =>
  new Date(Date.parse(s.since) + t * 1000).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

// When a job stops waiting: it starts, or it's cancelled while queued, or it's still waiting at the snapshot.
const queuedUntil = (j: Job, last: number) => j[3] ?? j[4] ?? last;
const runningUntil = (j: Job, last: number) => j[4] ?? last;

export type FlightPoint = { t: number; running: number; queued: number; mainQueued: number };

// Browser jobs running and waiting at each step.
export function flight(s: CiSnapshot, step = STEP_SEC): FlightPoint[] {
  const last = end(s);
  const browser = s.jobs.filter((j) => j[1] === 1);
  const points: FlightPoint[] = [];
  for (let t = 0; t < last; t += step) {
    let running = 0;
    let queued = 0;
    let mainQueued = 0;
    for (const j of browser) {
      if (j[3] !== null && j[3] <= t && t < runningUntil(j, last)) running++;
      if (j[2] !== null && j[2] <= t && t < queuedUntil(j, last)) {
        queued++;
        if (s.runs[j[0]]?.[1] === "main") mainQueued++;
      }
    }
    points.push({ t, running, queued, mainQueued });
  }
  return points;
}

export function peak<K extends keyof FlightPoint>(points: FlightPoint[], key: K, from = -Infinity, to = Infinity) {
  let best: FlightPoint | null = null;
  for (const p of points) if (p.t >= from && p.t < to && (!best || p[key] > best[key])) best = p;
  return best && best[key] > 0 ? { value: best[key], t: best.t } : null;
}

// The longest any of main's browser jobs waited for a runner, in minutes.
export function mainWait(s: CiSnapshot, from = -Infinity, to = Infinity) {
  const last = end(s);
  let best: { min: number; t: number } | null = null;
  for (const j of s.jobs) {
    if (j[1] !== 1 || j[2] === null || s.runs[j[0]]?.[1] !== "main" || j[2] < from || j[2] >= to) continue;
    const min = (queuedUntil(j, last) - j[2]) / 60;
    if (!best || min > best.min) best = { min, t: j[2] };
  }
  return best && { min: Math.round(best.min * 10) / 10, t: best.t };
}

export const cutoff = (s: CiSnapshot) => s.marks.find((m) => m.n === 687)?.t ?? null;

// Green PR runs: when each started, and minutes from push to green (queue included). Timed by the run's jobs,
// first queued to last completed, so a re-run counts as its own attempt rather than stretching the first.
export function greenRuns(s: CiSnapshot) {
  const span = new Map<number, { from: number; to: number; open: boolean }>();
  for (const j of s.jobs) {
    const x = span.get(j[0]) ?? { from: Infinity, to: -Infinity, open: false };
    if (j[2] !== null) x.from = Math.min(x.from, j[2]);
    if (j[4] === null) x.open = true;
    else x.to = Math.max(x.to, j[4]);
    span.set(j[0], x);
  }
  const out: { t: number; min: number; pr: number | null }[] = [];
  s.runs.forEach((r, i) => {
    const x = span.get(i);
    if (r[0] !== "pull_request" || r[5] !== "success" || !x || x.open || !Number.isFinite(x.from) || x.to < x.from) return;
    out.push({ t: x.from, min: Math.round(((x.to - x.from) / 60) * 10) / 10, pr: r[2] });
  });
  return out;
}

export function stats(nums: number[]) {
  if (!nums.length) return null;
  const xs = [...nums].sort((a, b) => a - b);
  const at = (q: number) => xs[Math.min(xs.length - 1, Math.ceil(q * xs.length) - 1)];
  return { n: xs.length, median: at(0.5), p90: at(0.9), max: xs[xs.length - 1] };
}

// Before and after the smoke-only switch (#687). `after` is null until there's enough of it to mean something.
export function beforeAfter(s: CiSnapshot) {
  const cut = cutoff(s);
  const runs = greenRuns(s);
  const before = runs.filter((r) => cut === null || r.t < cut);
  const afterRuns = cut === null ? [] : runs.filter((r) => r.t >= cut);
  const ready = cut !== null && end(s) - cut >= AFTER_MIN_HOURS * HOUR && afterRuns.length >= AFTER_MIN_RUNS;
  return { cut, before, after: ready ? afterRuns : null, beforeStats: stats(before.map((r) => r.min)), afterStats: ready ? stats(afterRuns.map((r) => r.min)) : null };
}

export type Hour = { t: number; label: string; count: number };

// PRs merged in each whole New York clock hour between `since` and the freeze (a part hour isn't counted).
export function mergesPerHour(s: CiSnapshot): Hour[] {
  const start = Date.parse(s.since);
  const first = Math.ceil(start / (HOUR * 1000)) * HOUR * 1000;
  const hours: Hour[] = [];
  for (let ms = first; ms + HOUR * 1000 <= start + end(s) * 1000; ms += HOUR * 1000) {
    const t = (ms - start) / 1000;
    hours.push({
      t,
      label: new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric" }),
      count: s.merges.filter((m) => m >= t && m < t + HOUR).length,
    });
  }
  return hours;
}

// Merges an hour, averaged over whole hours in [from, to).
export function rate(hours: Hour[], from: number, to: number) {
  const h = hours.filter((x) => x.t >= from && x.t + HOUR <= to);
  return h.length ? Math.round((h.reduce((a, x) => a + x.count, 0) / h.length) * 10) / 10 : null;
}
