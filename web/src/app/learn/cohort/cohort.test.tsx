import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { syntheticLearner } from '../../../learn/frontend/mastery/sim';
import { Cohort } from './Cohort';

vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face' }) }));

test('each learner is labeled synthetic and links View as to its own /learn', () => {
  const cohort = ['synthetic-001', 'synthetic-042', 'synthetic-200'].map(id => syntheticLearner(id)!);
  const html = renderToStaticMarkup(<Cohort cohort={cohort}/>);
  expect(html).toContain('<h1>Synthetic cohort</h1>');
  expect(html).toContain('3 synthetic learners, not real students.');
  for (const { id } of cohort) expect(html).toContain(`href="/learn?as=${id}"`);
  expect(html.split('<tbody>')[1].match(/<tr>/g)).toHaveLength(3);
});
