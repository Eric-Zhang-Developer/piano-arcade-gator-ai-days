import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import * as tokens from ".";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const declared = [...css.matchAll(/--pa-([\w-]+):\s*([^;]+);/g)];
const camel = (name: string) => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

test("globals.css declares the color tokens", () => {
  expect(declared.length).toBe(21);
});

test.each(declared.map(([, name, value]) => [name, value]))("--pa-%s equals the TypeScript token", (name, value) => {
  expect(tokens[camel(name) as keyof typeof tokens]).toBe(value.trim());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("whenDisplayFontReady gives up after 1 s when the font never loads", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", { fonts: { load: () => new Promise(() => {}) }, documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "" }));
  let done = false;
  void tokens.whenDisplayFontReady().then(() => (done = true));
  await vi.advanceTimersByTimeAsync(999);
  expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(done).toBe(true);
});

test("whenDisplayFontReady resolves when the font fails to load", async () => {
  vi.stubGlobal("document", { fonts: { load: () => Promise.reject(new Error("offline")) }, documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "Saira" }));
  await expect(tokens.whenDisplayFontReady()).resolves.toBeUndefined();
});
