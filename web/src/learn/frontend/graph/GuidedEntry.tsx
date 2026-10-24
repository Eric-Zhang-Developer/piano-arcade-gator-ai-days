'use client';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { journeyFrame, type JourneyPlan } from './guided-motion';
import styles from './journey.module.css';
type Journey = { plan: JourneyPlan; frame: ReturnType<typeof journeyFrame>; origin: string; routed: boolean; reduced: boolean };
type Run = { frame: number; timer?: ReturnType<typeof setTimeout>; origin: string; href: string; routed: boolean };
type Entry = { active: (Journey & { phase: 'anticipating' | 'flying' | 'arriving' | 'revealing' }) | null; begin: (plan: JourneyPlan, timestamp: number, arrive: () => void) => boolean; cancel: () => void };
const EntryContext = createContext<Entry | null>(null);
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
    if (pathname === current.href && current.routed) current.timer = setTimeout(() => {
      if (run.current !== current) return;
      cancel();
      const heading = document.querySelector<HTMLElement>('main h1');
      heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll:true });
    }, 300);
    else cancel();
  }, [pathname, cancel]);
  function begin(plan: JourneyPlan, timestamp: number, arrive: () => void) {
    if (run.current || !navigator.onLine) return false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const current: Run = { frame: 0, origin: pathname, href: plan.href, routed: false };
    run.current = current;
    const first: Journey = { plan, frame: journeyFrame(plan, 0), origin: pathname, routed: false, reduced: motion.matches };
    setJourney(first);
    function route() {
      if (run.current !== current || current.routed) return;
      current.routed = true;
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
  const active: Entry['active'] = journey ? { ...journey, phase: journey.routed && pathname === journey.plan.href ? 'revealing' : journey.frame.phase } : null;
  return <EntryContext value={{ active, begin, cancel }}>{children}{active && <div className={styles.overlay} data-guided-phase={active.phase} data-progress={active.frame.progress} data-href={active.plan.href} data-reduced={active.reduced} aria-hidden="true">
    <div className={styles.character} style={{ '--pet-x': `${active.frame.pet.x}px`, '--pet-y': `${active.frame.pet.y}px`, '--pet-scale': active.frame.pet.scale, '--pet-tilt': `${active.frame.pet.tilt}deg`, '--pet-squash': active.frame.pet.squash } as CSSProperties}><Image src="/learning/companion-gator.svg" width={112} height={112} alt="" unoptimized loading="eager"/></div>
  </div>}{active && <span className={styles.status} role="status">Following the gator to {active.plan.title}.</span>}</EntryContext>;
}
export function useGuidedEntry() { const entry = useContext(EntryContext); if (!entry) throw new Error('Guided entry requires the learning layout.'); return entry; }
