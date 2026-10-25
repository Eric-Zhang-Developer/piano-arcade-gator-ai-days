import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { curriculum } from './mastery/curriculum';
import { songPages, songTitles } from './graph/song-titles';

// learn-a11y (#1273–#1278): what /learn says to a screen reader and a keyboard, from the server render.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => '/learn' }));
vi.mock('next/font/google', () => ({ Source_Sans_3: () => ({ variable: 'reading-face', className: 'reading-face', style: { fontFamily: 'Source Sans 3' } }) }));
const take = vi.hoisted(() => ({ phase: 'ready' as string, result: null as unknown }));
vi.mock('./playing/useTake', () => ({
  useTake: () => ({ phase: take.phase, result: take.result, beat: -1, status: { state: 'piano', name: 'Test piano' }, aids: { guide: false }, played: [], down: [], silent: false, setAids: () => {}, start: () => {}, stop: () => {}, listen: () => {}, reset: () => {} }),
}));

const { GuidedEntryProvider } = await import('./graph/GuidedEntry');
const { MasteryGraphHome } = await import('./graph/MasteryGraphHome');
const { GoalPicker } = await import('./graph/GoalPicker');
const { preparedActivity } = await import('./graph/prepared');
const { NoPassage } = await import('./playing/NoPassage');
const { PlayCheck } = await import('./playing/PlayCheck');
const { NodePractice } = await import('./playing/NodePractice');
const { playingNode } = await import('./playing/attempt');
const { EncodingSandbox } = await import('./encoding/EncodingSandbox');

const map = () => renderToStaticMarkup(<GuidedEntryProvider><MasteryGraphHome guide={{ activity: preparedActivity, href: '/learn/practice', actionLabel: 'Start', complete: false, onStart: () => {} }} /></GuidedEntryProvider>);
const h1s = (html: string) => html.match(/<h1[\s>]/g)?.length ?? 0;
const findKeys = playingNode(curriculum, 'pitch.find-keys')!;
const verdictRegion = (html: string) => html.match(/<div aria-live="polite">([\s\S]*?)<\/div>/)?.[1] ?? null;

describe('one h1 (#1273)', () => {
  it('on the map and on Nothing to play', () => {
    expect(h1s(map())).toBe(1);
    expect(h1s(renderToStaticMarkup(<NoPassage id="no.such-node" />))).toBe(1);
  });
});

it('says the next step is being planned while there is none yet (#1274)', () => {
  // The server render has no answer from Next, as a learner's first moments don't.
  expect(map()).toMatch(/role="status"[^>]*>Planning your next step…</);
});

describe('verdicts are heard (#1276)', () => {
  const failed = { verdict: { pass: false, off: ['The last G ran short'] }, attempt: { helpShare: 0 }, counts: true, saved: true };
  it('one polite region holds the verdict and the off-list, there before the take and after it', () => {
    for (const render of [() => <PlayCheck {...findKeys} />, () => <NodePractice {...findKeys} />]) {
      take.phase = 'ready'; take.result = null;
      expect(verdictRegion(renderToStaticMarkup(render()))).toMatch(/<h2>/);
      take.phase = 'result'; take.result = failed;
      const region = verdictRegion(renderToStaticMarkup(render()));
      expect(region).toContain('Not yet');
      expect(region).toContain('The last G ran short');
    }
    take.phase = 'ready'; take.result = null;
  });
});

describe('goal chips read titles (#1277)', () => {
  it('live on /learn/goals: the map links there and lists none', () => {
    const html = map();
    expect(html).toMatch(/<a[^>]*href="\/learn\/goals"[^>]*>Goals<\/a>/);
    for (const { songId } of curriculum.songs) expect(html).not.toContain(`>${songTitles[songId]}</button>`);
  });
  it('show each song by its chart title, never its id', () => {
    const html = renderToStaticMarkup(<GoalPicker chosen={[]} onToggle={() => {}} />);
    for (const { songId } of songPages(curriculum.songs)[0].songs) {
      expect(html).toContain(`>${songTitles[songId].replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</button>`);
      expect(html).not.toContain(`>${songId}</button>`);
    }
  });
  it('the titles are the charts\' own, for exactly the curriculum\'s songs', () => {
    const fromCharts = Object.fromEntries(curriculum.songs.map(({ songId }) => [songId, JSON.parse(readFileSync(new URL(`../../../public/songs/${songId}/chart.json`, import.meta.url), 'utf8')).title]));
    expect(songTitles).toEqual(fromCharts);
  });
});

it('every tab\'s aria-controls names an element on the page (#1278)', () => {
  const html = renderToStaticMarkup(<EncodingSandbox />);
  const controls = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  expect(controls.length).toBeGreaterThan(0);
  for (const id of controls) expect(html).toContain(`id="${id}"`);
});
