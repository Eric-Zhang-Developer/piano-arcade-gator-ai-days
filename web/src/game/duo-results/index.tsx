// The Duo results' panels (spec: duo-results): BY BAR and TIMING, then the tutor with one PRACTICE BARS X–Y. Two
// plugins, so the results layout can put the strip and histogram in its middle band and the tutor beside its buttons.
// Every number comes from the take (scores.ts); every frame, label and button is the Duo kit's.
import { useEffect, type CSSProperties, type ReactNode } from "react";
import type { Chart, GamePlugin, Results, ResultsPanelContext, Take } from "../../contracts";
import { Brackets, Button, MonoLabel, Panel } from "../duo-tokens";
import { isWaitMode } from "../wait-mode";
import { playMode } from "../play-modes/modes";
import {
  barCount,
  barScores,
  driftingHand,
  duoResultsSettings,
  handDrift,
  histogram,
  practiceBarsUrl,
  rangeScore,
  saveNextFor,
  timingCaption,
  tutorLine,
  weakestRun,
} from "./scores";

export const duoPanelSettings = {
  maxCells: 64, // BY BAR's cells: past this many bars, a cell holds 2 (or more) so each stays ≥ 8 px at 1280 wide
  maxNumbered: 16, // up to this many cells, each shows its accuracy under it; past it, only its accessible label
  gator: "/learning/mentor-gator-avatar.png", // the learning lane's existing art
};

// The take's numbers for both panels. A loop or wait take has neither: bar-loop's and wait-mode's own panels cover it.
export function duoTake(chart: Chart, take: Take, results: Results, params: URLSearchParams) {
  if (params.has("from") || params.has("to") || isWaitMode(params)) return null;
  const per = Math.max(1, Math.ceil(barCount(chart) / duoPanelSettings.maxCells));
  const run = weakestRun(barScores(chart, take, results)); // always found bar by bar, then shown on the cells
  const drift = run ? handDrift(chart, results, run.from, run.to) : { L: null, R: null };
  const cell = run ? rangeScore(chart, take, results, run.from, run.to) : null;
  return {
    per,
    cells: barScores(chart, take, results, per),
    run,
    timing: histogram(results),
    lines: tutorLine({ run, accuracy: cell?.accuracy ?? null, drift, misses: cell?.misses, flow: playMode(params) === "flow" }),
    hand: driftingHand(drift)[0],
    href: run ? practiceBarsUrl(chart.id, params, run) : "/",
  };
}
type DuoTake = NonNullable<ReturnType<typeof duoTake>>;

// Labels scale with the window: 16 px at 1280 wide, 24 px at 1920 (visual-direction.md: read on video at ≥ 24 px).
const label = "clamp(13px, 1.25vw, 24px)";
const axis = label;
const pct = (a: number | null) => (a === null ? "no notes" : `${Math.round(a * 100)}%`);
const swatch = (color: string): CSSProperties => ({ display: "inline-block", width: "0.7em", height: "0.7em", background: color, marginRight: "0.4em" });
const span = (r: { from: number; to: number }) => (r.from === r.to ? `BAR ${r.from}` : `BARS ${r.from}–${r.to}`);
const head: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 };
const frame: CSSProperties = { boxSizing: "border-box", height: "100%", padding: "14px 18px 12px", textAlign: "left" };

