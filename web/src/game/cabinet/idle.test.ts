import { afterEach, expect, it, vi } from "vitest";
import { whenIdle } from "./idle";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("fires after ms with no input, a key restarts the wait, and a disarm stops it", () => {
  vi.useFakeTimers();
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  const onIdle = vi.fn();
  const disarm = whenIdle(30_000, onIdle);
  vi.advanceTimersByTime(1000);
  win.dispatchEvent(new Event("keydown"));
  vi.advanceTimersByTime(29_999);
  expect(onIdle).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(onIdle).toHaveBeenCalledOnce();

  const again = vi.fn();
  whenIdle(30_000, again)();
  vi.advanceTimersByTime(60_000);
  expect(again).not.toHaveBeenCalled();
  disarm();
});

it("counts extra window events as input", () => {
  vi.useFakeTimers();
  const win = new EventTarget();
  vi.stubGlobal("window", win);
  const onIdle = vi.fn();
  whenIdle(1000, onIdle, ["wheel"]);
  vi.advanceTimersByTime(900);
  win.dispatchEvent(new Event("wheel"));
  vi.advanceTimersByTime(900);
  expect(onIdle).not.toHaveBeenCalled();
});
