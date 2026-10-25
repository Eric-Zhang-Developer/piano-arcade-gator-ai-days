import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { Chart, GamePlugin } from "../../contracts";
import { chunkPractice } from "../chunk-practice";
import { flowMode } from "../flow-mode";
import { handMode } from "../hand-mode";
import { laptopOctaves } from "../laptop-octaves";
import { leds } from "../leds";
import { noteLabels } from "../note-labels";
import { playModes } from "../play-modes";
import { rewind } from "../rewind";
import { sheetView } from "../sheet-view/plugin";
import { stageCard } from "../stage-card";
import { waitMode } from "../wait-mode/plugin";
import { groups, StartScreen } from "./StartScreen";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("song=t") }));

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

function render(plugins: GamePlugin[], params = new URLSearchParams()) {
  const c = plugins.reduce((acc, p) => p.transformChart?.(acc, params) ?? acc, chart); // as /play does before the start screen
  return renderToStaticMarkup(
    <StartScreen
      plugins={plugins}
      panel={(p) => p.startPanel?.({ chart: c, params })}
      onStart={() => {}}
      onLatency={() => {}}
      status={<p>MIDI: connects when you press Start</p>}
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

test("every control on the old start screen renders, on the screen or in the Options drawer", () => {
  // learn-first and play-flow are the play-modes ladder's Learn and Flow rungs since play-modes.
  const html = render([stageCard(), playModes(), chunkPractice(), handMode(), laptopOctaves(), noteLabels(), waitMode(), flowMode(), sheetView(), leds()]);
  expect(region(html, "slot-stage-card")).toBe("card");
  expect(html).toContain("Are you ready?");
  for (const id of ["chunk-start", "learn-first", "play-flow", "sheet-music"]) expect(region(html, id)).toBe("modes");
  expect(region(html, "hand-picker")).toBe("bar");
  expect(region(html, "options-open")).toBe("bar");
  expect(region(html, "connect-lights")).toBe("drawer");
  // Labels, latency, effects, Mute and Miss sound are the drawer's own rows, so the start screen has none of its own.
  expect(html).not.toContain("labels-toggle");
  for (const label of ["Latency offset", "Effects volume", "Mute", "Miss sound", "Note labels"]) expect(html).toContain(label);
  expect(html).toContain("MIDI: connects");
  expect(html.match(/<button[^>]*>Start<\/button>/)).not.toBeNull();
});

test("no key hints: the laptop keys line, Z / X and ← → stay off the screen (#772)", () => {
  const html = render([stageCard(), laptopOctaves(), rewind(), waitMode()], new URLSearchParams("mode=wait"));
  expect(html).not.toContain("slot-laptop-octaves");
  expect(html).not.toContain("slot-rewind");
  expect(html).not.toContain("<kbd");
  expect(html).not.toContain("Laptop keys:"); // the old hint line; "Laptop keys" alone is a Note labels choice
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

test("Watch first sits on the start screen, the perfect-bot demo of this song (select-calm, #1411)", () => {
  const html = render([]);
  const a = html.match(/<a[^>]*data-testid="start-watch"[^>]*>/)?.[0] ?? "";
  expect(a).toContain('href="/play?song=t&amp;bot=perfect&amp;audible=1&amp;demo=1"');
});
