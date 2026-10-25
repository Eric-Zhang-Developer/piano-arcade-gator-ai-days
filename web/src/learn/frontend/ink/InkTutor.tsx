'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { createInkEngine, type InkEngine, type Point } from './engine';
import { INK_EVENT, parseInkSignal } from './signal';
import { collectZones } from './zones';
import styles from './ink.module.css';

/** How often the ink re-reads the page for where the text is. */
const MEASURE_MS = 400;

/** The tutor, as ink across the whole screen of every /learn page. It lives in the middle of the screen and moves on its
 *  own, answers the `etude:ink` cues the activities send, and never takes a click. On a guided entry it follows `guide`
 *  into the node, then opens the new page (`turn`) through a hole in itself. */
export function InkTutor({ guide, turn }: { guide: Point | null; turn: RefObject<HTMLElement | null> | null }) {
  const layer = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), line = useRef<HTMLParagraphElement>(null);
  const engine = useRef<InkEngine | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const cv = canvas.current, ln = line.current;
    if (!cv || !ln) return;
    const ink = createInkEngine(cv, ln);
    engine.current = ink;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const measure = () => {
      if (document.hidden) return;
      ink.setColour(getComputedStyle(cv).color);
      ink.setZones(collectZones(document, window.innerWidth, window.innerHeight, layer.current));
    };
    let frame = 0;
    const soon = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { ink.resize(); measure(); }); };
    const visible = () => { ink.setRunning(!document.hidden); if (!document.hidden) measure(); };
    const reduce = () => ink.setReduced(motion.matches);
    const cue = (event: Event) => { const signal = parseInkSignal((event as CustomEvent<unknown>).detail); if (signal) ink.cue(signal); };
    reduce(); ink.resize(); measure(); visible();
    const timer = setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', soon, { capture: true, passive: true });
    document.addEventListener('visibilitychange', visible);
    motion.addEventListener('change', reduce);
    window.addEventListener(INK_EVENT, cue);
    return () => {
      clearInterval(timer); cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', soon, { capture: true });
      document.removeEventListener('visibilitychange', visible);
      motion.removeEventListener('change', reduce);
      window.removeEventListener(INK_EVENT, cue);
      ink.destroy(); engine.current = null;
    };
  }, []);

  // A line belongs to the page that said it.
  useEffect(() => { engine.current?.clearLine(); }, [pathname]);
  const gx = guide?.x, gy = guide?.y;
  useEffect(() => { engine.current?.setGuide(gx === undefined || gy === undefined ? null : { x: gx, y: gy }); }, [gx, gy]);
  // Before paint, so the page that turns into view is never seen whole for a frame first.
  useLayoutEffect(() => { engine.current?.turn(turn?.current ?? null); }, [turn]);

  return <div ref={layer} className={styles.layer}>
    <canvas ref={canvas} className={styles.ink} aria-hidden="true"/>
    <p ref={line} className={styles.line} role="status" aria-live="polite"/>
  </div>;
}
