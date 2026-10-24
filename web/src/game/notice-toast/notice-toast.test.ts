import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, toastSettings, toastStack, type Toast } from ".";

describe("notice-toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (reduced = false) => {
    let shown: readonly Toast[] = [];
    const push = toastStack((t) => (shown = t.map((x) => ({ ...x }))), () => reduced);
    const visible = () => shown.filter((t) => !t.leaving).map((t) => t.text);
    return { push, visible, all: () => shown.map((t) => t.text) };
  };

  it("shows the newest on top, and a fourth drops the oldest", () => {
    const s = setup();
    ["a", "b", "c"].forEach(s.push);
    expect(s.visible()).toEqual(["c", "b", "a"]);
    s.push("d");
    expect(s.visible()).toEqual(["d", "c", "b"]); // "a" is fading out
    vi.advanceTimersByTime(toastSettings.leaveMs);
    expect(s.all()).toEqual(["d", "c", "b"]);
  });

  it("a toast is gone at 4 s: fading from 3.8 s", () => {
    const s = setup();
    s.push("a");
    vi.advanceTimersByTime(toastSettings.ms - toastSettings.leaveMs - 1);
    expect(s.visible()).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(s.visible()).toEqual([]);
    expect(s.all()).toEqual(["a"]);
    vi.advanceTimersByTime(toastSettings.leaveMs - 1);
    expect(s.all()).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(s.all()).toEqual([]);
  });

  it("is still gone at 4 s when the fade's timer fires late: the fade is cut short, not the deadline moved (#432)", () => {
    const s = setup();
    s.push("a");
    vi.advanceTimersByTime(toastSettings.ms - toastSettings.leaveMs - 1);
    vi.setSystemTime(Date.now() + 70); // a busy machine: the leave timer fires 70 ms late
    vi.advanceTimersByTime(1);
    expect(s.visible()).toEqual([]);
    vi.advanceTimersByTime(toastSettings.leaveMs - 70 - 1);
    expect(s.all()).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(s.all()).toEqual([]); // at 4000 ms on the clock, 130 ms of fade
  });

  it("under reduced motion it shows until 3.8 s, as the fade would start, and leaves at once", () => {
    const s = setup(true);
    s.push("a");
    vi.advanceTimersByTime(toastSettings.ms - toastSettings.leaveMs - 1);
    expect(s.visible()).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(s.all()).toEqual([]);
    ["b", "c", "d", "e"].forEach(s.push);
    expect(s.all()).toEqual(["e", "d", "c"]); // the dropped one goes at once too
  });

  it("under reduced motion it's still gone by 4 s when its timer fires late (#584)", () => {
    const start = Date.now();
    let goneAt: number | null = null;
    const push = toastStack((t) => void (t.length || (goneAt ??= Date.now())), () => true);
    push("a");
    vi.advanceTimersByTime(toastSettings.ms - toastSettings.leaveMs - 1);
    vi.setSystemTime(Date.now() + 150); // a busy runner: its timer fires 150 ms late (#584 saw 4141 and 4155 ms)
    vi.advanceTimersByTime(toastSettings.leaveMs + 1);
    expect(goneAt).not.toBeNull();
    expect(goneAt! - start).toBeLessThanOrEqual(toastSettings.ms);
  });

  it("does nothing on the server", () => {
    expect(typeof document).toBe("undefined");
    expect(() => toast("x")).not.toThrow();
  });
});
