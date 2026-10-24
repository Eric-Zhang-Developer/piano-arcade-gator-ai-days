import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Score } from './Score';
import { music } from './model';

it('engraves middle C with a ledger, while D below the staff stays in the space', () => {
  const svg = renderToStaticMarkup(createElement(Score, { whole: true }));
  // The first system's ledger level is y=100. Only its actual middle Cs
  // need a short line here; Ds sit in the space above it without a ledger.
  const ledgers = svg.match(/<line x1="[^"]+" x2="[^"]+" y1="100" y2="100"/g) ?? [];
  expect(ledgers).toHaveLength(music.notes.filter(n=>n.beat<16 && n.pitch===60).length);
});
