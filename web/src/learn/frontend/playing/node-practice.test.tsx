import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { curriculum } from '../mastery/curriculum';
import { playingNode } from './attempt';
import { NodePractice } from './NodePractice';
import { NoPassage } from './NoPassage';
import { PlayCheck } from './PlayCheck';
import { takeNotes, TakeNotes } from './TakeParts';
import type { TakeResult } from './useTake';

const findKeys = playingNode(curriculum, 'pitch.find-keys')!;
const together = playingNode(curriculum, 'rhythm.play-hands-together')!;

describe('practice on a node', () => {
  it('offers the help and a take to start, and no choice of what to learn', () => {
    const html = renderToStaticMarkup(<NodePractice {...findKeys} />);
    expect(html).toContain('aria-label="Node practice"');
    expect(html).toContain('>Guide keys<');
    expect(html).toContain('>Start take<');
    expect(html).not.toContain('aria-label="Passages"');
    expect(html).not.toContain('href="/learn"');
  });
  it('keeps the help behind one control, so the screen holds seven items or fewer', () => {
    const html = renderToStaticMarkup(<NodePractice {...together} />);
    const help = html.slice(html.indexOf('<summary>Help</summary>'), html.indexOf('</details>'));
    for (const tool of ['>Guide keys<', '>Hear it<', 'type="range"', 'aria-label="Hands"']) expect(help).toContain(tool);
    expect(html.match(/<summary>/g)).toHaveLength(1);
  });
  it('offers hands separate only for a passage with two hands', () => {
    expect(renderToStaticMarkup(<NodePractice {...findKeys} />)).not.toContain('aria-label="Hands"');
    expect(renderToStaticMarkup(<NodePractice {...together} />)).toContain('role="radiogroup" aria-label="Hands"');
  });
});

describe('the cold play check', () => {
  it('is one take with no help', () => {
    const html = renderToStaticMarkup(<PlayCheck {...findKeys} />);
    expect(html).toContain('aria-label="Play check"');
    expect(html).toContain('>Play it cold<');
    expect(html).toContain('>Start check<');
    expect(html).not.toContain('Guide keys');
    expect(html).not.toContain('>Demo<');
  });
});

describe('a take\'s notes', () => {
  const result = (off: string[], counts = true) => ({ verdict: { pass: false, off }, counts, saved: true }) as unknown as TakeResult;
  const notes = (off: string[], counts = true) => renderToStaticMarkup(<TakeNotes notes={takeNotes(result(off, counts), { status: { state: 'piano', name: 'Test piano' }, silent: false, help: 'Help 100%.' })} />);
  it('shows one note as one line', () => {
    expect(notes(['The last G ran short.'])).toMatch(/^<p class="[^"]*noteLine[^"]*" data-kind="off">The last G ran short.<\/p>$/);
  });
  it('shows the first of several in full and the rest behind it, most pressing first', () => {
    const html = notes(['The last G ran short.', 'The C came early.'], false);
    expect(html).toContain('<summary data-kind="off">The last G ran short. <span>+2 more</span></summary>');
    expect(html).toContain('<li data-kind="off">The C came early.</li><li data-kind="help">Help 100%.</li>');
  });
});

it('says so when a node has nothing to play', () => {
  const html = renderToStaticMarkup(<NoPassage id="no.such-node" />);
  expect(html).toContain('Nothing to play');
  expect(html).toContain('no.such-node');
});
