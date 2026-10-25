// A take's review for the sheet window: the chart as played and each note's judgment, stored for /sheet?review=1 to
// read. Stored, not sent: a BroadcastChannel message is lost when no sheet window is open yet, and the button opens it.
import { validateChart, type Chart, type Judgment, type Results, type Take } from "../../contracts";

export const REVIEW_KEY = "pianoArcade.sheetReview";

export interface SheetReview {
  chart: Chart; // after every transformChart: the notes the judge had
  judgments: Record<string, Judgment>; // noteId -> judgment
  startedAt: string; // the take's, ISO
  accuracy: number; // 0–1, the results'
}

const JUDGMENTS = new Set<unknown>(["PERFECT", "GREAT", "GOOD", "MISS"]);

export function reviewOf(chart: Chart, take: Take, results: Results): SheetReview {
  const judgments = Object.fromEntries(results.judgments.map((j) => [j.noteId, j.judgment]));
  return { chart, judgments, startedAt: take.startedAt, accuracy: results.accuracy };
}

export function saveReview(review: SheetReview): void {
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(review));
  } catch {
    // storage blocked or full: the sheet shows "No take to review"
  }
}

/** The stored review, or null when there's none, it's corrupt, or storage throws. */
export function loadReview(): SheetReview | null {
  try {
    const r = JSON.parse(localStorage.getItem(REVIEW_KEY) ?? "null");
    if (!r || typeof r !== "object" || validateChart(r.chart).length) return null;
    if (!r.judgments || typeof r.judgments !== "object" || !Object.values(r.judgments).every((j) => JUDGMENTS.has(j))) return null;
    if (typeof r.startedAt !== "string" || Number.isNaN(Date.parse(r.startedAt))) return null;
    if (typeof r.accuracy !== "number" || !(r.accuracy >= 0 && r.accuracy <= 1)) return null;
    return r as SheetReview;
  } catch {
    return null;
  }
}

/** The sheet header's note: "Review · take at 14:02 · 92.4%", in local time. */
export function reviewLine(review: Pick<SheetReview, "startedAt" | "accuracy">): string {
  const at = new Date(review.startedAt);
  const hhmm = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  return `Review · take at ${hhmm} · ${(review.accuracy * 100).toFixed(1)}%`;
}
