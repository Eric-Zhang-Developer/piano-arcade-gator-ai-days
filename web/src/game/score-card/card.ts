// The score card (spec: score-card): a take as one 1920×1080 image. cardModel is pure (every string and color the
// card shows); drawCard paints a model on a 2D canvas and draws each string once.
import type { Chart, Rank, Results } from "../../contracts";
import { APP_NAME } from "../app-name";
import { countRows } from "../results-layout";
import { jacketFor, type Jacket } from "../song-jacket";
import { bg, cyan, gold, good, ink, inkDim, miss, primary, wrong } from "../ui-tokens";

export const CARD_W = 1920;
export const CARD_H = 1080;

export interface CardModel {
  title: string; // the song's own, not a bar loop's suffixed one
  composer: string;
  practice: string | null; // "Bars 5–8 at 70%", "Right hand": a take that isn't the plain song
  rank: Rank;
  score: string;
  accuracy: string;
  maxCombo: string;
  counts: { label: string; value: string; color: string }[]; // results-layout's six, in its order and colors
  date: string; // YYYY-MM-DD, the player's time zone
  jacket: Jacket;
  file: string;
}

// countRows' tones are CSS variables; a canvas needs the colors themselves.
const TONES: Record<string, string> = {
  "var(--pa-gold)": gold,
  "var(--pa-good)": good,
  "var(--pa-miss)": miss,
  "var(--pa-wrong)": wrong,
  "var(--pa-ink-dim)": inkDim,
};

const LOOP_SUFFIX = / · (bars \d+–\d+ at )?\d+%$/; // bar-loop's title suffixes: " · bars 5–8 at 70%", " · 80%"

/**
 * What the take was, when it wasn't the plain song: a bar loop or a slower whole song, one hand, versus. Null for the
 * whole song at 100%. Only what /play applied: a one-hand chart ignores `hands`.
 */
