// The select's one "focus changed" path (spec: select-motion, 6). moveFocus moves the real focus, retargets the bar
// and the list's scroll on their springs, and plays the move sound, all in the handler that caused it, so the sound
// and the first frame of motion land together. A held key retargets the same springs on every repeat: nothing queues.
// The panel and the section headers listen with onMove.
import { useEffect, useState, type RefObject } from "react";
import { uiSound, type Key } from "../ui-sounds";
import { springEasing } from "./flip";
import { record, type MotionRecord } from "./recorder";
import { BASE_OMEGA, cut, omegaFor, retarget, settled, spring, step, type Spring } from "./spring";

export type Cause = "key" | "repeat" | "chip" | "hover" | "find";
export interface Move {
  id: string; // the row's test id
  cause: Cause;
  step: number; // which way focus went: +1 down the list, −1 up
  section?: string; // a chip's section
}

// Keys and chips sound, as before; hover and Find stay silent, as before (decision select-motion-causes).
const SOUNDED: ReadonlySet<Cause> = new Set(["key", "repeat", "chip"]);

type Listener = (m: Move, settle: boolean) => void;
const listeners = new Set<Listener>();
export const onMove = (l: Listener) => (listeners.add(l), () => void listeners.delete(l));

export const stillNow = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface Deps {
  sound(name: "move", delayMs: number, opts: { key?: Key }): void;
  still(): boolean;
  raf(cb: (t: number) => void): unknown;
  now(): number;
}
const browser: Deps = { sound: uiSound, still: stillNow, raf: (cb) => requestAnimationFrame(cb), now: () => performance.now() };

export type FocusMotion = ReturnType<typeof focusMotion>;

