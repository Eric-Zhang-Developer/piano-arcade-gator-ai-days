import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { CARDS, clauses, endLinks, motionEnd, TAGLINE } from ".";

const REPO = "github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days";

it("the end card shows the live URL only when it's set", () => {
  expect(endLinks("")).toEqual([REPO]);
  expect(endLinks("https://etude.example.app/")).toEqual([REPO, "etude.example.app"]);
});

it("each card stops moving by 2000 ms", () => {
  for (const card of CARDS) expect(motionEnd(card), card).toBeLessThanOrEqual(2000);
});

it("the tagline's lines are the tagline, words unchanged", () => {
  expect(clauses(TAGLINE)).toEqual(["a machine that hears every note,", "and a reason to play one more time."]);
  expect(clauses(TAGLINE).join(" ")).toBe(TAGLINE);
});

// Reduced motion is the end state at t = 0 because every part rests in its end state and each animation only says where
// it comes from: keyframes have a from (or 0%) and nothing else, and reduced motion turns off every animated class.
it("reduced motion gives the end state at t = 0", () => {
  const css = readFileSync(new URL("./cards.module.css", import.meta.url), "utf8");
  for (const [, name, body] of css.matchAll(/@keyframes (\w+) \{([^@]*?)\n\}/g))
    expect(body.replace(/\/\*.*?\*\//g, "").match(/^\s*([\w%]+) \{/gm)?.map((s) => s.trim().slice(0, -2)), name).toEqual([
      expect.stringMatching(/^(from|0%)$/),
    ]);
  const animated = [...css.matchAll(/^\.(\w+) \{[^}]*\n {2}animation: (?!none)/gm)].map((m) => m[1]);
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)![1];
  expect(animated.length).toBeGreaterThan(0);
  for (const cls of animated) expect(reduced, cls).toContain(`.${cls}`);
});
