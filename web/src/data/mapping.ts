// Take + Results -> database rows. Pure: the server route and the local fallback both use it.
import type { Chart, Judgment, Results, Take } from "../contracts";
import { CONTRACT_VERSION, JUDGE_VERSION, SUSTAIN_VERSION } from "./config";

export interface TakeRow {
  id: string;
  player_id: string;
  song_id: string;
  chart_sha256: string;
  judge_version: number;
  contract_version: number;
  started_at: string;
  input_device: "midi" | "keys";
  latency_offset_ms: number;
  bar_from: number | null;
  bar_to: number | null;
  tempo_pct: number;
  perfect: number;
  great: number;
  good: number;
  miss: number;
  extras: number;
  wrong: number;
  accuracy: number;
  max_combo: number;
  rank: Results["rank"];
  take: Take;
  results: Results;
  created_at?: string;
}

export interface NoteRow {
  take_id: string;
  note_id: string;
  pitch: number;
  hand: "R" | "L";
  bar: number;
  beat: number;
  judgment: Judgment; // follows the contract: a judgment added there needs no change here
  offset_ms: number | null;
  velocity: number | null;
}

export interface SongRow {
  id: string;
  title: string;
  composer: string;
  bpm: number;
  beats_per_bar: number;
  note_count: number;
  chart_sha256: string;
}

/** Bars are 1-based: beat 0 is the first beat of bar 1. */
export const barOf = (beat: number, beatsPerBar: number) => Math.floor(beat / beatsPerBar) + 1;

export function songRow(chart: Chart, chartSha256: string): SongRow {
  return {
    id: chart.id,
    title: chart.title,
    composer: chart.composer,
    bpm: chart.bpm,
    beats_per_bar: chart.beatsPerBar,
    note_count: chart.notes.length,
    chart_sha256: chartSha256,
  };
}

export function takeRows(
  ids: { takeId: string; playerId: string; chartSha256: string },
  chart: Chart,
  take: Take,
  results: Results,
): { take: TakeRow; notes: NoteRow[] } {
  if (take.inputDevice === "test") throw new Error("test takes are never stored");
  if ((take.scoringVersion === 2) !== (results.sustain?.version === 2)) throw new Error("take/results scoring policy mismatch");
  const byId = new Map(chart.notes.map((n) => [n.id, n]));
  const notes = results.judgments.map((j): NoteRow => {
    const n = byId.get(j.noteId);
    if (!n) throw new Error(`judgment for unknown note ${j.noteId}`);
    const ev = j.eventIndex === null ? null : take.events[j.eventIndex];
    return {
      take_id: ids.takeId,
      note_id: n.id,
      pitch: n.pitch,
      hand: n.hand,
      bar: barOf(n.beat, chart.beatsPerBar),
      beat: n.beat,
      judgment: j.judgment,
      offset_ms: j.offsetMs,
      velocity: ev ? ev.velocity : null,
    };
  });
  return {
    take: {
      id: ids.takeId,
      player_id: ids.playerId,
      song_id: chart.id,
      chart_sha256: ids.chartSha256,
      judge_version: take.scoringVersion === 2 ? SUSTAIN_VERSION : JUDGE_VERSION,
      contract_version: take.scoringVersion === 2 ? SUSTAIN_VERSION : CONTRACT_VERSION,
      started_at: take.startedAt,
      input_device: take.inputDevice,
      latency_offset_ms: Math.round(take.latencyOffsetMs),
      bar_from: null,
      bar_to: null,
      tempo_pct: 100,
      perfect: results.counts.PERFECT,
      great: results.counts.GREAT,
      good: results.counts.GOOD ?? 0,
      miss: results.counts.MISS,
      extras: results.counts.extra,
      wrong: results.counts.wrong ?? 0,
      accuracy: Math.round(results.accuracy * 10000) / 10000,
      max_combo: results.maxCombo,
      rank: results.rank,
      take,
      results,
    },
    notes,
  };
}
