export type Rect = { l: number; t: number; r: number; b: number };

/** What the student reads or acts on. The ink dims over these and keeps its dense marks out of them. */
const QUIET = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,label,legend,button,a,input,select,textarea,th,td,figcaption,blockquote,pre,[role=status],[role=alert],[role=img],img,canvas,video,svg';
/** Room kept around each block, so a field ends a little past the text and not on its last letter. */
const PAD = 16;
/** Most fields the ink checks against. Past this, the smallest go first: they sit inside a bigger one more often than not. */
const MOST = 120;

/** The quiet fields on screen right now. A container marked `data-ink-open` (the map) is open water: only its marked
 *  children (`data-ink-quiet`, and text) count, not its whole box. */
export function collectZones(doc: Document, width: number, height: number, skip: Element | null): Rect[] {
  const rects: Rect[] = [];
  const add = (el: Element) => {
    const r = el.getBoundingClientRect();
    // Under 2px is a screen-reader-only block, not something on screen.
    if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > width || r.top > height) return;
    rects.push({ l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD });
  };
  for (const el of doc.querySelectorAll(QUIET)) {
    if (skip?.contains(el)) continue;
    const open = el.closest('[data-ink-open]');
    if (open && open !== el) continue;
    if (open) { for (const child of el.querySelectorAll('[data-ink-quiet],text')) add(child); continue; }
    // A block inside another quiet block adds nothing the outer one doesn't cover.
    if (el.parentElement?.closest(QUIET)) continue;
    add(el);
  }
  return mergeZones(rects);
}

const area = (z: Rect) => (z.r - z.l) * (z.b - z.t);
/** Joins fields that touch when the joined box is about as big as the two of them (the lines of a paragraph, a row of
 *  buttons), so the ink checks a handful of bands, not every word. Two far-apart blocks stay apart. */
export function mergeZones(input: readonly Rect[]): Rect[] {
  const zones = input.map(z => ({ ...z }));
  // Repeat until a whole pass joins nothing: a field that grew may now touch one earlier in the list.
  for (let joined = true; joined;) {
    joined = false;
    for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i], b = zones[j];
      if (a.r < b.l || b.r < a.l || a.b < b.t || b.b < a.t) continue;
      const u = { l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.r), b: Math.max(a.b, b.b) };
      const overlap = (Math.min(a.r, b.r) - Math.max(a.l, b.l)) * (Math.min(a.b, b.b) - Math.max(a.t, b.t));
      if (area(u) > 1.25 * (area(a) + area(b) - overlap)) continue;
      zones[i] = u; zones.splice(j, 1); j = i; joined = true;
    }
  }
  return zones.length > MOST ? zones.sort((a, b) => area(b) - area(a)).slice(0, MOST) : zones;
}