export function practiceLine(params: URLSearchParams, chart?: Chart): string | null {
  const parts: string[] = [];
  const tempo = params.get("tempo") ?? "100";
  if (params.has("from") || params.has("to")) parts.push(`Bars ${params.get("from")}–${params.get("to")} at ${tempo}%`);
  else if (params.has("tempo")) parts.push(`Whole song at ${tempo}%`); // tempo alone: the whole song once (#547)
  const hands = params.get("hands");
  const twoHands = !chart || (chart.notes.some((n) => n.hand === "L") && chart.notes.some((n) => n.hand === "R"));
  if ((hands === "R" || hands === "L") && twoHands) parts.push(hands === "R" ? "Right hand" : "Left hand");
  if (params.get("versus") === "1") parts.push("Versus");
  return parts.length ? parts.join(" · ") : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const cardDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function cardModel(chart: Chart, results: Results, score: number, date: Date, params = new URLSearchParams()): CardModel {
  const title = chart.title.replace(LOOP_SUFFIX, "");
  const day = cardDate(date);
  return {
    title,
    composer: chart.composer,
    practice: practiceLine(params, chart),
    rank: results.rank,
    score: score.toLocaleString("en-US"),
    accuracy: `${(results.accuracy * 100).toFixed(1)}%`,
    maxCombo: String(results.maxCombo),
    counts: countRows(results).map((r) => ({ label: r.label.toUpperCase(), value: String(r.value), color: TONES[r.tone] ?? r.tone })),
    date: day,
    jacket: jacketFor(chart.id, title, chart.composer),
    file: `piano-arcade-${chart.id.replaceAll("/", "-")}-${day}-${results.rank}.png`,
  };
}

// The labels the card draws besides the model's strings.
export const CARD_LABELS = ["SCORE", "ACCURACY", "MAX COMBO", APP_NAME];

type Ctx = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "save"
  | "restore"
  | "beginPath"
  | "rect"
  | "clip"
  | "createLinearGradient"
>;

/**
 * The card, on a 1920×1080 context. `display` is the display face's CSS family (Saira), with fallbacks: numbers and
 * titles use it, upright as on the results screen (no italic in the Duo look). `data` is the kit's mono data face, for
 * the labels, as the results screen sets them. Nothing is under 24 px. Hype pink stays off: a saved card is a record of the take, not one of its moments.
 */
export function drawCard(ctx: Ctx, m: CardModel, display = "system-ui, sans-serif", data = "ui-monospace, monospace"): void {
  const face = (weight: number, px: number) => `${weight} ${px}px ${display}`;
  const label = (px: number) => `500 ${px}px ${data}`;
  const text = (s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  // Shrinks a line's font until it fits `max` px wide (long titles).
  const fit = (s: string, weight: number, px: number, max: number) => {
    let size = px;
    ctx.font = face(weight, size);
    while (size > 24 && ctx.measureText(s).width > max) ctx.font = face(weight, (size -= 2));
    return face(weight, size);
  };

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = "alphabetic";

  // The jacket: SongJacket's gradient, its word set large and pushed past the bottom-left edge so the square crops it
  // (song-jacket.module.css: 56% of the side, 4% left and 10% below, line-height 1).
  const J = { x: 120, y: 150, s: 780 };
  const rad = ((m.jacket.angle - 90) * Math.PI) / 180; // CSS 0deg points up; canvas 0 points right
  const cx = J.x + J.s / 2;
  const cy = J.y + J.s / 2;
  const half = (J.s / 2) * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)));
  const grad = ctx.createLinearGradient(cx - Math.cos(rad) * half, cy - Math.sin(rad) * half, cx + Math.cos(rad) * half, cy + Math.sin(rad) * half);
  m.jacket.stops.forEach((c, i, all) => grad.addColorStop(all.length > 1 ? i / (all.length - 1) : 0, c));
  ctx.save();
  ctx.beginPath();
  ctx.rect(J.x, J.y, J.s, J.s);
  ctx.clip();
  ctx.fillStyle = grad;
  ctx.fillRect(J.x, J.y, J.s, J.s);
  // The CSS line box ends 10% below the square; its baseline sits about a fifth of the font size above that.
  text(m.jacket.word, J.x - J.s * 0.04, J.y + J.s * (1.1 - 0.56 * 0.2), face(900, Math.round(J.s * 0.56)), m.jacket.text);
  ctx.restore();

  // The right column, on the jacket's top and bottom edges: the song, then the rank with its numbers beside it, then
  // the six counts on one row ending where the jacket does.
  const R = { x: 1000, w: 800 };
  text(m.title, R.x, J.y + 55, fit(m.title, 800, 76, R.w), ink); // cap height ~0.72 em: its top on the jacket's
  text(m.composer, R.x, J.y + 108, `400 32px system-ui, sans-serif`, inkDim);
  ctx.fillStyle = primary;
  ctx.fillRect(R.x, J.y + 138, 120, 6);
  if (m.practice) text(m.practice, R.x, J.y + 196, face(800, 34), cyan);

  const RANK_BASE = 720;
  text(m.rank, R.x, RANK_BASE, face(900, 420), gold);
  const stats: [string, string][] = [
    ["SCORE", m.score],
    ["ACCURACY", m.accuracy],
    ["MAX COMBO", m.maxCombo],
  ];
  stats.forEach(([name, value], i) => {
    const y = RANK_BASE - (2 - i) * 112; // the last value's baseline on the rank's
    text(name, R.x + 410, y - 60, label(24), inkDim);
    text(value, R.x + 410, y, face(800, 60), ink);
  });

  const COUNT_W = R.w / m.counts.length;
  m.counts.forEach((c, i) => {
    const x = R.x + i * COUNT_W;
    text(c.label, x, J.y + J.s - 62, label(24), c.color);
    text(c.value, x, J.y + J.s, face(800, 48), ink);
  });

  // The bottom line: the date under the jacket, the name in the far corner.
  text(m.date, J.x, J.y + J.s + 70, face(700, 32), inkDim);
  text(APP_NAME, R.x + R.w, J.y + J.s + 70, face(800, 32), ink, "right");
}
