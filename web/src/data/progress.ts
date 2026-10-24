// The two views the coach and /progress read. In Supabase they are SQL views (bar_trends, take_history);
// these pure functions compute the same rows locally for the offline fallback and the tests.
import type { NoteRow, TakeRow } from "./mapping";

export interface TakeHistoryRow {
  take_id: string;
  created_at: string;
  accuracy: number;
  rank: string;
  miss: number;
  mean_abs_offset_ms: number | null;
  spread_ms: number | null;
}

export interface BarTrendRow {
  bar: number;
  notes: number;
  misses: number;
  mean_offset_ms: number | null; // + late, - early
  spread_ms: number | null;
  mean_velocity: number | null;
}

export interface Progress {
  history: TakeHistoryRow[]; // oldest first
  bars: BarTrendRow[]; // by bar
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function stddevSamp(xs: number[]): number | null {
  if (xs.length < 2) return null;
  const m = mean(xs)!;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
const r1 = (x: number | null) => (x === null ? null : round1(x));

export function takeHistory(takes: { take: TakeRow; notes: NoteRow[] }[]): TakeHistoryRow[] {
  return takes
    .map(({ take, notes }) => {
      const offs = notes.flatMap((n) => (n.offset_ms === null ? [] : [n.offset_ms]));
      return {
        take_id: take.id,
        created_at: take.created_at ?? take.started_at,
        accuracy: take.accuracy,
        rank: take.rank,
        miss: take.miss,
        mean_abs_offset_ms: r1(mean(offs.map(Math.abs))),
        spread_ms: r1(stddevSamp(offs)),
      };
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Per bar over the newest `last` takes, like the bar_trends view. */
export function barTrends(takes: { take: TakeRow; notes: NoteRow[] }[], last = 5): BarTrendRow[] {
  const recent = [...takes]
    .sort((a, b) => (b.take.created_at ?? b.take.started_at).localeCompare(a.take.created_at ?? a.take.started_at))
    .slice(0, last);
  const byBar = new Map<number, NoteRow[]>();
  for (const t of recent) for (const n of t.notes) byBar.set(n.bar, [...(byBar.get(n.bar) ?? []), n]);
  return [...byBar.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bar, ns]) => {
      const offs = ns.flatMap((n) => (n.offset_ms === null ? [] : [n.offset_ms]));
      const vels = ns.flatMap((n) => (n.velocity === null ? [] : [n.velocity]));
      const v = mean(vels);
      return {
        bar,
        notes: ns.length,
        misses: ns.filter((n) => n.judgment === "MISS").length,
        mean_offset_ms: r1(mean(offs)),
        spread_ms: r1(stddevSamp(offs)),
        mean_velocity: v === null ? null : Math.round(v),
      };
    });
}

/** The bars to practice: most misses, then the widest timing spread. Real rows only; empty when there are none. */
export function weakestBars(bars: BarTrendRow[], n = 3): BarTrendRow[] {
  return [...bars]
    .filter((b) => b.misses > 0 || (b.spread_ms ?? 0) > 0)
    .sort((a, b) => b.misses - a.misses || (b.spread_ms ?? 0) - (a.spread_ms ?? 0))
    .slice(0, n);
}

/** One row of the session_history view: a take, when it was played, for how long, and how it went. */
export interface SessionRow {
  take_id: string;
  song_id: string;
  title: string;
  composer: string;
  created_at: string;
  duration_ms: number;
  accuracy: number;
  rank: string;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  wrong: number;
  max_combo: number;
  input_device: string;
}

/** The same rows, computed locally from takes (offline, or a guest without the server). Newest first. */
export function sessionsFrom(takes: { take: TakeRow; title: string; composer: string }[]): SessionRow[] {
  return takes
    .map(({ take, title, composer }) => ({
      take_id: take.id,
      song_id: take.song_id,
      title,
      composer,
      created_at: take.created_at ?? take.started_at,
      duration_ms: Math.max(0, Math.round(Math.max(0, ...take.take.events.map((e) => Math.max(e.timeMs, e.offTimeMs ?? 0))))),
      accuracy: take.accuracy,
      rank: take.rank,
      perfect: take.perfect,
      great: take.great,
      good: take.good,
      miss: take.miss,
      wrong: take.wrong,
      max_combo: take.max_combo,
      input_device: take.input_device,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const RANKS = ["S", "A", "B", "C", "D"];

/** Totals for the top of the profile: how many sessions, how long in all, how many songs, the best rank. */
export function sessionSummary(rows: SessionRow[]) {
  return {
    sessions: rows.length,
    totalMs: rows.reduce((a, r) => a + r.duration_ms, 0),
    songs: new Set(rows.map((r) => r.song_id)).size,
    bestRank: rows.length ? RANKS.find((k) => rows.some((r) => r.rank === k)) ?? rows[0].rank : null,
  };
}

/** 61500 -> "1:02"; 3723000 -> "1:02:03". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
