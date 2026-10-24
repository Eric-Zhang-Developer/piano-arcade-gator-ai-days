// Attract mode's model: pure functions from operator-board's board and the Twinkle chart to what /attract shows.
// The board is imported, never edited; this file only reads it.
import type { Chart, ChartNote } from "../contracts";
import { titleType, type Board, type BoardPr, type Feature } from "../operator/board";

// --- the graph -------------------------------------------------------------------------------------------------------

export type Pos = { x: number; z: number }; // x: across the row, centered on 0; z: rows back from the front

// Roots at the front (z 0), each feature a row behind the deepest thing it depends on. Unknown deps are ignored;
// a dependency cycle (which spec lint should prevent) is cut where it's found rather than looping.
export function layout(features: Pick<Feature, "slug" | "dependsOn">[]): Map<string, Pos> {
  const deps = new Map(features.map((f) => [f.slug, f.dependsOn]));
  const depth = new Map<string, number>();
  const visit = (slug: string, seen: Set<string>): number => {
    if (depth.has(slug)) return depth.get(slug)!;
    if (seen.has(slug)) return 0;
    seen.add(slug);
    const ds = (deps.get(slug) ?? []).filter((d) => deps.has(d));
    const d = ds.length ? 1 + Math.max(...ds.map((x) => visit(x, seen))) : 0;
    depth.set(slug, d);
    return d;
  };
  const rows = new Map<number, string[]>();
  for (const f of features) {
    const z = visit(f.slug, new Set());
    rows.set(z, [...(rows.get(z) ?? []), f.slug]);
  }
  const out = new Map<string, Pos>();
  for (const [z, slugs] of rows) slugs.sort().forEach((s, i) => out.set(s, { x: i - (slugs.length - 1) / 2, z }));
  return out;
}

// --- the replay ------------------------------------------------------------------------------------------------------

export type Step = {
  pr: BoardPr;
  atMs: number; // ordinal time: note k of the chart, wrapping
  wallMs: number; // the same step on the merge clock, squeezed into the same total length
  note: ChartNote;
  noteMs: number; // how long the note sounds
  feat: string | null; // feat(<slug>) merges raise that pillar
};

export const msPerBeat = (chart: Chart) => 60_000 / chart.bpm;

export function steps(prs: BoardPr[], chart: Chart): Step[] {
  const merged = prs.filter((p) => p.mergedAt).sort((a, b) => a.mergedAt!.localeCompare(b.mergedAt!) || a.number - b.number);
  const beat = msPerBeat(chart);
  const n = chart.notes.length;
  const last = chart.notes[n - 1];
  const loopBeats = last.beat + last.duration;
  const t0 = merged.length ? Date.parse(merged[0].mergedAt!) : 0;
  const span = merged.length > 1 ? Date.parse(merged.at(-1)!.mergedAt!) - t0 : 0;
  const total = merged.length ? (Math.floor((merged.length - 1) / n) * loopBeats + chart.notes[(merged.length - 1) % n].beat) * beat : 0;
  return merged.map((pr, k) => {
    const note = chart.notes[k % n];
    const t = titleType(pr.title);
    return {
      pr,
      atMs: (Math.floor(k / n) * loopBeats + note.beat) * beat,
      wallMs: span ? ((Date.parse(pr.mergedAt!) - t0) / span) * total : 0,
      note,
      noteMs: note.duration * beat,
      feat: t?.type === "feat" ? t.scope : null,
    };
  });
}

// How long step s's note should still sound when its timer fires at `now`: it ends 20 ms before its intended end,
// however late the timer was, so its note-off always lands before the next step's note-on (which matters on a
// repeated pitch: an off arriving after the next on would cut that note short). At least 30 ms.
export const noteLeftMs = (originMs: number, s: Pick<Step, "atMs" | "noteMs">, nowMs: number) =>
  Math.max(30, originMs + s.atMs + s.noteMs - 20 - nowMs);

// The step at which each feature counts as built: its last feat merge (its done note lands with it). A feature the
// board says is done without a feat merge in the data counts at the last step, so the end matches the board.
export function doneAt(board: Board, ss: Step[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of board.features) {
    if (f.state !== "done") continue;
    let k = -1;
    ss.forEach((s, i) => s.feat === f.slug && (k = i));
    out.set(f.slug, k >= 0 ? k : ss.length - 1);
  }
  return out;
}

const NOT_NAMED = new Set(["planner", "unnamed"]);

export type Counters = { done: number; planned: number; merged: number; agents: number };

