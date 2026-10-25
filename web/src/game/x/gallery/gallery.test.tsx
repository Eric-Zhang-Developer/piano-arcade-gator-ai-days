// lab-gallery's Validation (c): media weight, the copy text, the order, plain cards, broken storage, no requests.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { experiments, type Experiment } from "..";
import { ExperimentsGallery, galleryOrder } from "../Gallery";
import { labels, needsNoneFirst, type Label } from "./labels";
import { readVerdicts, stamp, verdictText, VERDICTS_KEY, writeVerdicts, type Verdicts } from "./verdicts";

const lab = new URL("../../../../public/lab/", import.meta.url);
const x = (name: string, group = "G", issue?: number): Experiment => ({ name, title: name, group, line: `${name} line`, issue, href: `/play?x=${name}`, plugin: () => ({ id: name }) });

describe("the posters (lab-gallery)", () => {
  const files = readdirSync(lab);
  it("each is 60 KB or less, and everything in /lab/ is 5 MB or less", () => {
    for (const f of files) expect(statSync(new URL(f, lab)).size, f).toBeLessThanOrEqual(60 * 1024);
    expect(files.reduce((n, f) => n + statSync(new URL(f, lab)).size, 0)).toBeLessThanOrEqual(5 * 1024 * 1024);
  });
  it("every labeled poster is a file there, and every registry entry has a label", () => {
    for (const [name, l] of Object.entries(labels)) if (l.poster) expect(files, name).toContain(l.poster.replace("/lab/", ""));
    for (const e of experiments) expect(labels, e.name).toHaveProperty(e.name);
  });
});

describe("the order (lab-gallery)", () => {
  it("within a group, entries needing nothing come first, stable otherwise", () => {
    const list: (Label & { n: string })[] = [{ n: "a", needs: ["dgx"] }, { n: "b" }, { n: "c", needs: [] }, { n: "d", needs: ["camera"] }, { n: "e", needs: [] }];
    expect(needsNoneFirst([...list]).map((e) => e.n)).toEqual(["b", "c", "e", "a", "d"]);
  });
  it("keeps groups in first-seen order", () => {
    const order = galleryOrder([x("a", "G1"), x("b", "G2"), x("c", "G1")]).map((e) => e.name);
    expect(order).toEqual(["a", "c", "b"]);
  });
});

describe("the cards (lab-gallery)", () => {
  it("an entry without a label renders as a text card: its link, title, line and group, no poster or needs", () => {
    const html = renderToStaticMarkup(<ExperimentsGallery experiments={[x("plain", "G", 5)]} />);
    expect(html).toContain('href="/play?x=plain"');
    expect(html).toContain("plain line");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("data-need");
    expect(html).toMatch(/<span class="[^"]*">G<\/span>/);
  });
  it("posters are hidden from the accessibility tree; verdicts are pressed-state buttons", () => {
    const html = renderToStaticMarkup(<ExperimentsGallery />);
    for (const img of html.match(/<img [^>]*>/g) ?? []) expect(img).toMatch(/alt="" aria-hidden="true"/);
    expect(html.match(/<button[^>]*aria-pressed="false"/g)).toHaveLength(experiments.length * 3);
    expect(html).toMatch(/role="status" aria-live="polite"/);
  });
  it("the DGX tag sits on exactly the plates whose needs include dgx", () => {
    const html = renderToStaticMarkup(<ExperimentsGallery />);
    expect(html.match(/>DGX</g)).toHaveLength(experiments.filter((e) => labels[e.name]?.needs?.includes("dgx")).length);
  });
});

describe("the verdicts (lab-gallery)", () => {
  const list = [x("sample", "G", 878), x("round", "G", 1123), x("no-issue"), x("conductor", "G", 985)];
  it("Copy verdicts' text: a dated header, verdicts in registry order with the note, then no verdict", () => {
    const v: Verdicts = { conductor: { v: "cut" }, sample: { v: "keep" }, round: { v: "note", note: " voices 3 and 4 too quiet " } };
    expect(verdictText(list, v, new Date(2026, 9, 25, 14))).toBe(
      ["Lab verdicts, 2026-10-25", "sample (#878): keep", "round (#1123): keep — voices 3 and 4 too quiet", "conductor (#985): cut", "no-issue: no verdict"].join("\n"),
    );
  });
  it("a note left empty reads as a plain keep, stamped KEPT*", () => {
    expect(verdictText([list[0]], { sample: { v: "note", note: "" } }, new Date(2026, 0, 2))).toBe("Lab verdicts, 2026-01-02\nsample (#878): keep");
    expect([stamp({ v: "keep" }), stamp({ v: "cut" }), stamp({ v: "note", note: "" }), stamp(undefined)]).toEqual(["KEPT", "CUT", "KEPT*", null]);
  });
  it("storage that throws, or holds junk, still reads as no verdicts; a write that throws is swallowed", () => {
    const throws = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("full"); } };
    expect(readVerdicts(throws)).toEqual({});
    expect(readVerdicts({ getItem: () => "[1,2]" })).toEqual({});
    expect(readVerdicts(undefined)).toEqual({});
    expect(() => writeVerdicts(throws, { a: { v: "keep" } })).not.toThrow();
  });
  it("round-trips under one key", () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, s: string) => void m.set(k, s) };
    writeVerdicts(store, { round: { v: "note", note: "louder" } });
    expect([...m.keys()]).toEqual([VERDICTS_KEY]);
    expect(readVerdicts(store)).toEqual({ round: { v: "note", note: "louder" } });
  });
  it("nothing in the verdict path makes a request", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const store = { getItem: () => null, setItem: () => {} };
    writeVerdicts(store, readVerdicts(store));
    verdictText(list, {}, new Date());
    renderToStaticMarkup(<ExperimentsGallery />);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
    for (const f of ["verdicts.ts", "labels.ts", "../Gallery.tsx"]) expect(readFileSync(new URL(f, import.meta.url), "utf8")).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon/);
  });
});
