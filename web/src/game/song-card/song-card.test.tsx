import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SongCard } from ".";

const card = { title: "Für Elise", composer: "Beethoven", catalog: "WoO 59", noteCount: 294, focused: false };
const text = (html: string) => html.replace(/<[^>]+>/g, "|");

test("renders the title, composer, catalog, count and a dash for no level", () => {
  const html = renderToStaticMarkup(<SongCard {...card} />);
  expect(html).toContain('title="Für Elise"');
  expect(text(html)).toContain("|Für Elise|");
  expect(html).toContain("Beethoven · WoO 59");
  expect(text(html)).toContain("|294|");
  expect(text(html)).toContain("|—|");
});

test("a given level renders", () => {
  expect(text(renderToStaticMarkup(<SongCard {...card} level={7} />))).toContain("|7|");
});

test("no level never renders a number besides the note count", () => {
  const numbers = text(renderToStaticMarkup(<SongCard {...card} catalog={undefined} />)).match(/\d+/g);
  expect(numbers).toEqual(["294"]);
});

test("a best grade renders its rank and accuracy; none renders nothing", () => {
  const html = text(renderToStaticMarkup(<SongCard {...card} best={{ rank: "A", accuracy: 0.912 }} />));
  expect(html).toContain("|Best 91.2%|");
  expect(html).toContain("|A|");
  expect(renderToStaticMarkup(<SongCard {...card} />)).not.toContain('data-testid="best"');
});

test("focused marks the card", () => {
  expect(renderToStaticMarkup(<SongCard {...card} focused />)).toContain("data-focused");
  expect(renderToStaticMarkup(<SongCard {...card} />)).not.toContain("data-focused");
});