// The counters after step k (k = -1: before the first). The last step reads the board's own moment, so they match.
export function counters(board: Board, ss: Step[], done: Map<string, number>, k: number): Counters {
  const planned = board.features.filter((f) => f.milestone);
  const t = k === ss.length - 1 ? Date.parse(board.at) : k >= 0 ? Date.parse(ss[k].pr.mergedAt!) : -Infinity;
  const agents = new Set(
    (board.prs ?? [])
      .filter((p) => !NOT_NAMED.has(p.worker) && Date.parse(p.createdAt) <= t)
      .filter((p) => {
        const end = p.mergedAt ?? p.closedAt;
        return end === null || Date.parse(end) > t;
      })
      .map((p) => p.worker),
  );
  return {
    done: planned.filter((f) => (done.get(f.slug) ?? Infinity) <= k).length,
    planned: planned.length,
    merged: k + 1,
    agents: agents.size,
  };
}

// What the board says at its own moment, for comparing with the last step.
export function boardCounters(board: Board): Counters {
  return {
    done: board.books.milestones.reduce((n, m) => n + m.done, 0),
    planned: board.books.milestones.reduce((n, m) => n + m.planned, 0),
    merged: board.books.mergedByType?.reduce((n, [, c]) => n + c, 0) ?? 0,
    agents: (board.crew ?? []).filter((c) => !NOT_NAMED.has(c.worker)).length,
  };
}

export type Chapter = { step: number; text: string }; // shown as step `step` passes (-1: at the start)

export function chapters(board: Board, ss: Step[], done: Map<string, number>, peak: Peak): Chapter[] {
  const out: Chapter[] = [];
  const first = (board.prs ?? []).reduce<BoardPr | null>((a, b) => (!a || b.createdAt < a.createdAt ? b : a), null);
  if (first) out.push({ step: -1, text: `The first PR: #${first.number} ${first.title}` });
  for (const m of board.books.milestones) {
    const live = board.features.filter((f) => f.milestone === m.name && f.state !== "cut");
    const at = live.map((f) => done.get(f.slug) ?? Infinity);
    if (live.length && at.every(Number.isFinite)) out.push({ step: Math.max(...at), text: `Milestone built: ${m.name}` });
  }
  if (peak.open > 0 && ss.length) {
    const k = ss.findIndex((s) => Date.parse(s.pr.mergedAt!) >= peak.at);
    out.push({ step: k < 0 ? ss.length - 1 : k, text: `Peak: ${peak.open} PRs open at once` });
  }
  return out.sort((a, b) => a.step - b.step);
}

// --- the crew timeline -----------------------------------------------------------------------------------------------

export type Kind = "feat" | "fix" | "plan" | "other";
export function kindOf(title: string): Kind {
  const t = titleType(title)?.type;
  if (t === "feat") return "feat";
  if (t === "fix" || t === "refactor" || t === "perf" || t === "test") return "fix";
  if (t === "plan" || t === "contract") return "plan";
  return "other";
}

export type Bar = { pr: BoardPr; start: number; end: number; how: "merged" | "closed" | "open"; lane: number; kind: Kind };
export type Row = { worker: string; lanes: number; bars: Bar[] };
export type Peak = { open: number; at: number };
export type Timeline = { rows: Row[]; start: number; end: number; open: { t: number; n: number }[]; peak: Peak };

export function timeline(prs: BoardPr[], now: number): Timeline {
  const bars = prs.map((pr) => {
    const end = pr.mergedAt ?? pr.closedAt;
    return {
      pr,
      start: Date.parse(pr.createdAt),
      end: end ? Date.parse(end) : now,
      how: pr.mergedAt ? "merged" : end ? "closed" : "open",
      lane: 0,
      kind: kindOf(pr.title),
    } as Bar;
  });
  const byWorker = new Map<string, Bar[]>();
  for (const b of [...bars].sort((a, b) => a.start - b.start || a.pr.number - b.pr.number))
    byWorker.set(b.pr.worker, [...(byWorker.get(b.pr.worker) ?? []), b]);
  const rows = [...byWorker].map(([worker, bs]) => {
    const laneEnds: number[] = []; // greedy: each bar takes the first sub-row that's free by its start
    for (const b of bs) {
      const lane = laneEnds.findIndex((e) => e <= b.start);
      b.lane = lane < 0 ? laneEnds.length : lane;
      laneEnds[b.lane] = b.end;
    }
    return { worker, lanes: laneEnds.length, bars: bs };
  }); // Map keeps insertion order: workers by their first PR
  // Open PRs at each change; a PR closing at the moment another opens doesn't count both.
  const events = bars.flatMap((b) => [{ t: b.start, d: 1 }, ...(b.how === "open" ? [] : [{ t: b.end, d: -1 }])]);
  events.sort((a, b) => a.t - b.t || a.d - b.d);
  const open: { t: number; n: number }[] = [];
  let n = 0;
  let peak: Peak = { open: 0, at: 0 };
  for (const e of events) {
    n += e.d;
    open.push({ t: e.t, n });
    if (n > peak.open) peak = { open: n, at: e.t };
  }
  return {
    rows,
    start: bars.length ? Math.min(...bars.map((b) => b.start)) : now,
    end: now,
    open,
    peak,
  };
}
