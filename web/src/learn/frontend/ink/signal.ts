/** The window event the activities send the ink on. The sending side lives in `cue.ts`; the name is repeated here on
 *  purpose, so the ink depends on the event and not on the module that sends it. */
export const INK_EVENT = 'etude:ink';

export type InkSignal = { kind: 'right' | 'wrong' | 'pass' | 'fail' | 'next' } | { kind: 'say'; text: string };

const kinds = new Set(['right', 'wrong', 'pass', 'fail', 'next', 'say']);
/** A tutor line is one or two short sentences; anything longer is not a line and is dropped. */
const maxLine = 240;

/** Reads an event's detail into a signal, or null when it is not one. Never throws: the detail comes from any script. */
export function parseInkSignal(detail: unknown): InkSignal | null {
  if (typeof detail !== 'object' || detail === null) return null;
  let kind: unknown, text: unknown;
  try { ({ kind, text } = detail as Record<string, unknown>); } catch { return null; }
  if (typeof kind !== 'string' || !kinds.has(kind)) return null;
  if (kind !== 'say') return { kind: kind as Exclude<InkSignal['kind'], 'say'> };
  if (typeof text !== 'string') return null;
  const line = text.replace(/\s+/g, ' ').trim();
  return line && line.length <= maxLine ? { kind, text: line } : null;
}
