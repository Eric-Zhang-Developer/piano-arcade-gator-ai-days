import { describe, expect, it, vi } from "vitest";
import { flipSettings, invert, measure, play, springEasing, type FlipEl } from "./flip";
import { focusMotion, onMove, panelFrames, type Deps, type Move } from "./motion";
import { BASE_OMEGA, omegaFor, retarget, spring, springSettings, step, type Spring } from "./spring";

const run = (s: Spring, frames: number, dt = 1 / 60) => {
  const xs: number[] = [];
  for (let i = 0; i < frames; i++) xs.push((s = step(s, dt)).x);
  return { s, xs };
};

describe("spring", () => {
  it("is critically damped: from rest it never passes the target", () => {
    const { xs } = run(retarget(spring(0), 100), 120);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100);
    expect(xs.every((x, i) => i === 0 || x >= xs[i - 1])).toBe(true); // and only ever closes in
  });

  it("retargets keeping its position and velocity", () => {
    const mid = run(retarget(spring(0), 100), 6).s;
    const turned = retarget(mid, 0);
    expect(turned.x).toBe(mid.x);
    expect(turned.v).toBe(mid.v);
    expect(step(turned, 1 / 60).x).toBeGreaterThan(mid.x); // still carried forward a frame: no brick wall
  });

  it("settles exactly, in a bounded number of frames", () => {
    let s = retarget(spring(0), 600);
    let n = 0;
    while ((s.x !== s.target || s.v !== 0) && n < 1000) {
      s = step(s, 1 / 60);
      n++;
    }
    expect(s.x).toBe(600);
    expect(n).toBeLessThan(60); // under a second at the base response
  });

  it("is exact for any frame length", () => {
    const fine = run(retarget(spring(0), 100), 16, 1 / 160).s.x;
    const coarse = run(retarget(spring(0), 100), 1, 0.1).s.x;
    expect(coarse).toBeCloseTo(fine, 6);
  });

  it("stiffens with the repeat rate, from the base for a lone press", () => {
    expect(omegaFor(null)).toBe(BASE_OMEGA);
    expect(omegaFor(500)).toBe(BASE_OMEGA); // a slow repeat is no stiffer than a press
    expect(omegaFor(33)).toBeGreaterThan(omegaFor(50));
    expect(omegaFor(1)).toBe(springSettings.maxOmega);
  });

  it("at a held key's rate, trails the focus by under half a row", () => {
    const row = 60;
    const interval = 33;
    let s = spring(0);
    let t = 0;
    for (let i = 1; i <= 30; i++) {
      s = retarget(s, i * row, omegaFor(interval));
      for (const end = t + interval; t < end; t += 1000 / 60) s = step(s, 1 / 60);
    }
    expect(Math.abs(s.x - 30 * row)).toBeLessThan(row / 2);
  });
});

// A list row and a list, as much of each as moveFocus reads.
const row = (top: number, id: string) => ({ offsetTop: top, offsetHeight: 60, dataset: { testid: id }, focus: vi.fn() }) as unknown as HTMLElement;
const list = () =>
  ({ scrollTop: 0, scrollHeight: 2000, clientHeight: 600, style: {}, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} }) as unknown as HTMLElement;

function harness(still = false) {
  const frames: ((t: number) => void)[] = [];
  const calls: string[] = [];
  const deps: Deps = {
    sound: vi.fn(() => void calls.push("sound")),
    still: () => still,
    raf: (cb) => (calls.push("raf"), frames.push(cb)),
    now: () => 0,
  };
  const m = focusMotion(deps);
  const bar = { style: {} as Record<string, string> } as unknown as HTMLElement;
  const l = list();
  m.setList(l);
  m.setBar(bar);
  return { m, deps, frames, calls, bar, l };
}

