'use client';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { journeyFrame, type JourneyPlan } from './guided-motion';
import styles from './journey.module.css';
type Journey = { plan: JourneyPlan; frame: ReturnType<typeof journeyFrame>; origin: string; routed: boolean; reduced: boolean; turning: boolean };
type Run = { frame: number; timer?: ReturnType<typeof setTimeout>; origin: string; href: string; routed: boolean; reduced: boolean };
type Entry = { active: (Journey & { phase: 'anticipating' | 'flying' | 'arriving' | 'docking' | 'turning' }) | null; begin: (plan: JourneyPlan, timestamp: number, arrive: () => void) => boolean; cancel: () => void };
const EntryContext = createContext<Entry | null>(null);
/** How long the new page takes to open through the ink: the engine's TURN (ink/engine.ts), and a frame to spare. */
const TURN_MS = 700;
export function GuidedEntryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [journey, setJourney] = useState<Journey | null>(null);
  const run = useRef<Run | null>(null);
  const cancel = useCallback(() => {
    if (run.current) { cancelAnimationFrame(run.current.frame); clearTimeout(run.current.timer); run.current = null; }
    setJourney(null);
  }, []);
  useEffect(() => { window.addEventListener('offline', cancel); return () => { window.removeEventListener('offline', cancel); cancel(); }; }, [cancel]);
  useEffect(() => {
    const current = run.current;
    if (!current || pathname === current.origin) return;
    if (pathname === current.href && current.routed) {
      const focus = () => { const heading = document.querySelector<HTMLElement>('main h1'); if (heading?.isConnected) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); } };
      if (current.reduced) { cancel(); requestAnimationFrame(focus); return; }
      // The new page stays hidden for one paint, then opens through a hole in the ink where the ink came to rest.
      current.frame = requestAnimationFrame(() => {
        if (run.current !== current) return;
        setJourney(value => value ? { ...value, turning: true } : null);
        current.timer = setTimeout(() => { if (run.current !== current) return; cancel(); focus(); }, TURN_MS);
      });
    }
    else cancel();
  }, [pathname, cancel]);
  function begin(plan: JourneyPlan, timestamp: number, arrive: () => void) {
    if (run.current || !navigator.onLine) return false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const current: Run = { frame: 0, origin: pathname, href: plan.href, routed: false, reduced:motion.matches };
    run.current = current;
    const first: Journey = { plan, frame: journeyFrame(plan, 0), origin: pathname, routed: false, reduced: motion.matches, turning: false };
    setJourney(first);
    function route() {
      if (run.current !== current || current.routed) return;
      current.routed = true; current.reduced = motion.matches;
      setJourney({ ...first, frame: journeyFrame(plan, 1200), routed: true, reduced: motion.matches });
      arrive();
    }
    if (motion.matches) { route(); return true; }
    function tick(now: number) {
      if (run.current !== current) return;
      if (motion.matches) { route(); return; }
      const elapsed = now - timestamp;
      setJourney({ ...first, frame: journeyFrame(plan, elapsed) });
      if (elapsed < 1200) current.frame = requestAnimationFrame(tick);
      else route();
    }
    current.frame = requestAnimationFrame(tick);
    return true;
  }
  const active: Entry['active'] = journey ? { ...journey, phase: journey.routed && pathname === journey.plan.href ? journey.turning ? 'turning' : 'docking' : journey.frame.phase } : null;
  // The ink (ink/InkTutor.tsx) follows active.frame.pet, so the tutor itself carries the student into the node, then opens
  // the new page through itself while the phase is 'turning'.
  return <EntryContext value={{ active, begin, cancel }}>{children}{active && <span className={styles.status} role="status">Leading you to {active.plan.title}.</span>}</EntryContext>;
}
export function useGuidedEntry() { const entry = useContext(EntryContext); if (!entry) throw new Error('Guided entry requires the learning layout.'); return entry; }
