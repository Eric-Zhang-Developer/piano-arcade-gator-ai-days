import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { curriculum } from '../mastery/curriculum';
import { playingNode } from './attempt';
import { NodePractice } from './NodePractice';
import { NoPassage } from './NoPassage';
import { PlayCheck } from './PlayCheck';

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

it('says so when a node has nothing to play', () => {
  const html = renderToStaticMarkup(<NoPassage id="no.such-node" />);
  expect(html).toContain('Nothing to play');
  expect(html).toContain('no.such-node');
});
