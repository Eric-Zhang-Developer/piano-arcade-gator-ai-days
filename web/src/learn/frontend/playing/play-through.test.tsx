import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LearningSessionsProvider } from '../LearningSessions';
import { PlayThroughWorkspace } from './PlayThroughWorkspace';

// As on /learn/practice (#946): the silent take is a sample learner's, so it's offered as an example, never as yours.
describe('play-through offers an example take, not a take of yours', () => {
  const html = renderToStaticMarkup(<LearningSessionsProvider><PlayThroughWorkspace /></LearningSessionsProvider>);
  it('names the button for what it shows', () => {
    expect(html).toContain('>See an example take<');
    expect(html).not.toContain('Start preview take');
  });
});