export function focusMotion(deps: Deps = browser) {
  let list: HTMLElement | null = null;
  let bar: HTMLElement | null = null;
  let barS: Spring | null = null; // null until the bar has a row
  let scrollS: Spring | null = null; // null when nobody is scrolling the list but the user
  let gen = 0; // a frame from a stopped loop does nothing
  let running = false;
  let lastT = 0;
  let lastAt: number | null = null;
  let last: Move | null = null;
  let firstFrameOf: MotionRecord["moves"][number] | null = null;

  // The list snaps to rows (select-layout's CSS), which would fight a scroll set every frame: off while the spring
  // scrolls, back on once it rests, on a snap position, so nothing moves.
  const stopScroll = () => {
    scrollS = null;
    if (list) list.style.scrollSnapType = "";
  };
  const onWheel = () => scrollS && stopScroll(); // the wheel takes the list over; native snap rests it on a row

  function write() {
    if (bar && barS) bar.style.transform = `translateY(${barS.x}px)`;
    if (list && scrollS) list.scrollTop = scrollS.x;
  }

  function frame(g: number, t: number) {
    if (g !== gen) return;
    if (record && lastT) record.frames.push(t - lastT);
    if (firstFrameOf) {
      firstFrameOf.firstFrame = t;
      firstFrameOf = null;
    }
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    if (barS) barS = step(barS, dt);
    if (scrollS) scrollS = step(scrollS, dt);
    write();
    if ((!barS || settled(barS)) && (!scrollS || settled(scrollS))) {
      running = false;
      lastT = 0;
      return stopScroll();
    }
    deps.raf((t2) => frame(g, t2));
  }

  function go(instant: boolean) {
    if (instant || ((!barS || settled(barS)) && (!scrollS || settled(scrollS)))) {
      write();
      if (!scrollS || settled(scrollS)) stopScroll();
      return;
    }
    if (running) return;
    running = true;
    const g = gen;
    deps.raf((t) => frame(g, t));
  }

  function aim(row: HTMLElement, omega: number, instant: boolean) {
    if (!bar) return;
    bar.style.height = `${row.offsetHeight}px`;
    bar.style.opacity = "1";
    barS = barS ? retarget(barS, row.offsetTop, omega) : cut(spring(row.offsetTop)); // its first row: no flight in
    if (instant) barS = cut(barS);
  }

  // The scroll's targets are snap positions (row and header tops, clamped to the range), so snap can come back on.
  function snapTo(intended: number) {
    if (!list) return intended;
    const max = Math.max(0, list.scrollHeight - list.clientHeight);
    let best = Math.min(max, Math.max(0, intended));
    let off = Infinity;
    for (const el of list.querySelectorAll<HTMLElement>("a, h3")) {
      const p = Math.min(max, el.offsetTop);
      if (Math.abs(p - intended) < off) [off, best] = [Math.abs(p - intended), p];
    }
    return best;
  }

  function aimScroll(to: number, omega: number, instant: boolean) {
    if (!list) return;
    scrollS = retarget(scrollS ?? spring(list.scrollTop), snapTo(to), omega);
    list.style.scrollSnapType = "none";
    if (instant) scrollS = cut(scrollS);
  }

  return {
    setList(el: HTMLElement | null) {
      list?.removeEventListener("wheel", onWheel);
      list = el;
      list?.addEventListener("wheel", onWheel, { passive: true });
    },
    setBar(el: HTMLElement | null) {
      bar = el;
    },

    // The one way focus moves on the select. scroll: "center" keeps the row mid-list (the keys), an element brings
    // that element to the top (a chip's header), null leaves the list where it is (hover).
    moveFocus(row: HTMLElement, o: { cause: Cause; step: number; key?: Key; section?: string; scroll: "center" | HTMLElement | null }) {
      const at = deps.now();
      const interval = o.cause === "repeat" && lastAt !== null ? at - lastAt : null;
      lastAt = at;
      const sound = SOUNDED.has(o.cause);
      if (sound) deps.sound("move", 0, { key: o.key });
      row.focus({ preventScroll: true });
      const omega = omegaFor(interval);
      const instant = deps.still();
      aim(row, omega, instant);
      if (o.scroll === "center" && list) aimScroll(row.offsetTop + row.offsetHeight / 2 - list.clientHeight / 2, omega, instant);
      else if (o.scroll && o.scroll !== "center") aimScroll(o.scroll.offsetTop, omega, instant);
      go(instant);
      if (record) {
        const r = { at, cause: o.cause, sound };
        record.moves.push(r);
        if (!instant) firstFrameOf = r;
      }
      last = { id: row.dataset.testid ?? "", cause: o.cause, step: o.step, section: o.section };
      listeners.forEach((l) => l(last!, false));
    },

    // After a render moved focus without moveFocus (Find, a sort, the first paint): the bar follows, silently. With
    // nothing shown it hides.
    follow() {
      const row = list?.querySelector("[data-focused]")?.closest<HTMLElement>("a");
      if (!row) {
        if (bar) bar.style.opacity = "0";
        return;
      }
      if (barS && barS.target === row.offsetTop && bar?.style.opacity === "1") return;
      aim(row, barS?.omega ?? BASE_OMEGA, deps.still());
      go(deps.still());
    },

    // Key-up: a held key's run is over, so the panel settles once; the next press starts at the base stiffness.
    keyUp() {
      if (last?.cause === "repeat") listeners.forEach((l) => l(last!, true));
      lastAt = null;
      if (record)
        deps.raf((t) => {
          const a = list?.ownerDocument.activeElement;
          if (barS && a instanceof HTMLElement && list?.contains(a)) record!.keyups.push({ at: t, match: Math.abs(barS.x - a.offsetTop) < a.offsetHeight / 2 });
        });
    },

    // The stage handoff (select-to-stage): everything at rest where it's going, before the view transition snapshots.
    rest() {
      if (barS) barS = cut(barS);
      if (scrollS) scrollS = cut(scrollS);
      write();
      stopScroll();
      gen++;
      running = false;
      lastT = 0;
    },

    stop() {
      gen++;
      running = false;
      lastT = 0;
    },
  };
}

export function useFocusMotion(): FocusMotion {
  const [m] = useState(() => focusMotion());
  useEffect(() => m.stop, [m]);
  return m;
}

// A listener's move, played on the element: interrupted from where it is, never under reduced motion.
export function useMoveAnimation(ref: RefObject<HTMLElement | null>, frames: (m: Move, settle: boolean) => { keyframes: Keyframe[]; ms: number } | null) {
  useEffect(
    () =>
      onMove((m, settle) => {
        const el = ref.current;
        const f = el && !stillNow() ? frames(m, settle) : null;
        if (!el || !f) return;
        for (const a of el.getAnimations()) if (a.id === "select-move") a.cancel();
        el.animate(f.keyframes, { duration: f.ms, easing: springEasing, id: "select-move" });
      }),
    [ref, frames],
  );
}

// The detail panel (spec 3): a fade from 40% with 6 px of travel the way focus went. Not while a key repeats; once
// when it stops (decision select-motion-panel).
export const panelFrames = (m: Move, settle: boolean) =>
  m.cause === "repeat" && !settle
    ? null
    : { keyframes: [{ opacity: 0.4, transform: `translateY(${-Math.sign(m.step) * 6}px)` }, { opacity: 1, transform: "none" }], ms: 220 };

// A chip's section header (spec 4): it settles in as the list lands on it.
export const headerFrames = (key: string) => (m: Move) =>
  m.cause === "chip" && m.section === key ? { keyframes: [{ opacity: 0.5, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], ms: 320 } : null;