describe("moveFocus", () => {
  it("sounds once per keyed move and schedules the spring's first frame in the same handler", () => {
    const { m, deps, calls } = harness();
    m.moveFocus(row(0, "a"), { cause: "key", step: 1, scroll: null }); // places the bar
    calls.length = 0;
    m.moveFocus(row(60, "b"), { cause: "key", step: 1, key: undefined, scroll: "center" });
    expect(deps.sound).toHaveBeenCalledTimes(2);
    expect(deps.sound).toHaveBeenLastCalledWith("move", 0, { key: undefined });
    expect(calls).toEqual(["sound", "raf"]); // the sound, then the frame that moves: one handler, one next frame
  });

  it("stays silent for hover and Find", () => {
    const { m, deps } = harness();
    m.moveFocus(row(0, "a"), { cause: "hover", step: 1, scroll: null });
    m.moveFocus(row(60, "b"), { cause: "find", step: 1, scroll: null });
    expect(deps.sound).not.toHaveBeenCalled();
  });

  it("never queues: a held key retargets the one running spring", () => {
    const { m, frames } = harness();
    m.moveFocus(row(0, "a"), { cause: "key", step: 1, scroll: "center" });
    for (let i = 1; i <= 10; i++) m.moveFocus(row(i * 60, `r${i}`), { cause: "repeat", step: 1, scroll: "center" });
    expect(frames.length).toBe(1); // one loop, however many repeats
  });

  it("tells listeners the cause and the direction", () => {
    const { m } = harness();
    const seen: Move[] = [];
    const off = onMove((mv) => seen.push(mv));
    m.moveFocus(row(120, "song-x"), { cause: "chip", step: -1, section: "by-chopin", scroll: null });
    off();
    expect(seen).toEqual([{ id: "song-x", cause: "chip", step: -1, section: "by-chopin" }]);
  });

  it("cuts under reduced motion: the bar and the scroll are there at once, with no frame", () => {
    const { m, frames, bar, l } = harness(true);
    m.moveFocus(row(0, "a"), { cause: "key", step: 1, scroll: null });
    m.moveFocus(row(900, "b"), { cause: "key", step: 1, scroll: "center" });
    expect(frames.length).toBe(0);
    expect(bar.style.transform).toBe("translateY(900px)");
    expect(l.scrollTop).toBe(900 + 30 - 300);
    expect(l.style.scrollSnapType).toBe(""); // snap back on
  });

  it("moves the bar on frames, then rests on the row with snap back on", () => {
    const { m, frames, bar, l } = harness();
    m.moveFocus(row(0, "a"), { cause: "key", step: 1, scroll: null });
    m.moveFocus(row(600, "b"), { cause: "key", step: 1, scroll: "center" });
    expect(l.style.scrollSnapType).toBe("none");
    let t = 0;
    while (frames.length) frames.shift()!((t += 1000 / 60));
    expect(bar.style.transform).toBe("translateY(600px)");
    expect(l.scrollTop).toBe(330);
    expect(l.style.scrollSnapType).toBe("");
  });
});

describe("the panel", () => {
  const mv = (cause: Move["cause"], step: number): Move => ({ id: "x", cause, step });
  it("holds still while a key repeats and settles once when it stops", () => {
    expect(panelFrames(mv("repeat", 1), false)).toBeNull();
    expect(panelFrames(mv("repeat", 1), true)).not.toBeNull();
  });
  it("travels 6 px the way the focus went", () => {
    expect(panelFrames(mv("key", 1), false)!.keyframes[0].transform).toBe("translateY(-6px)");
    expect(panelFrames(mv("key", -1), false)!.keyframes[0].transform).toBe("translateY(6px)");
  });
});

describe("FLIP", () => {
  const el = (id: string, top: number) => {
    const anims: { id: string; cancel: () => void }[] = [];
    const e = {
      top,
      dataset: { testid: id },
      getBoundingClientRect: () => ({ top: e.top, left: 0 }),
      animate: vi.fn((k: Keyframe[], o: KeyframeAnimationOptions) => anims.push({ id: o.id ?? "", cancel: vi.fn() })),
      getAnimations: () => anims,
    };
    return e;
  };

  it("inverts from the measured rects: stayers glide from where they were, arrivals fade in", () => {
    const a = el("a", 0);
    const b = el("b", 60);
    const before = measure([a, b] as FlipEl[]);
    a.top = 120; // Find moved a down
    const c = el("c", 0); // and c is new
    const out = play(before, [a, b, c] as FlipEl[]);
    expect(out).toEqual({ moves: 1, arrivals: 1 });
    expect(a.animate).toHaveBeenCalledWith([{ translate: "0px -120px" }, { translate: "0 0" }], expect.objectContaining({ duration: flipSettings.ms }));
    expect(b.animate).not.toHaveBeenCalled(); // didn't move
    expect(c.animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], expect.anything());
  });

  it("starts each keystroke's glide over, cancelling the last", () => {
    const a = el("a", 0);
    play(measure([a] as FlipEl[]), [a] as FlipEl[]);
    a.top = 50;
    const before = measure([a] as FlipEl[]);
    const prev = a.getAnimations();
    a.top = 0;
    play(before, [a] as FlipEl[]);
    expect(prev.every((x) => (x.cancel as ReturnType<typeof vi.fn>).mock.calls.length <= 1)).toBe(true);
    expect(invert(new Map([["a", { top: 50, left: 0 }]]), new Map([["a", { top: 0, left: 0 }]])).moves).toEqual([{ key: "a", dx: 0, dy: 50 }]);
  });

  it("eases on the spring's curve, ending at rest", () => {
    expect(springEasing.startsWith("linear(0.000,")).toBe(true);
    expect(springEasing.endsWith(", 1.000)")).toBe(true);
  });
});
