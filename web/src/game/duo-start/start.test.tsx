import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { Chart, GamePlugin } from "../../contracts";
import { chunkPractice } from "../chunk-practice";
import { flowMode } from "../flow-mode";
import { handMode } from "../hand-mode";
import { laptopOctaves } from "../laptop-octaves";
import { leds } from "../leds";
import { noteLabels } from "../note-labels";
import { sheetView } from "../sheet-view/plugin";
import { stageCard } from "../stage-card";
import { waitMode } from "../wait-mode/plugin";
import { groups, StartScreen } from "./StartScreen";

// Two hands, eight bars, and a pitch beyond the laptop keys' reach, so every start panel has something to show.
const chart: Chart = {
  id: "t",
  title: "Test Piece",
  composer: "Someone",
  source: "test",
  bpm: 100,
  beatsPerBar: 4,
  notes: Array.from({ length: 32 }, (_, i) => ({ id: `n${i}`, pitch: i % 2 ? 48 + (i % 5) : 84 + (i % 3), beat: i, duration: 1, hand: i % 2 ? ("L" as const) : ("R" as const) })),
};

function render(plugins: GamePlugin[]) {
  const params = new URLSearchParams();
  const c = plugins.reduce((acc, p) => p.transformChart?.(acc, params) ?? acc, chart); // as /play does before the start screen
  return renderToStaticMarkup(
    <StartScreen
      plugins={plugins}
      panel={(p) => p.startPanel?.({ chart: c, params })}
      onStart={() => {}}
      hint={<p>Laptop keys</p>}
      controls={<label>Latency offset</label>}
    />,
  );
}

// The group a test id lands in, read from the markup: the last data-group opened before it.
const region = (html: string, testid: string) => {
  const at = html.indexOf(`data-testid="${testid}"`);
  expect(at, `${testid} renders`).toBeGreaterThan(-1);
  const before = html.slice(0, at);
  return [...before.matchAll(/data-group="(\w+)"/g)].at(-1)?.[1];
};

test("every control on the old start screen renders, each from its own plugin, in its group", () => {
  const html = render([stageCard(), chunkPractice(), handMode(), laptopOctaves(), noteLabels(), waitMode(), flowMode(), sheetView(), leds()]);
  expect(region(html, "slot-stage-card")).toBe("card");
  expect(html).toContain("Are you ready?");
  for (const id of ["chunk-start", "learn-first", "play-flow", "sheet-music"]) expect(region(html, id)).toBe("modes");
  for (const id of ["labels-toggle", "hand-picker", "connect-lights"]) expect(region(html, id)).toBe("chips");
  expect(region(html, "slot-laptop-octaves")).toBe("hints");
  expect(html).toContain("Laptop keys");
  expect(html).toContain("Latency offset");
  expect(html.match(/<button[^>]*>Start<\/button>/)).not.toBeNull();
});

test("Start is the one primary button, and it has focus", () => {
  const html = render([stageCard(), sheetView(), noteLabels()]);
  expect(html.match(/data-kit="button-primary"/g)).toHaveLength(1);
  expect(html).toMatch(/<button[^>]*data-kit="button-primary"[^>]*autofocus/i);
});

test("a panel in no group still shows, under Start", () => {
  const extra: GamePlugin = { id: "someone-new", startPanel: () => <p data-testid="new-line">hello</p> };
  expect(region(render([stageCard(), extra]), "new-line")).toBe("notes");
  expect(Object.values(groups).flat()).not.toContain("someone-new");
});
