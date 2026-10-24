// The profile's numbers: per song, per day, streaks, judgment mix and hands. Real counts only, nothing invented.
import { describe, expect, it } from "vitest";
import { handSummary, judgmentMix, practiceDays, songStats, streak, type HandStatRow, type SessionRow } from "./progress";

const s = (song: string, at: string, accuracy: number, rank: string, durationMs = 60000, combo = 5): SessionRow => ({
  take_id: `${song}-${at}`, song_id: song, title: song.toUpperCase(), composer: "-", created_at: at, duration_ms: durationMs,
  accuracy, rank, perfect: 0, great: 0, good: 0, miss: 0, wrong: 0, max_combo: combo, input_device: "keys",
});
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

describe("songStats", () => {
  it("per song: sessions, time, best, latest, change since the first, best rank, newest song first", () => {
    const rows = [
      s("twinkle", local(2026, 10, 20), 0.4, "C", 30000, 4),
      s("twinkle", local(2026, 10, 22), 0.7, "B", 30000, 9),
      s("minuet", local(2026, 10, 24), 0.1, "D", 60000, 2),
    ];
    const [minuet, twinkle] = songStats(rows);
    expect(minuet).toMatchObject({ song_id: "minuet", sessions: 1, change: null, bestRank: "D" });
    expect(twinkle).toMatchObject({ sessions: 2, totalMs: 60000, bestAccuracy: 0.7, latestAccuracy: 0.7, bestRank: "B", bestCombo: 9 });
    expect(twinkle.change).toBeCloseTo(0.3);
  });
});

describe("practiceDays and streak", () => {
  const today = new Date(2026, 9, 24, 15);
  const rows = [s("a", local(2026, 10, 24), 0.5, "C", 90000), s("a", local(2026, 10, 24, 9), 0.5, "C", 30000), s("a", local(2026, 10, 23), 0.5, "C"), s("a", local(2026, 10, 21), 0.5, "C")];

  it("minutes per local day, oldest first, ending today", () => {
    const days = practiceDays(rows, today, 5);
    expect(days.map((d) => [d.day, d.minutes, d.sessions])).toEqual([
      ["2026-10-20", 0, 0], ["2026-10-21", 1, 1], ["2026-10-22", 0, 0], ["2026-10-23", 1, 1], ["2026-10-24", 2, 2],
    ]);
  });

  it("counts days in a row back from today, or from yesterday before today's first session", () => {
    expect(streak(rows, today)).toBe(2); // the 23rd and 24th; the 22nd breaks it
    expect(streak(rows.slice(2), today)).toBe(1); // nothing today yet: yesterday still counts
    expect(streak([], today)).toBe(0);
  });
});

describe("judgmentMix and handSummary", () => {
  const hand = (h: "L" | "R", p: number, g: number, gd: number, m: number, off: number | null, spread: number | null): HandStatRow => ({
    song_id: "x", hand: h, notes: p + g + gd + m, perfect: p, great: g, good: gd, miss: m, mean_offset_ms: off, spread_ms: spread, mean_velocity: null,
  });

  it("sums every judged note; the hit rate counts everything but misses", () => {
    expect(judgmentMix([hand("R", 6, 2, 1, 1, 0, 0), hand("L", 0, 0, 0, 10, null, null)])).toEqual({ perfect: 6, great: 2, good: 1, miss: 11, notes: 20, hitRate: 0.45 });
    expect(judgmentMix([]).hitRate).toBeNull();
  });

  it("per hand, timing weighted by each song's hits; a hand with no hits has no timing", () => {
    const rows = [hand("R", 8, 0, 0, 2, -20, 10), { ...hand("R", 2, 0, 0, 0, 10, 30), song_id: "y" }, hand("L", 0, 0, 0, 5, null, null)];
    const [l, r] = handSummary(rows);
    expect(l).toEqual({ hand: "L", notes: 5, hitRate: 0, meanOffset: null, spread: null });
    expect(r).toEqual({ hand: "R", notes: 12, hitRate: 10 / 12, meanOffset: -14, spread: 14 });
  });
});
