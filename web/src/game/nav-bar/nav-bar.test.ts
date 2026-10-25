import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doneSlots } from "./done";
import { experiments } from "../x";
import { EXPERIMENT_PAGES, GITHUB_URL, LAB_PAGES, SLOTS, hideNav, isCurrent } from "./slots";

const repo = new URL("../../../../", import.meta.url).pathname;
const changes = `${repo}changes`;
const done = new Set(readdirSync(changes).map((f) => f.replace(/\.md$/, "")));

describe("nav bar slots", () => {
  it("shows exactly the slots whose done note is on disk, in the spec's order", () => {
    expect(doneSlots(changes, false).map((s) => s.slug)).toEqual(SLOTS.filter((s) => done.has(s.slug)).map((s) => s.slug));
    expect(SLOTS.map((s) => s.label)).toEqual(["Play", "Learn", "Lab", "How it's built", "Progress", "Status"]);
  });

  it("Status links to /operator outside production only, since its API routes 404 there", () => {
    expect(SLOTS.find((s) => s.label === "Status")).toMatchObject({ path: "/operator", devOnly: true });
    expect(doneSlots(changes, false).some((s) => s.path === "/operator")).toBe(done.has("operator-board"));
    expect(doneSlots(changes, true).some((s) => s.path === "/operator")).toBe(false);
  });

  it("links the repo, from the corner mark and not as a slot in the row", () => {
    expect(GITHUB_URL).toBe("https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days");
    expect(SLOTS.some((s) => /github/i.test(`${s.label} ${s.path}`))).toBe(false);
  });

  it("every done slot's path is a page under web/src/app/", () => {
    for (const s of doneSlots(changes, false)) {
      const page = `${repo}web/src/app${s.path === "/" ? "" : s.path}/page.tsx`;
      expect(existsSync(page), `${s.label}: ${page}`).toBe(true);
    }
  });

  it("a missing note hides its slot", () => {
    expect(doneSlots("/nonexistent")).toEqual([]);
  });

  it("hides on /play, /stage, /real-keys, /cabinet, /attract and in capture mode; shows on /, /learn, /lab, /progress, /operator", () => {
    for (const p of ["/play", "/stage", "/real-keys", "/cabinet", "/attract", "/attract/x"]) expect(hideNav(p, false), p).toBe(true);
    expect(hideNav("/", true)).toBe(true);
    expect(hideNav("/operator", true)).toBe(true);
    for (const p of ["/", "/learn", "/lab", "/progress", "/player", "/operator", "/operator/x"]) expect(hideNav(p, false), p).toBe(false);
  });

  it("marks the current slot: Play only on /, others on their path and below", () => {
    const [play, learn] = SLOTS;
    expect([isCurrent(play, "/"), isCurrent(play, "/learn"), isCurrent(learn, "/learn"), isCurrent(learn, "/learn/x")]).toEqual([true, false, true, true]);
  });

  it("marks Lab current on the pages the Lab lists that no other slot owns (#1043)", () => {
    const lab = SLOTS.find((s) => s.path === "/lab")!;
    for (const p of ["/lab", "/simon", "/wrong-note", "/sim", "/veritas", "/calibrate"]) expect(isCurrent(lab, p), p).toBe(true);
    // Learn's own page stays Learn's, and a page the Lab doesn't list lights nothing.
    expect(LAB_PAGES).not.toContain("/learn");
    expect(LAB_PAGES).not.toContain("/");
    expect([isCurrent(lab, "/learn"), isCurrent(lab, "/"), isCurrent(lab, "/progress")]).toEqual([false, false, false]);
    expect(SLOTS.filter((s) => isCurrent(s, "/simon")).map((s) => s.label)).toEqual(["Lab"]);
  });

  it("marks Lab current on every experiment's page no other slot owns, /conduct and /highlight among them (#1130)", () => {
    const lab = SLOTS.find((s) => s.path === "/lab")!;
    const pages = [...new Set(experiments.map((x) => new URL(x.href, "http://lab").pathname))];
    expect([...EXPERIMENT_PAGES].sort()).toEqual([...pages].sort()); // the list in slots.ts is the registry's
    for (const p of [...pages.filter((p) => !SLOTS.some((s) => s.path !== "/lab" && isCurrent(s, p))), "/conduct", "/highlight"])
      expect(isCurrent(lab, p), p).toBe(true);
  });
});
