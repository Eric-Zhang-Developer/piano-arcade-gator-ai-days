/** The window event the ink listens for. The ink keeps its own copy of the name, so the two meet only here. */
export const INK_EVENT = 'etude:ink';

/** One moment the tutor reacts to: a judged note, a scored attempt, moving on, or a line the page already shows. */
export type InkCue = { kind: 'right' | 'wrong' | 'pass' | 'fail' | 'next' | 'say'; text?: string };

/** Tells the ink what just happened. A no-op on the server, where there is no ink. */
export function inkCue(cue: InkCue): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INK_EVENT, { detail: cue }));
}
