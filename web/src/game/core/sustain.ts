import type { Chart, NoteJudgment, SustainSummary, TakeEvent } from "../../contracts";
import { msPerBeat } from "./settings";

export const sustainSettings = { minDurationBeats: 1.5, pointsPerTarget: 100 };

// New live play opts in; a historical MIDI file without a policy marker is
// deliberately legacy. Serialized Takes default independently to version 1.
export const scoringVersion = (params: URLSearchParams): 1 | 2 | 3 => {
  const policy = params.get("scoring");
  if (policy === "1" || policy === "2" || policy === "3") return Number(policy) as 1 | 2 | 3;
  return params.get("bot") === "take" ? 1 : 3;
};

export function evaluateSustain(chart: Chart, judgments: readonly NoteJudgment[], events: ReadonlyMap<number, TakeEvent>, nowMs: number, final = false): SustainSummary {
  const judged = new Map(judgments.map(j => [j.noteId, j]));
  const beatMs = msPerBeat(chart.bpm);
  const notes = chart.notes.filter(n => n.duration >= sustainSettings.minDurationBeats).map(n => {
    const start = n.beat * beatMs;
    const end = start + n.duration * beatMs;
    const j = judged.get(n.id);
    const e = j && j.judgment !== "MISS" && j.eventIndex !== null ? events.get(j.eventIndex) : undefined;
    // A missing release in a stored take is unknown, not proof of a hold.
    const off = e?.offTimeMs ?? (final ? e?.timeMs ?? start : nowMs);
    const targetMs = Math.max(1, Math.round(end - start));
    const covered = e ? Math.max(0, Math.min(end, off, nowMs) - Math.max(start, e.timeMs)) : 0;
    const heldMs = Math.min(targetMs, Math.round(covered));
    const possiblePoints = sustainSettings.pointsPerTarget;
    const earnedPoints = Math.min(possiblePoints, Math.floor(possiblePoints * covered / (end - start) + 1e-9));
    return { noteId: n.id, heldMs, targetMs, earnedPoints, possiblePoints, releasedEarly: !!e && e.offTimeMs !== null && e.offTimeMs < end - 1e-6 };
  });
  return { version: 2, notes, earnedPoints: notes.reduce((s, n) => s + n.earnedPoints, 0), possiblePoints: notes.reduce((s, n) => s + n.possiblePoints, 0) };
}

export function onsetLabel(grade: string, offsetMs: number | null): string {
  if (offsetMs === null) return grade;
  const ms = Math.round(offsetMs);
  return `${grade} · ${ms < 0 ? "EARLY" : ms > 0 ? "LATE" : "ON TIME"}`;
}
