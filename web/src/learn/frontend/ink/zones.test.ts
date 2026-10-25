import { expect, it } from 'vitest';
import { mergeZones } from './zones';

it('joins the lines of a paragraph into one band', () => {
  const lines = [0, 1, 2, 3].map(i => ({ l: 100, t: 200 + i * 24, r: 500, b: 230 + i * 24 }));
  expect(mergeZones(lines)).toEqual([{ l: 100, t: 200, r: 500, b: 302 }]);
});

it('keeps blocks apart when joining them would claim open water', () => {
  const heading = { l: 100, t: 100, r: 700, b: 150 }, button = { l: 690, t: 140, r: 800, b: 400 };
  expect(mergeZones([heading, button])).toHaveLength(2);
  expect(mergeZones([heading, { l: 100, t: 600, r: 300, b: 640 }])).toHaveLength(2);
});

it('leaves its input alone', () => {
  const input = [{ l: 0, t: 0, r: 10, b: 10 }, { l: 5, t: 0, r: 15, b: 10 }];
  mergeZones(input);
  expect(input[0]).toEqual({ l: 0, t: 0, r: 10, b: 10 });
});