// One cell per bar (or per `per` bars), filled to its accuracy: gold when clean, grey when weak, a bare hairline when
// the bar has no notes, with its percentage under it and a key for the colors. The weakest run is bracketed in primary
// with BARS X–Y over it.
export function ByBar({ cells, per, run }: Pick<DuoTake, "cells" | "per" | "run">) {
  const { cleanAccuracy } = duoResultsSettings;
  const numbered = cells.length <= duoPanelSettings.maxNumbered;
  const at = (bar: number) => Math.floor((bar - 1) / per) + 1; // the grid column of the cell holding a bar
  return (
    <Panel style={frame}>
      <div data-testid="duo-by-bar" style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
        <div style={head}>
          <MonoLabel style={{ fontSize: label }}>
            BY BAR{numbered ? ` · 1–${cells.at(-1)?.to} · %` : ""}
            {per > 1 ? ` · ${per} BARS A CELL` : ""}
          </MonoLabel>
          <MonoLabel style={{ fontSize: axis, whiteSpace: "nowrap" }}>
            <span style={swatch("var(--pa-gold)")} />≥ {Math.round(cleanAccuracy * 100)}%{"  "}
            <span style={{ ...swatch("var(--pa-miss)"), marginLeft: "1em" }} />WEAK
          </MonoLabel>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 56,
            display: "grid",
            gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
            gridTemplateRows: numbered ? `clamp(18px, 1.6vw, 32px) 1fr auto` : "clamp(18px, 1.6vw, 32px) 1fr",
            columnGap: 3,
          }}
        >
          {cells.map((c, i) => (
            <div
              key={c.from}
              data-testid="duo-bar"
              data-from={c.from}
              data-to={c.to}
              data-accuracy={c.accuracy ?? ""}
              role="img"
              aria-label={`${span(c)}: ${pct(c.accuracy)}`}
              title={`${span(c)}: ${pct(c.accuracy)}`}
              style={{ gridRow: 2, gridColumn: i + 1, position: "relative", boxShadow: "inset 0 0 0 1px var(--pa-line)" }}
            >
              {c.accuracy !== null && (
                <div
                  style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    height: `${Math.max(4, c.accuracy * 100)}%`,
                    background: c.accuracy >= cleanAccuracy ? "var(--pa-gold)" : "var(--pa-miss)",
                    opacity: c.accuracy >= cleanAccuracy ? 0.55 + 0.45 * c.accuracy : 0.8,
                  }}
                />
              )}
            </div>
          ))}
          {numbered &&
            cells.map((c, i) => (
              <span
                key={`n${c.from}`}
                data-testid="duo-bar-pct"
                aria-hidden
                style={{
                  gridRow: 3,
                  gridColumn: i + 1,
                  paddingTop: 4,
                  textAlign: "center",
                  fontFamily: "var(--pa-font-data), ui-monospace, monospace",
                  fontVariantNumeric: "tabular-nums",
                  fontSize: axis,
                  lineHeight: 1,
                  color: c.accuracy !== null && c.accuracy < cleanAccuracy ? "var(--pa-ink)" : "var(--pa-ink-dim)",
                }}
              >
                {c.accuracy === null ? "–" : Math.round(c.accuracy * 100)}
              </span>
            ))}
          {run && (
            <Brackets style={{ gridRow: 2, gridColumn: `${at(run.from)} / ${at(run.to) + 1}`, padding: 0, margin: -4 }}>
              <span
                data-testid="duo-run"
                data-from={run.from}
                data-to={run.to}
                style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6 }}
              >
                <MonoLabel dim={false} style={{ color: "var(--pa-primary)", fontSize: axis, whiteSpace: "nowrap" }}>
                  {span(run)}
                </MonoLabel>
              </span>
            </Brackets>
          )}
        </div>
        {!numbered && (
          <div style={head}>
            <MonoLabel style={{ fontSize: axis }}>BAR 1</MonoLabel>
            <MonoLabel style={{ fontSize: axis }}>BAR {cells.at(-1)?.to}</MonoLabel>
          </div>
        )}
      </div>
    </Panel>
  );
}

