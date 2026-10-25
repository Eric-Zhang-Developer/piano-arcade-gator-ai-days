import type { ErrorInfo } from "next/error";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Chart } from "../../contracts";
import { coreGuard, crashGuard, createGuard } from ".";
import { Card } from "./boundary";

afterEach(() => vi.restoreAllMocks());

describe("createGuard", () => {
  it("logs once and calls onFail once over 100 runs; the off plugin's fn isn't called again; others all run", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const onFail = vi.fn();
    const g = createGuard(onFail);
    let bad = 0;
    let good = 0;
    for (let i = 0; i < 100; i++) {
      g.run("bad", "draw", () => {
        bad++;
        throw new Error("boom");
      });
      g.run("good", "draw", () => good++);
    }
    expect(bad).toBe(1);
    expect(good).toBe(100);
    expect(onFail.mock.calls).toEqual([["bad"]]);
    expect(log.mock.calls).toEqual([["crash-guard: bad's draw threw: boom"]]);
    expect([g.off("bad"), g.off("good")]).toEqual([true, false]);
  });

  it("a new guard runs the plugin again", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fn = vi.fn(() => {
      throw new Error("boom");
    });
    createGuard(() => {}).run("p", "onEvent", fn);
    createGuard(() => {}).run("p", "onEvent", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("coreGuard", () => {
  it("logs each distinct message once and never rethrows", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const core = coreGuard();
    for (const m of ["a", "a", "b", "a"])
      core("drawHighway", () => {
        throw new Error(m);
      });
    expect(log.mock.calls).toEqual([["crash-guard: drawHighway threw: a"], ["crash-guard: drawHighway threw: b"]]);
  });
});

describe("crashGuard", () => {
  const chart = { notes: [] } as unknown as Chart;
  const hit = { type: "noteHit" } as Parameters<NonNullable<ReturnType<typeof crashGuard>["onEvent"]>>[0];
  const start = { type: "songStart", atMs: 0 } as const;

  it("does nothing without ?crash", () => {
    const p = crashGuard();
    expect(p.transformChart!(chart, new URLSearchParams())).toBe(chart);
    for (let i = 0; i < 100; i++) p.draw!({} as CanvasRenderingContext2D, {} as never);
    p.onEvent!(hit);
  });

  it("?crash=draw throws on the take's 30th frame, again after a songStart", () => {
    const p = crashGuard();
    p.transformChart!(chart, new URLSearchParams("crash=draw"));
    const frames = () => {
      for (let i = 1; i <= 30; i++) {
        try {
          p.draw!({} as CanvasRenderingContext2D, {} as never);
        } catch {
          return i;
        }
      }
      return null;
    };
    p.onEvent!(start);
    expect(frames()).toBe(30);
    p.onEvent!(start);
    expect(frames()).toBe(30);
  });

  it("?crash=event throws on a noteHit", () => {
    const p = crashGuard();
    p.transformChart!(chart, new URLSearchParams("crash=event"));
    p.onEvent!(start);
    expect(() => p.onEvent!(hit)).toThrow("test crash (?crash=event)");
  });
});

// kit-leftovers-screens (c): the fallback is the kit's Panel and Buttons, with the same copy and both actions.
describe("the crash card", () => {
  it("renders on the kit, upright, with its copy and both actions", () => {
    const html = renderToStaticMarkup(createElement(() => Card({}, { error: new Error("boom"), retry: () => {} } as unknown as ErrorInfo)));
    expect(html).toContain('data-kit="panel"');
    expect(html).toMatch(/data-kit="button-primary"[^>]*>Back to the song list</);
    expect(html).toMatch(/data-kit="button-secondary"[^>]*>Try again</);
    expect(html).toContain("Something broke.");
    expect(html).toContain("boom");
    expect(html).toContain('role="alert"');
  });
});
