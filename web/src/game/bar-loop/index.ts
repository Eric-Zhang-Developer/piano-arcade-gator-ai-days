import type { Chart, GamePlugin } from "../../contracts";
import { GOOD_WEIGHT, msPerBeat } from "../core/settings";
import { isWaitMode } from "../wait-mode";

export const barLoopSettings = {
  defaultPasses: 4, // /play can't be stopped mid-song yet, so a loop is a set number of passes (decision bar-loop-passes)
  maxPasses: 20,
  tempoMin: 25,
  tempoMax: 150,
};

export interface LoopPlan {
  from: number; // 1-based, inclusive
  to: number;
  tempo: number; // percent of the chart's bpm
  passes: number;
  passBeats: number; // one pass plus its one-bar count-in gap
  whole: boolean; // tempo alone: the whole song once at that tempo (song-options' Speed), not a practice loop
  notesPerPass: number;
}

const int = (v: string | null) => (v !== null && /^\d+$/.test(v) ? Number(v) : NaN);

// Pure: bars from..to of the chart, re-timed to tempo%, repeated `passes` times with an empty bar before each repeat.
// Returns null when the URL asks for no loop; throws (shown by /play as its error) for a bad request. tempo with no
// from or to is the whole song, once, at that tempo.
export function loopChart(chart: Chart, params: URLSearchParams): { chart: Chart; plan: LoopPlan } | null {
  const whole = !params.has("from") && !params.has("to");
  if (whole && !params.has("tempo")) return null;
  const s = barLoopSettings;
  const bpb = chart.beatsPerBar;
  const bars = Math.ceil(Math.max(...chart.notes.map((n) => n.beat + n.duration)) / bpb);
  const from = whole ? 1 : int(params.get("from"));
  const to = whole ? bars : int(params.get("to"));
  const tempo = params.has("tempo") ? int(params.get("tempo")) : 100;
  const passes = params.has("passes") ? int(params.get("passes")) : whole ? 1 : s.defaultPasses;
  if (!(from >= 1 && to >= from && to <= bars))
    throw new Error(`Bar loop: bars ${params.get("from")}–${params.get("to")} aren't in this chart (bars 1–${bars})`);
  if (!(tempo >= s.tempoMin && tempo <= s.tempoMax)) throw new Error(`Bar loop: tempo must be ${s.tempoMin}–${s.tempoMax}%`);
  if (!(passes >= 1 && passes <= s.maxPasses)) throw new Error(`Bar loop: passes must be 1–${s.maxPasses}`);

  const start = (from - 1) * bpb;
  const end = to * bpb;
  const inRange = chart.notes.filter((n) => n.beat >= start && n.beat < end);
  if (!inRange.length) throw new Error(`Bar loop: bars ${from}–${to} have no notes`);
  const passBeats = end - start + bpb;
  const notes = Array.from({ length: passes }, (_, k) =>
    inRange.map((n) => ({
      ...n,
      id: `p${k + 1}-${n.id}`,
      beat: k * passBeats + (n.beat - start),
      duration: Math.min(n.duration, end - n.beat), // a note held past the last bar stops at it
    })),
  ).flat();
  const title = whole ? `${chart.title} · ${tempo}%` : `${chart.title} · bars ${from}–${to} at ${tempo}%`;
  return {
    chart: { ...chart, title, bpm: (chart.bpm * tempo) / 100, notes },
    plan: { from, to, tempo, passes, passBeats, notesPerPass: inRange.length, whole },
  };
}

interface Pass {
  PERFECT: number;
  GREAT: number;
  GOOD: number;
  MISS: number;
  wrong: number;
}

// Same formula as the judge's accuracy, per pass.
export const passAccuracy = (p: Pass, notes: number) => (p.PERFECT + 0.5 * p.GREAT + GOOD_WEIGHT * p.GOOD) / (notes + p.wrong);

// Practice bars X to Y at a slower tempo: /play?song=<id>&from=<bar>&to=<bar>&tempo=<percent>[&passes=<n>].
// Each pass is scored on its own, and the list shows next to the results so improvement is visible.
export function barLoop(): GamePlugin & { passes(): number[] } {
  let plan: LoopPlan | null = null;
  let bpm = 0;
  let tally: Pass[] = [];
  let wait = false; // wait mode isn't scored: no Passes list (every learn step would read 100.0%)
  const passOf = (noteId: string) => Number(/^p(\d+)-/.exec(noteId)?.[1] ?? 0) - 1;
  const accuracies = () => (plan ? tally.map((p) => passAccuracy(p, plan!.notesPerPass)) : []);

  return {
    id: "bar-loop",
    passes: accuracies,
    transformChart(c, params) {
      wait = isWaitMode(params);
      const r = loopChart(c, params);
      plan = r?.plan ?? null;
      bpm = r?.chart.bpm ?? c.bpm;
      return r?.chart ?? c;
    },
    onEvent(e) {
      if (!plan) return;
      if (e.type === "songStart") {
        tally = Array.from({ length: plan.passes }, () => ({ PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, wrong: 0 }));
        showPasses(null);
      }
      if (e.type === "noteHit") tally[passOf(e.noteId)][e.judgment]++;
      if (e.type === "noteMiss") tally[passOf(e.noteId)].MISS++;
      if (e.type === "wrongNote") {
        const k = Math.floor(e.atMs / (plan.passBeats * msPerBeat(bpm)));
        if (tally[k]) tally[k].wrong++;
      }
      if (e.type === "songEnd" && !wait && !(plan.whole && plan.passes === 1)) showPasses(accuracies()); // one pass: the results say it
    },
  };
}

// The results screen is core-loop's, so the pass list is its own small panel beside it.
function showPasses(list: number[] | null) {
  if (typeof document === "undefined") return;
  document.querySelector('[data-testid="bar-loop-passes"]')?.remove();
  if (!list) return;
  const el = document.createElement("ol");
  el.setAttribute("data-testid", "bar-loop-passes");
  Object.assign(el.style, {
    position: "fixed",
    top: "72px",
    right: "16px",
    margin: "0",
    padding: "12px 16px 12px 40px",
    background: "rgba(0, 0, 0, 0.8)",
    border: "1px solid #333",
    borderRadius: "8px",
    font: "16px system-ui, sans-serif",
    color: "#eee",
    zIndex: "900",
    fontVariantNumeric: "tabular-nums",
  });
  el.innerHTML = `<div style="margin-left:-24px;margin-bottom:6px;opacity:.7">Passes</div>`;
  for (const a of list) {
    const li = document.createElement("li");
    li.textContent = `${(a * 100).toFixed(1)}%`;
    el.appendChild(li);
  }
  document.body.appendChild(el);
}
