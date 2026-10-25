import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doneSlots } from "./done";
import { SLOTS, hideNav, isCurrent } from "./slots";

const repo = new URL("../../../../", import.meta.url).pathname;
const changes = `${repo}changes`;
const done = new Set(readdirSync(changes).map((f) => f.replace(/\.md$/, "")));

describe("nav bar slots", () => {
  it("shows exactly the slots whose done note is on disk, in the spec's order", () => {
    expect(doneSlots(changes).map((s) => s.slug)).toEqual(SLOTS.filter((s) => done.has(s.slug)).map((s) => s.slug));
    expect(SLOTS.map((s) => s.label)).toEqual(["Play", "Learn", "Lab", "How it's built", "Progress"]);
  });

  it("every done slot's path is a page under web/src/app/", () => {
    for (const s of doneSlots(changes)) {
      const page = `${repo}web/src/app${s.path === "/" ? "" : s.path}/page.tsx`;
      expect(existsSync(page), `${s.label}: ${page}`).toBe(true);
    }
  });

  it("a missing note hides its slot", () => {
    expect(doneSlots("/nonexistent")).toEqual([]);
  });

  it("hides on /play, /cabinet, /attract, /operator and in capture mode; shows on /, /learn, /lab, /progress", () => {
    for (const p of ["/play", "/cabinet", "/attract", "/operator", "/operator/x"]) expect(hideNav(p, false), p).toBe(true);
    expect(hideNav("/", true)).toBe(true);
    for (const p of ["/", "/learn", "/lab", "/progress", "/player"]) expect(hideNav(p, false), p).toBe(false);
  });

  it("marks the current slot: Play only on /, others on their path and below", () => {
    const [play, learn] = SLOTS;
    expect([isCurrent(play, "/"), isCurrent(play, "/learn"), isCurrent(learn, "/learn"), isCurrent(learn, "/learn/x")]).toEqual([true, false, true, true]);
  });
});
