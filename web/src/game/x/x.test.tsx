import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Chart, GamePlugin } from "../../contracts";
import { experiments, flagged, xFrame, type Experiment } from ".";
import { ExperimentsGallery, galleryOrder, groupsOf } from "./Gallery";

const web = new URL("../../../", import.meta.url);
const chart = { id: "c", title: "C", composer: "-", source: "-", bpm: 120, beatsPerBar: 4, notes: [] } as unknown as Chart;
const frame = { nowMs: 0, lowPitch: 21, highPitch: 108, judgmentLineY: 600, keyX: () => ({ x: 0, width: 10 }), width: 1280, height: 720 };
const ctx = { save: vi.fn(), restore: vi.fn() } as unknown as CanvasRenderingContext2D;

// A fake experiment whose plugin counts every hook it gets.
function spy(name: string, group = "G") {
  const calls: string[] = [];
  const made = vi.fn(
    (): GamePlugin => ({
      id: `x-${name}`,
      transformChart: (c) => (calls.push("transformChart"), c),
      draw: () => void calls.push("draw"),
      onEvent: () => void calls.push("onEvent"),
      startPanel: () => (calls.push("startPanel"), `${name} panel`),
    }),
  );
  const x: Experiment = { name, title: name, group, line: `${name} line`, href: `/play?song=twinkle&x=${name}`, plugin: made };
  return { x, calls, made };
}

// One take through every hook the frame forwards.
function take(p: GamePlugin, search: string) {
  p.transformChart!(chart, new URLSearchParams(search));
  p.draw!(ctx, frame);
  p.onEvent!({ type: "songStart", atMs: 0 } as never);
  return p.startPanel!({ chart, params: new URLSearchParams(search) });
}

describe("the registry (experiments)", () => {
  it.each(experiments)("$name has a folder, a name, a group, a line and a URL to a page that turns it on", (x) => {
    expect(existsSync(new URL(`src/game/x/${x.name}/index.ts`, web)) || existsSync(new URL(`src/game/x/${x.name}/index.tsx`, web))).toBe(true);
    for (const k of ["title", "group", "line"] as const) expect(x[k].trim(), k).not.toBe("");
    const url = new URL(x.href, "http://lab");
    expect(existsSync(new URL(`src/app${url.pathname}/page.tsx`, web)), url.pathname).toBe(true);
    expect(flagged(url.searchParams).has(x.name)).toBe(true);
    const song = url.searchParams.get("song");
    if (song) expect(existsSync(new URL(`public/songs/${song}/chart.json`, web)), song).toBe(true);
  });

  it("has no name twice, and every name is a plain folder name", () => {
    const names = experiments.map((x) => x.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("the frame (experiments)", () => {
  it("is off by default: with no ?x=, no experiment's plugin is made or called", () => {
    const a = spy("a");
    const b = spy("b");
    expect(take(xFrame([a.x, b.x]), "song=twinkle")).toBeNull();
    expect(a.made).not.toHaveBeenCalled();
    expect(b.made).not.toHaveBeenCalled();
  });

  it("?x=<name> turns on exactly that one, and passes it every hook", () => {
    const a = spy("a");
    const b = spy("b");
    const panel = take(xFrame([a.x, b.x]), "song=twinkle&x=b");
    expect(a.made).not.toHaveBeenCalled();
    expect(b.calls).toEqual(["transformChart", "draw", "onEvent", "startPanel"]);
    expect(renderToStaticMarkup(<>{panel}</>)).toBe("b panel");
  });

  it("?x=a,b turns on both; an unknown name turns on nothing", () => {
    const a = spy("a");
    const b = spy("b");
    take(xFrame([a.x, b.x]), "x=a, b,nope");
    expect(a.calls).toContain("draw");
    expect(b.calls).toContain("draw");
    const c = spy("c");
    expect(take(xFrame([c.x]), "x=nope")).toBeNull();
    expect(c.made).not.toHaveBeenCalled();
  });

  it("an experiment that throws is turned off alone; the next take starts fresh", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad: Experiment = { ...spy("bad").x, plugin: () => ({ id: "x-bad", draw: () => { throw new Error("boom"); } }) };
    const ok = spy("ok");
    const p = xFrame([bad, ok.x]);
    take(p, "x=bad,ok");
    p.draw!(ctx, frame);
    expect(ok.calls.filter((c) => c === "draw")).toHaveLength(2);
    expect(err).toHaveBeenCalledTimes(1);
    take(p, "x=bad,ok"); // a new take: bad gets its chance again
    expect(err).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("a take with no ?x= after one with it turns everything off again", () => {
    const a = spy("a");
    const p = xFrame([a.x]);
    take(p, "x=a");
    const n = a.calls.length;
    take(p, "");
    expect(a.calls).toHaveLength(n);
  });
});

describe("the gallery (experiments)", () => {
  const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

  // In the gallery's reading order (lab-gallery: needs-nothing first within a group), each entry exactly once.
  it("renders one link per registry entry", () => {
    const html = renderToStaticMarkup(<ExperimentsGallery />);
    expect(links(html)).toEqual(galleryOrder(experiments).map((x) => x.href));
    expect([...links(html)].sort()).toEqual(experiments.map((x) => x.href).sort());
  });

  it("groups a long registry in the order groups first appear, one link each", () => {
    const fixture = Array.from({ length: 40 }, (_, i) => spy(`e${i}`, `group ${i % 3}`).x);
    expect(groupsOf(fixture).map((g) => g.group)).toEqual(["group 0", "group 1", "group 2"]);
    const html = renderToStaticMarkup(<ExperimentsGallery experiments={fixture} />);
    expect(links(html)).toHaveLength(40);
    expect(new Set(links(html))).toEqual(new Set(fixture.map((x) => x.href)));
  });

  it("shows nothing when the registry is empty", () => {
    expect(renderToStaticMarkup(<ExperimentsGallery experiments={[]} />)).toBe("");
  });
});
