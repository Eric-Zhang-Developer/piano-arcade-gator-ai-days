import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart, Results } from "../../contracts";
import { demoReset, isResetKey } from ".";

const key = (k: Partial<KeyboardEvent>) => ({ key: "Escape", shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...k });

describe("isResetKey", () => {
  it("is Shift+Escape alone, not Escape, not with Meta, not a repeat", () => {
    expect(isResetKey(key({}))).toBe(true);
    expect(isResetKey(key({ shiftKey: false }))).toBe(false);
    expect(isResetKey(key({ metaKey: true }))).toBe(false);
    expect(isResetKey(key({ repeat: true }))).toBe(false);
  });
});

describe("the idle return", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const take = (search: string) => {
    vi.useFakeTimers();
    const win = new EventTarget();
    vi.stubGlobal("window", win);
    const onIdle = vi.fn();
    const p = demoReset(onIdle);
    p.transformChart!({} as Chart, new URLSearchParams(search));
    p.onEvent!({ type: "songEnd", results: {} as Results, atMs: 0 });
    return { win, onIdle, p };
  };

  it("resets 60 s after the last input on a plain take's results, not at 59 s", () => {
    const { win, onIdle } = take("song=twinkle");
    vi.advanceTimersByTime(1000);
    win.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(59_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("doesn't arm on cabinet takes", () => {
    for (const c of ["cabinet=1", "cabinet=demo"]) {
      const { onIdle } = take(`song=twinkle&${c}`);
      vi.advanceTimersByTime(120_000);
      expect(onIdle, c).not.toHaveBeenCalled();
    }
  });

  it("?idle=3 shortens it, and songStart disarms it", () => {
    const { onIdle, p } = take("song=twinkle&idle=3");
    vi.advanceTimersByTime(3000);
    expect(onIdle).toHaveBeenCalledOnce();
    p.onEvent!({ type: "songEnd", results: {} as Results, atMs: 0 });
    p.onEvent!({ type: "songStart", atMs: 0 });
    vi.advanceTimersByTime(10_000);
    expect(onIdle).toHaveBeenCalledOnce();
  });
});
