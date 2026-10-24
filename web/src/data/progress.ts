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

/** One row of the hand_stats view: a player's notes for one song and hand. */
export interface HandStatRow {
  song_id: string;
  hand: "R" | "L";
  notes: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  mean_offset_ms: number | null;
  spread_ms: number | null;
  mean_velocity: number | null;
}

const n = (x: unknown) => Number(x ?? 0);
const judged = (r: { perfect: number; great: number; good: number; miss: number }) => n(r.perfect) + n(r.great) + n(r.good) + n(r.miss);

/** All of a player's judged notes, summed: the profile's judgment mix and overall note accuracy. */
export function judgmentMix(rows: { perfect: number; great: number; good: number; miss: number }[]) {
  const mix = { perfect: 0, great: 0, good: 0, miss: 0 };
  for (const r of rows) {
    mix.perfect += n(r.perfect);
    mix.great += n(r.great);
    mix.good += n(r.good);
    mix.miss += n(r.miss);
  }
  const notes = judged(mix);
  return { ...mix, notes, hitRate: notes ? (notes - mix.miss) / notes : null };
}

/** Per hand across songs: notes, hit rate, and timing (mean and spread weighted by each song's timed notes). */
export function handSummary(rows: HandStatRow[]) {
  return (["L", "R"] as const).map((hand) => {
    const mine = rows.filter((r) => r.hand === hand);
    const mix = judgmentMix(mine);
    const timed = mine.map((r) => ({ hits: judged(r) - n(r.miss), off: r.mean_offset_ms, spread: r.spread_ms })).filter((r) => r.hits > 0 && r.off !== null);
    const w = timed.reduce((a, r) => a + r.hits, 0);
    const meanOffset = w ? Math.round((timed.reduce((a, r) => a + r.hits * n(r.off), 0) / w) * 10) / 10 : null;
    const spread = w ? Math.round((timed.reduce((a, r) => a + r.hits * n(r.spread), 0) / w) * 10) / 10 : null;
    return { hand, notes: mix.notes, hitRate: mix.hitRate, meanOffset, spread };
  });
}

/** Per song: sessions, time, best and latest accuracy, best rank, last played; most recently played first. */
export function songStats(rows: SessionRow[]) {
  const by = new Map<string, SessionRow[]>();
  for (const r of rows) by.set(r.song_id, [...(by.get(r.song_id) ?? []), r]);
  return [...by.values()]
    .map((rs) => {
      const time = [...rs].sort((a, b) => a.created_at.localeCompare(b.created_at)); // oldest first
      const acc = time.map((r) => Number(r.accuracy));
      return {
        song_id: time[0].song_id,
        title: time[0].title,
        composer: time[0].composer,
        sessions: rs.length,
        totalMs: rs.reduce((a, r) => a + r.duration_ms, 0),
        bestAccuracy: Math.max(...acc),
        latestAccuracy: acc[acc.length - 1],
        change: acc.length > 1 ? acc[acc.length - 1] - acc[0] : null, // latest minus first
        bestRank: RANKS.find((k) => rs.some((r) => r.rank === k)) ?? time[0].rank,
        bestCombo: Math.max(...rs.map((r) => r.max_combo)),
        lastPlayed: time[time.length - 1].created_at,
      };
    })
    .sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed));
}

/** A local calendar day, YYYY-MM-DD, in the player's own time zone. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Minutes played per local day for the last `days` days ending today, oldest first (days with none are 0). */
export function practiceDays(rows: SessionRow[], today: Date, days = 84) {
  const ms = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(new Date(r.created_at));
    ms.set(k, (ms.get(k) ?? 0) + r.duration_ms);
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    const k = dayKey(d);
    return { day: k, date: d, minutes: Math.round(((ms.get(k) ?? 0) / 60000) * 10) / 10, sessions: rows.filter((r) => dayKey(new Date(r.created_at)) === k).length };
  });
}

/** Days in a row with at least one session, counting back from today (or yesterday, if today has none yet). */
export function streak(rows: SessionRow[], today: Date): number {
  const played = new Set(rows.map((r) => dayKey(new Date(r.created_at))));
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!played.has(dayKey(day))) day.setDate(day.getDate() - 1);
  let count = 0;
  while (played.has(dayKey(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}
