import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart } from "../../contracts";
import { defaults, keyOptions, withOptions } from "./options";

const chart = (id: string): Chart => JSON.parse(readFileSync(`public/songs/${id}/chart.json`, "utf8"));
const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...mods });

describe("withOptions", () => {
  it("adds only non-default params and keeps the others", () => {
    expect(withOptions("/play?song=twinkle")).toBe("/play?song=twinkle");
    expect(withOptions("/play?song=fur-elise&level=easy", { hands: "R", speed: 70 })).toBe("/play?song=fur-elise&level=easy&hands=R&tempo=70");
    expect(withOptions("/play?song=x&mode=wait", { hands: "both", speed: 50 })).toBe("/play?song=x&mode=wait&tempo=50");
    expect(withOptions("/play?song=x&hands=L&tempo=70", defaults)).toBe("/play?song=x");
  });
});

describe("keys", () => {
  it("H cycles Both → Right → Left on a two-hand chart, and does nothing on a one-hand chart", () => {
    const r = keyOptions(defaults, key("h"), true)!;
    expect(r.hands).toBe("R");
    expect(keyOptions(r, key("H"), true)!.hands).toBe("L");
    expect(keyOptions({ hands: "L", speed: 100 }, key("h"), true)!.hands).toBe("both");
    expect(keyOptions(defaults, key("h"), false)).toBeNull();
  });

  it("← and → step Speed and stop at the ends; Ctrl, Meta, Alt and repeats are ignored", () => {
    expect(keyOptions(defaults, key("ArrowLeft"), false)!.speed).toBe(70);
    expect(keyOptions({ hands: "both", speed: 70 }, key("ArrowLeft"), false)!.speed).toBe(50);
    expect(keyOptions({ hands: "both", speed: 50 }, key("ArrowLeft"), false)).toBeNull();
    expect(keyOptions(defaults, key("ArrowRight"), false)).toBeNull();
    expect(keyOptions(defaults, key("ArrowLeft", { metaKey: true }), true)).toBeNull();
    expect(keyOptions(defaults, key("h", { ctrlKey: true }), true)).toBeNull();
    expect(keyOptions(defaults, key("h", { repeat: true }), true)).toBeNull();
  });
});

describe("store", () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips through a reload and drops a song set back to the defaults", async () => {
    const a = await import("./options");
    a.setOptions("fur-elise", { hands: "R", speed: 70 });
    a.setOptions("twinkle", { hands: "both", speed: 50 });
    vi.resetModules();
    const b = await import("./options");
    expect(b.readOptions()).toEqual({ "fur-elise": { hands: "R", speed: 70 }, twinkle: { hands: "both", speed: 50 } });
    b.setOptions("twinkle", defaults);
    b.setOptions("fur-elise", defaults);
    expect(b.readOptions()).toEqual({});
    expect(store.has("pianoArcade.songOptions")).toBe(false);
  });

  it("reads corrupt JSON as empty, with one console line, and unknown values as the defaults", async () => {
    store.set("pianoArcade.songOptions", "{oops");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = await import("./options");
    expect(a.readOptions()).toEqual({});
    expect(a.readOptions()).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    vi.resetModules();
    store.set("pianoArcade.songOptions", JSON.stringify({ x: { hands: "Q", speed: 33 }, y: { hands: "L", speed: 100 } }));
    expect((await import("./options")).readOptions()).toEqual({ y: { hands: "L", speed: 100 } });
  });

  it("blocked storage keeps the options for the page", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    });
    const a = await import("./options");
    a.setOptions("fur-elise", { hands: "L", speed: 50 });
    expect(a.readOptions()).toEqual({ "fur-elise": { hands: "L", speed: 50 } });
  });
});

describe("<SongOptions />", () => {
  it("shows Hands only on a two-hand chart, Speed always, and no practice line at the defaults", async () => {
    const { SongOptions } = await import(".");
    const two = renderToStaticMarkup(<SongOptions id="fur-elise" chart={chart("fur-elise")} />);
    expect(two).toContain('data-testid="hands-R"');
    expect(two).toMatch(/data-testid="speed-100" aria-pressed="true"/);
    expect(two).toMatch(/data-testid="hands-both" aria-pressed="true"/);
    expect(two).not.toContain("practice · not recorded");
    const one = renderToStaticMarkup(<SongOptions id="twinkle" chart={chart("twinkle")} />);
    expect(one).not.toContain("hands-");
    expect(one).toContain('data-testid="speed-70"');
  });
});
