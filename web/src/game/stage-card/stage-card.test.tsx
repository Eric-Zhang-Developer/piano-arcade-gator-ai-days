import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StageCard, stageCard } from ".";

const song = { id: "fur-elise", title: "Für Elise", composer: "Ludwig van Beethoven", catalog: "WoO 59" };
const text = (html: string) => html.replace(/<[^>]+>/g, "|");

test("the card shows ARE YOU READY, the chart's title and composer, and — without a level", () => {
  const t = text(renderToStaticMarkup(<StageCard {...song} />));
  expect(t).toContain("|Are you ready?|");
  expect(t).toContain("|Für Elise|");
  expect(t).toContain("Ludwig van Beethoven · WoO 59");
  expect(t).toContain("|—|");
});

test("a given level shows instead of the dash", () => {
  const t = text(renderToStaticMarkup(<StageCard {...song} level={7} />));
  expect(t).toContain("|7|");
  expect(t).not.toContain("|—|");
});

test("the plugin's start panel is the card, with the chart's computed level", () => {
  const chart = { ...song, source: "test", bpm: 100, beatsPerBar: 4, notes: [{ id: "n0", pitch: 60, beat: 0, duration: 1, hand: "R" as const }] };
  const t = text(renderToStaticMarkup(<>{stageCard().startPanel!({ chart, params: new URLSearchParams() })}</>));
  expect(t).toContain("|Für Elise|");
  expect(t).toMatch(/\|\d+\|/);
});

test("the title is the start screen's one h1 (verify waits for a heading named after the song)", () => {
  const html = renderToStaticMarkup(<StageCard {...song} />);
  expect(html.match(/<h1[^>]*>Für Elise<\/h1>/)).not.toBeNull();
  expect(html.match(/<h[1-6]/g)).toHaveLength(1);
});
