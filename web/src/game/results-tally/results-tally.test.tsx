import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Tally, tally, tallyProgress, tallySettings } from ".";

test("tally starts at 0, ends exactly at the target, never overshoots and never decreases", () => {
  for (const target of [0, 1, 3, 42, 997]) {
    expect(tally(0, target)).toBe(0);
    expect(tally(1, target)).toBe(target);
    let last = 0;
    for (let i = 0; i <= 1000; i++) {
      const n = tally(i / 1000, target);
      expect(n).toBeGreaterThanOrEqual(last);
      expect(n).toBeLessThanOrEqual(target);
      last = n;
    }
    expect(tally(-0.5, target)).toBe(0);
    expect(tally(1.5, target)).toBe(target);
  }
});

test("six counts run in order, the first starts at once and the last ends at 1.2 s", () => {
  expect(tallyProgress(0, 6, 0)).toBe(0);
  expect(tallyProgress(0, 6, 1)).toBeGreaterThan(0);
  expect(tallyProgress(1, 6, 100)).toBe(0); // PERFECT first: GREAT hasn't started yet
  expect(tallyProgress(5, 6, tallySettings.totalMs - 1)).toBeLessThan(1);
  for (let i = 0; i < 6; i++) expect(tallyProgress(i, 6, tallySettings.totalMs)).toBe(1);
});

test("the testid'd number is the final value from the first render", () => {
  const html = renderToStaticMarkup(<Tally value={42} index={0} of={6} testid="count-PERFECT" />);
  expect(html).toMatch(/data-testid="count-PERFECT">42</);
  expect(html).toContain('aria-hidden="true">0<'); // the visible number starts the run at 0
});
