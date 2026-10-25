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
const plugins = [plugin("records", "TOP 5"), plugin("piano-out", "Replay on piano"), plugin("take-graph", "GRAPH"), plugin("duo-results", "BANDS"), plugin("duo-tutor", "TUTOR"), plugin("chord-sync", "CHORDS"), plugin("evenness", null)];
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
  expect(ceremony).toContain("BANDS");
  expect(ceremony).toContain("Replay on piano");
  expect(ceremony.indexOf("BANDS")).toBeLessThan(ceremony.indexOf("TUTOR"));
  expect(ceremony.indexOf("TUTOR")).toBeLessThan(ceremony.indexOf("Retry")); // the tutor, then the buttons
  expect(ceremony.indexOf("Retry")).toBeLessThan(ceremony.indexOf("Replay on piano"));
  expect(ceremony).not.toContain("GRAPH");
  expect(details).toContain('aria-label="Take graph"');
  expect(ceremony).not.toContain("TOP 5");
  expect(details).toContain('aria-label="Records"');
  expect(details).toContain('aria-label="Chord sync"');
  expect(details.indexOf("CHORDS")).toBeLessThan(details.indexOf("TOP 5")); // How I played's order (duo-details)
  expect(html).not.toContain("slot-evenness"); // a null panel gets no card
  expect(html).toContain('data-testid="slot-duo-results"');
});

test("a featured plugin with no panel this time leaves nothing in the first view", () => {
  const html = render({ plugins: plugins.map((p) => (p.id === "duo-results" ? plugin("duo-results", null) : p)) });
  expect(html).not.toContain("slot-duo-results");
});

test("a chunk-practice step features chunk practice's panel, and the graph moves to the details (#294)", () => {
  const all = [...plugins, plugin("chunk-practice", "NEXT")];
  const html = render({ plugins: all, params: new URLSearchParams("song=twinkle&from=1&to=4&practice=1") });
  const ceremony = between(html, 'data-testid="results"', 'id="results-details"');
  const details = html.slice(html.indexOf('id="results-details"'));
  expect(ceremony).toContain("NEXT");
  expect(ceremony).not.toContain("BANDS");
  expect(details).toContain('aria-label="Duo results"');
  const plain = render({ plugins: all, params: new URLSearchParams("song=twinkle") });
  expect(between(plain, 'data-testid="results"', 'id="results-details"')).toContain("BANDS");
  const adapt = render({ plugins: all, params: new URLSearchParams("song=twinkle&from=1&to=4&practice=adapt&ok=0&ko=0&clean=0") });
  expect(between(adapt, 'data-testid="results"', 'id="results-details"')).toContain("NEXT"); // adaptive-chunks' step too
});

test("a watch-demo take features its way back, and the graph moves to the details", () => {
  const all = [...plugins, plugin("watch-demo", "BACK")];
  const html = render({ plugins: all, params: new URLSearchParams("song=twinkle&bot=perfect&audible=1&demo=1") });
  const ceremony = between(html, 'data-testid="results"', 'id="results-details"');
  expect(ceremony).toContain("BACK");
  expect(ceremony).not.toContain("BANDS");
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
  expect(ceremony).not.toContain("BANDS");
  expect(details).toContain('aria-label="Duo results"');
  const plain = render({ plugins: all, newRecord: false });
  expect(between(plain, 'data-testid="results"', 'id="results-details"')).toContain("BANDS");
});

test("the top band: the rank, the title and composer, and six data cells, PERFECT gold and MISS grey", () => {
  const html = render({ title: "Für Elise", composer: "Beethoven" });
  const top = between(html, 'data-testid="rank"', "BANDS");
  expect(top).toContain("Für Elise");
  expect(top).toContain("Beethoven");
  const labels = [...top.matchAll(/data-kit="mono"[^>]*>([^<]+)</g)].map((m) => m[1]);
  expect(labels).toEqual(expect.arrayContaining(["Perfect", "Great", "Good", "Miss", "Acc", "Max combo"]));
  const numeral = (tone: string) => top.slice(top.indexOf(`color:var(--pa-${tone})`)).split('data-kit="cell"')[0];
  expect(numeral("gold")).toContain('data-testid="count-PERFECT">30<');
  expect(numeral("miss")).toContain('data-testid="count-MISS">4<');
});

test("the details come in two groups: How I played's cards in their order, then Do something's buttons (duo-details)", () => {
  const ids = ["records", "chord-sync", "weak-bars", "bar-loop", "take-graph", "dynamics", "evenness", "tempo-curve", "replay-view", "take-midi", "dynamics-new"];
  const html = render({ plugins: ids.map((id) => plugin(id, `<${id}>`)), timing: <p>TIMING TEXT</p> });
  const played = between(html, 'data-group="played"', 'data-group="doing"');
  const doing = html.slice(html.indexOf('data-group="doing"'));
  const at = (id: string) => played.indexOf(`slot-${id}"`);
  expect(played.indexOf("TIMING TEXT")).toBeLessThan(at("tempo-curve"));
  const order = ["tempo-curve", "evenness", "dynamics", "take-graph", "bar-loop", "weak-bars", "chord-sync", "records", "dynamics-new"];
  order.slice(1).forEach((id, i) => expect(at(order[i]), `${order[i]} before ${id}`).toBeLessThan(at(id))); // unlisted last
  expect(played).toContain('aria-label="Passes"');
  expect(between(played, 'slot-take-graph"', 'slot-bar-loop"')).toContain("data-wide"); // spans both columns
  for (const id of ["replay-view", "take-midi"]) {
    expect(doing).toContain(`slot-${id}"`);
    expect(played).not.toContain(`slot-${id}"`);
  }
  expect(doing).not.toContain("aria-label="); // buttons in a row, not cards
});

test("the settings live in the Options drawer, with the MIDI status, and no inline controls under the details", () => {
  const html = render({ status: <p>MIDI: DGX</p>, onLatency: () => {} });
  const details = html.slice(html.indexOf('id="results-details"'));
  expect(details).toContain('data-testid="options-open"');
  const drawer = details.slice(details.indexOf('data-testid="options"'));
  for (const row of ["Latency offset", "Effects volume", "Mute", "Miss sound", "MIDI: DGX", "press Retry"]) expect(drawer).toContain(row);
  expect(details).not.toContain('aria-keyshortcuts="O"'); // O is a laptop piano key here
  expect(details.slice(0, details.indexOf('data-testid="options"'))).not.toContain('type="range"');
});

test("the timing text and latency button stay reachable, as the first card in the details", () => {
  const html = render({ timing: <p>12 ms late on average</p> });
  const details = html.slice(html.indexOf('id="results-details"'));
  expect(details).toContain('aria-label="Timing"');
  expect(details.indexOf("12 ms late")).toBeLessThan(details.indexOf("TOP 5"));
  expect(render({ scored: false, timing: <p>12 ms late</p> })).not.toContain("12 ms late");
});

test("Watch sits in the results' actions, the perfect-bot demo of this song, and not on the demo itself (select-calm, #1411)", () => {
  const html = render({ params: new URLSearchParams("song=twinkle") });
  expect(html).toContain('<a data-testid="results-watch" href="/play?song=twinkle&amp;bot=perfect&amp;audible=1&amp;demo=1">Watch</a>');
  expect(render({ params: new URLSearchParams("song=twinkle&bot=perfect&demo=1") })).not.toContain("results-watch");
});