// Every hit's offset in 10 ms bins across the GOOD window (±rangeMs), a dashed zero line, and the mean as the caption.
export function Timing({ timing }: Pick<DuoTake, "timing">) {
  const { bins, meanMs } = timing;
  const top = Math.max(1, ...bins);
  const w = 100 / bins.length;
  return (
    <Panel style={frame}>
      <div data-testid="duo-timing" style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
        <MonoLabel style={{ fontSize: label }}>
          TIMING · <span data-testid="duo-timing-caption">{timingCaption(meanMs)}</span>
        </MonoLabel>
        <svg viewBox="0 0 100 50" preserveAspectRatio="none" style={{ flex: "1 1 0", minHeight: 56, height: 0, width: "100%" }} aria-hidden>
          <line x1="0" x2="100" y1="49.5" y2="49.5" stroke="var(--pa-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {bins.map((n, i) => (
            <rect key={i} data-testid="duo-bin" data-count={n} x={i * w + w * 0.15} width={w * 0.7} y={50 - (n / top) * 46} height={(n / top) * 46} fill="var(--pa-primary)" />
          ))}
          <line x1="50" x2="50" y1="0" y2="50" stroke="var(--pa-ink-dim)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        </svg>
        <div style={head}>
          <MonoLabel style={{ fontSize: axis }}>−{duoResultsSettings.rangeMs} MS EARLY</MonoLabel>
          <MonoLabel style={{ fontSize: axis }}>0</MonoLabel>
          <MonoLabel style={{ fontSize: axis }}>LATE +{duoResultsSettings.rangeMs} MS</MonoLabel>
        </div>
      </div>
    </Panel>
  );
}

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

// The gator, the template line, and one primary button: PRACTICE BARS X–Y on the weak run, else NEXT SONG. After a
// scored take it saves the run as "next for you" for the select (saveNextFor refuses bot, demo and practice takes).
export function Tutor({ d, chart, params }: { d: DuoTake; chart: Chart; params: URLSearchParams }) {
  const { run, lines, href, hand } = d;
  useEffect(() => {
    saveNextFor(storage(), params, run && { song: params.get("song") ?? chart.id, from: run.from, to: run.to, hand, mode: playMode(params) });
  }, [params, chart.id, run, hand]);
  return (
    <div data-testid="duo-tutor" style={{ display: "flex", alignItems: "center", gap: 20, textAlign: "left" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 240 px avatar from public/, nothing to optimize */}
      <img src={duoPanelSettings.gator} alt="The tutor, a gator" width={72} height={72} style={{ flexShrink: 0, width: "clamp(72px, 5.5vw, 120px)", height: "auto" }} />
      <div style={{ alignSelf: "stretch", width: 1, background: "var(--pa-secondary)" }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: "clamp(16px, 1.25vw, 28px)", lineHeight: 1.35, textWrap: "pretty" }}>
        <p data-testid="duo-tutor-line" style={{ margin: 0, color: "var(--pa-ink)" }}>
          {lines[0]}
        </p>
        {lines[1] && <p style={{ margin: 0, color: "var(--pa-ink-dim)" }}>{lines[1]}</p>}
      </div>
      <Button data-testid="duo-practice" data-href={href} onClick={() => window.location.assign(href)} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
        {run ? `PRACTICE ${span(run)}` : "NEXT SONG"}
      </Button>
    </div>
  );
}

function Bands({ d }: { d: DuoTake }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", gap: 16, height: "clamp(150px, 27vh, 320px)" }}>
      <ByBar cells={d.cells} per={d.per} run={d.run} />
      <Timing timing={d.timing} />
    </div>
  );
}

// null, not an empty element, for a take with no panels, so the layout makes no card for it.
const withTake = ({ chart, take, results, params }: ResultsPanelContext, panel: (d: DuoTake) => ReactNode) => {
  const d = duoTake(chart, take, results, params);
  return d ? panel(d) : null;
};

// BY BAR and TIMING, side by side.
export function duoResults(): GamePlugin {
  return { id: "duo-results", resultsPanel: (ctx) => withTake(ctx, (d) => <Bands d={d} />) };
}

// The tutor: its line and PRACTICE BARS X–Y.
export function duoTutor(): GamePlugin {
  return { id: "duo-tutor", resultsPanel: (ctx) => withTake(ctx, (d) => <Tutor d={d} chart={ctx.chart} params={ctx.params} />) };
}
