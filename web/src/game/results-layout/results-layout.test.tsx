import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { GamePlugin, Results } from "../../contracts";
import { ResultsLayout, panelName } from ".";

const results: Results = {
  chartId: "twinkle",
  judgments: [],
  extras: [],
  counts: { PERFECT: 30, GREAT: 6, GOOD: 2, MISS: 4, extra: 3, wrong: 1 },
  accuracy: 0.8125,
  maxCombo: 17,
  rank: "B",
};
const plugin = (id: string, node: string | null): GamePlugin => ({ id, resultsPanel: () => (node ? <p>{node}</p> : null) });
const plugins = [plugin("records", "TOP 5"), plugin("piano-out", "Replay on piano"), plugin("take-graph", "GRAPH"), plugin("chord-sync", "CHORDS"), plugin("evenness", null)];
const render = (props: Partial<Parameters<typeof ResultsLayout>[0]> = {}) =>
  renderToStaticMarkup(
    <ResultsLayout results={results} scored plugins={plugins} panel={(p) => p.resultsPanel?.(null!)} onRetry={() => {}} {...props} />,
  );
// The markup between two marks, so a test can say which part of the screen something is in.
const between = (html: string, from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to));

test("the counts verify reads stay plain numbers under their testids, with the rank and stats", () => {
  const html = render({ score: 10800 });
  for (const [id, n] of [["PERFECT", 30], ["GREAT", 6], ["GOOD", 2], ["MISS", 4], ["wrong", 1], ["extra", 3]])
    expect(html).toContain(`data-testid="count-${id}">${n}<`);
  expect(html).toContain('data-testid="rank"');
  expect(html).toContain(">B<");
  expect(html).toContain('data-testid="score">10,800<');
  expect(html).toContain('data-testid="accuracy">81.3%<');
  expect(html).toContain('data-testid="max-combo">17<');
});

test("without a score from the page, the score shows — rather than a made-up number", () => {
  expect(render()).toContain('data-testid="score">—<');
});

test("the featured panel and the button panels are in the first view; the rest are named cards in the details", () => {
  const html = render();
  const ceremony = between(html, 'data-testid="results"', 'id="results-details"');
  const details = html.slice(html.indexOf('id="results-details"'));
  expect(ceremony).toContain("GRAPH");
  expect(ceremony).toContain("Replay on piano");
  expect(ceremony.indexOf("Retry")).toBeLessThan(ceremony.indexOf("Replay on piano"));
  expect(ceremony).not.toContain("TOP 5");
  expect(details).toContain('aria-label="Records"');
  expect(details).toContain('aria-label="Chord sync"');
  expect(details.indexOf("TOP 5")).toBeLessThan(details.indexOf("CHORDS")); // layers.ts order
  expect(html).not.toContain("slot-evenness"); // a null panel gets no card
  expect(html).toContain('data-testid="slot-take-graph"');
});

test("a featured plugin with no panel this time leaves nothing in the first view", () => {
  const html = render({ plugins: plugins.map((p) => (p.id === "take-graph" ? plugin("take-graph", null) : p)) });
  expect(html).not.toContain("slot-take-graph");
});

test("a chunk-practice step features chunk practice's panel, and the graph moves to the details (#294)", () => {
  const all = [...plugins, plugin("chunk-practice", "NEXT")];
  const html = render({ plugins: all, params: new URLSearchParams("song=twinkle&from=1&to=4&practice=1") });
  const ceremony = between(html, 'data-testid="results"', 'id="results-details"');
  const details = html.slice(html.indexOf('id="results-details"'));
  expect(ceremony).toContain("NEXT");
  expect(ceremony).not.toContain("GRAPH");
  expect(details).toContain('aria-label="Take graph"');
  const plain = render({ plugins: all, params: new URLSearchParams("song=twinkle") });
  expect(between(plain, 'data-testid="results"', 'id="results-details"')).toContain("GRAPH");
});

test("a watch-demo take features its way back, and the graph moves to the details", () => {
  const all = [...plugins, plugin("watch-demo", "BACK")];
  const html = render({ plugins: all, params: new URLSearchParams("song=twinkle&bot=perfect&audible=1&demo=1") });
  const ceremony = between(html, 'data-testid="results"', 'id="results-details"');
  expect(ceremony).toContain("BACK");
  expect(ceremony).not.toContain("GRAPH");
});

test("wait mode shows no rank or counts", () => {
  const html = render({ scored: false });
  expect(html).toContain('data-testid="unscored"');
  expect(html).not.toContain('data-testid="rank"');
  expect(html).not.toContain("count-PERFECT");
});

test("card names come from plugin ids unless the settings name them", () => {
  expect(panelName("chord-sync")).toBe("Chord sync");
  expect(panelName("take-midi")).toBe("MIDI");
});

test("a NEW RECORD take features record-moment alone, and the graph moves to the details for that take", () => {
  const all = [...plugins, plugin("record-moment", "NEW RECORD")];
  const html = render({ plugins: all, newRecord: true });
  const ceremony = between(html, 'data-testid="results"', 'id="results-details"');
  const details = html.slice(html.indexOf('id="results-details"'));
  expect(ceremony).toContain("NEW RECORD");
  expect(ceremony).not.toContain("GRAPH");
  expect(details).toContain('aria-label="Take graph"');
  const plain = render({ plugins: all, newRecord: false });
  expect(between(plain, 'data-testid="results"', 'id="results-details"')).toContain("GRAPH");
});

test("the hold bonus names the take's own scoring policy and records namespace", () => {
  const sustain = { version: 2 as const, notes: [], earnedPoints: 0, possiblePoints: 0 };
  expect(render({ results: { ...results, sustain }, scoringVersion: 3 })).toContain("Scoring v3 · timing points + confirmed hold bonus · separate v3 records");
  expect(render({ results: { ...results, sustain }, params: new URLSearchParams("scoring=2") })).toContain("Scoring v2 · timing points + confirmed hold bonus · separate v2 records");
});
