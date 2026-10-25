// select-motion (spec: select-motion, #1212): how the song select on / moves. One spring bar behind the focus, one
// moveFocus for every cause, the panel's and headers' moves, and Find's reflow.
import { useEffect, useRef, type RefObject } from "react";
import { measure, play } from "./flip";
import { stillNow, type FocusMotion } from "./motion";
import { record } from "./recorder";
import css from "./select-motion.module.css";

export { headerFrames, onMove, panelFrames, stillNow, useFocusMotion, useMoveAnimation, type Cause, type FocusMotion, type Move } from "./motion";

// The list's class: the bar is placed in its scroll content.
export const motionList = css.list;

// The bar: an item of the list only so it scrolls with it; hidden from the accessibility tree.
export function FocusBar({ place }: { place: FocusMotion["setBar"] }) {
  return <li aria-hidden="true" className={css.bar} ref={place} data-testid="focus-bar" />;
}

// Find's reflow (spec 5): call the returned function before the state change, and the rows under root glide once it
// has rendered. An effect, not a layout effect, so it measures after the finder's own scroll to the focused row; a
// typed key is a discrete event, so React runs it before the browser paints.
export function useReflow(root: RefObject<HTMLElement | null>, dep: unknown) {
  const before = useRef<{ at: number; rects: ReturnType<typeof measure> } | null>(null);
  const rows = () => [...(root.current?.querySelectorAll<HTMLElement>("ol a[data-testid]") ?? [])];
  useEffect(() => {
    const b = before.current;
    before.current = null;
    if (!b) return;
    const n = play(b.rects, rows());
    if (record)
      Promise.all(document.getAnimations().flatMap((a) => (a.id === "select-flip" ? [a.finished] : [])))
        .then(() => record!.flips.push({ at: b.at, restMs: performance.now() - b.at, rows: n.moves + n.arrivals }))
        .catch(() => {}); // the next keystroke cancelled it
  }, [dep]); // eslint-disable-line react-hooks/exhaustive-deps -- runs on the change, root is a ref
  return () => {
    before.current = stillNow() ? null : { at: performance.now(), rects: measure(rows()) };
  };
}
