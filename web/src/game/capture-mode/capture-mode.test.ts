import { afterEach, expect, it, vi } from "vitest";
import { CAPTURE_KEY, CAPTURE_SCRIPT, isCapture, syncCapture } from ".";

it("?capture=1 turns it on", () => {
  expect(isCapture("?capture=1", null)).toBe(true);
  expect(isCapture("?song=twinkle&capture=1", "0")).toBe(true);
});

it("?capture=0 turns it off, even when stored", () => {
  expect(isCapture("?capture=0", "1")).toBe(false);
});

it("with no param, the stored value decides", () => {
  expect(isCapture("?song=twinkle", "1")).toBe(true);
  expect(isCapture("", "0")).toBe(false);
  expect(isCapture("", null)).toBe(false); // nothing stored, or storage blocked
});

// The <head> script (video-shots) sets the flag before the first paint with isCapture's own rule, storage blocked too.
it("the inline script agrees with isCapture, and never throws", () => {
  const run = (search: string, stored: string | null, blocked = false) => {
    const attrs = new Set<string>();
    const storage = { getItem: (k: string) => { if (blocked) throw new Error("blocked"); return k === CAPTURE_KEY ? stored : null; } };
    const document = { documentElement: { setAttribute: (name: string) => attrs.add(name) } };
    new Function("location", "sessionStorage", "document", CAPTURE_SCRIPT)({ search }, storage, document);
    return attrs.has("data-capture");
  };
  for (const search of ["?capture=1", "?capture=0", "?song=twinkle", "", "?song=twinkle&capture=1"])
    for (const stored of ["1", "0", null]) expect(run(search, stored), `${search} ${stored}`).toBe(isCapture(search, stored));
  expect(run("?capture=1", "0", true)).toBe(true);
  expect(run("", "1", true)).toBe(false);
});

it("a query-only navigation to ?capture=1 sets the flag and stores it (#1321)", () => {
  const flag = new Set<string>();
  const store = new Map<string, string>();
  vi.stubGlobal("document", { documentElement: { toggleAttribute: (name: string, on: boolean) => void (on ? flag.add(name) : flag.delete(name)) } });
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  syncCapture("?"); // /shots, its index
  expect(flag.has("data-capture")).toBe(false);
  syncCapture("?card=title&capture=1"); // the card's link, same page
  expect(flag.has("data-capture")).toBe(true);
  expect(store.get(CAPTURE_KEY)).toBe("1");
});
afterEach(() => vi.unstubAllGlobals());
