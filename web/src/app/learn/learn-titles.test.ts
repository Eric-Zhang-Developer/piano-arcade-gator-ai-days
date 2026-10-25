import { expect, test, vi } from 'vitest';
import { APP_NAME } from '../../game/app-name';
import { metadata as layout } from './layout';
import { metadata as brandPreview } from './brand-preview/page';
import { metadata as diagnostic } from './diagnostic/page';
import { metadata as goals } from './goals/page';
import { metadata as playThrough } from './play-through/page';
import { metadata as reviewTheory } from './review/theory/page';
import { metadata as understand } from './understand/page';

// The routes import their components through Next's @/ alias, which this test setup doesn't resolve: only the
// metadata is under test, so the components and fonts are stubbed.
vi.mock('@/learn/frontend/LearningShell', () => ({ LearningShell: () => null }));
vi.mock('@/learn/frontend/brand-preview/BrandPreview', () => ({ BrandPreview: () => null }));
vi.mock('@/learn/frontend/mastery/diagnostic', () => ({ Diagnostic: () => null }));
vi.mock('@/learn/frontend/playing', () => ({ PlayThroughWorkspace: () => null }));
vi.mock('@/learn/frontend/retrieval', () => ({ Retrieval: () => null }));
vi.mock('@/learn/frontend/encoding/EncodingSandbox', () => ({ EncodingSandbox: () => null }));
vi.mock('../../learn/frontend/graph/GoalsPage', () => ({ GoalsPage: () => null }));
vi.mock('next/font/google', () => ({ Bricolage_Grotesque: () => ({ variable: '' }), Source_Sans_3: () => ({ variable: '' }) }));

// Each /learn tab reads "<page> · Learn · Étude" (#1141). practice/page.tsx is held by #1147; the default covers it.
test('the layout names every /learn tab from APP_NAME', () => {
  expect(layout.title).toEqual({ default: `Learn · ${APP_NAME}`, template: `%s · Learn · ${APP_NAME}` });
});

test('each rendering page names its own tab', () => {
  for (const m of [brandPreview, diagnostic, goals, playThrough, reviewTheory, understand]) expect(m.title).toMatch(/\S/);
});
