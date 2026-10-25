import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LearningSessionsProvider } from '../LearningSessions';
import { PracticeWorkspace } from './PracticeWorkspace';

// #946: the scripted take is a sample learner's, so the page offers it as an example and never as the player's take.
describe('practice offers an example take, not a take of yours', () => {
  const html = renderToStaticMarkup(<LearningSessionsProvider><PracticeWorkspace /></LearningSessionsProvider>);
  it('names the button for what it shows', () => {
    expect(html).toContain('>See an example take<');
    expect(html).not.toContain('Start preview take');
  });
});
