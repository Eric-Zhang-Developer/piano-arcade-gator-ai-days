import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CARDS, clauses, endLinks, endSlots, motionEnd, TAGLINE } from ".";
import { bg, ink, primary } from "../ui-tokens";
import { FRENCH } from "../x/name-theme/cipher";
import { factsFrom, factsLine } from "./facts";
import { motifClasses, motifPitches, titleLetters, titleTimes } from "./motif";

const REPO = "github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days";

it("the end card shows the live URL only when it's set", () => {
  expect(endLinks("")).toEqual([REPO]);
  expect(endLinks("https://etude.example.app/")).toEqual([REPO, "etude.example.app"]);
});

// video-cards: the title is played now, its timing motif.ts's, and it may run to 4 s (that spec's bar); the end card
// keeps video-shots' 2000 ms.
it("the end card stops moving by 2000 ms, the played title by 4 s", () => {
  for (const card of CARDS) expect(motionEnd(card), card).toBeLessThanOrEqual(2000);
  expect(titleTimes().stillMs).toBeLessThanOrEqual(4000);
});

it("the motif is the 1909 French cipher's spelling of Étude: E–F–G–D–E, a note per letter", () => {
  expect(motifClasses()).toEqual(["E", "T", "U", "D", "E"].map((l) => FRENCH[l]));
  expect(motifClasses()).toEqual([4, 5, 7, 2, 4]);
  expect(motifPitches().map((p) => p % 12)).toEqual(motifClasses());
  expect(titleLetters()).toHaveLength(motifClasses().length);
  const t = titleTimes();
  expect(t.notes.map((n) => n.atMs)).toEqual([...t.notes.map((n) => n.atMs)].sort((a, b) => a - b));
  expect(t.accentMs).toBe(t.notes.at(-1)!.atMs); // the acute lands on the last note
  expect(t.taglineMs).toBeGreaterThan(t.accentMs);
});

// Reduced motion changes the picture, never the schedule: Title.tsx sends every note from titleTimes() before it looks
// at the media query, and titleTimes() takes no motion argument.
it("reduced motion keeps the motif's schedule", () => {
  const src = readFileSync(new URL("./Title.tsx", import.meta.url), "utf8");
  expect(src.indexOf("out?.send(")).toBeLessThan(src.indexOf("if (reduced())"));
  expect(titleTimes.length).toBe(0);
});

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

it("the end card's big URL is ink on the field, 7:1 or more", () => {
  expect(contrast(ink, bg)).toBeGreaterThanOrEqual(7);
  expect(contrast(primary, bg)).toBeCloseTo(7, 1); // the kit's blue sits on the line (7.00), so the big URL isn't blue
  expect(readFileSync(new URL("./cards.module.css", import.meta.url), "utf8")).toMatch(/\.lead \{[^}]*color: var\(--pa-ink\);/);
});

it("the big URL slot is the live URL, or the repo while it's unset", () => {
  expect(endSlots("")).toEqual([REPO, null]);
  expect(endSlots("https://etude.example.app/")).toEqual(["etude.example.app", REPO]);
});

it("the facts count first-parent commits whose subject ends in a PR number, dated in ET", async () => {
  const { firstParentLog, isPr } = await import("./make-facts.mjs");
  const dir = mkdtempSync(join(tmpdir(), "facts-"));
  const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } });
  git("init", "-q", "-b", "main");
  const at = (iso: string) => ({ ...process.env, GIT_COMMITTER_DATE: iso });
  const c = (subject: string, iso: string) => execFileSync("git", ["commit", "-q", "--allow-empty", "--no-gpg-sign", "-m", subject], { cwd: dir, env: { ...at(iso), GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_AUTHOR_DATE: iso } });
  c("bootstrap", "2026-10-23T12:00:00Z"); // no PR number: not counted
  c("feat(a): one (#1)", "2026-10-24T03:30:00Z"); // 23:30 ET on the 23rd
  git("switch", "-q", "-c", "side");
  c("fix(b): on a side branch (#2)", "2026-10-24T05:00:00Z"); // not first-parent: not counted
  git("switch", "-q", "main");
  execFileSync("git", ["merge", "-q", "--no-ff", "--no-gpg-sign", "-m", "Merge pull request #3 from someone/feat-c", "side"], { cwd: dir, env: { ...at("2026-10-25T20:00:00Z"), GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_AUTHOR_DATE: "2026-10-25T20:00:00Z" } });
  c("docs: no number here", "2026-10-25T21:00:00Z");
  const f = factsFrom(firstParentLog(dir, "main"), isPr);
  expect(f).toEqual({ merged: 2, first: "2026-10-23", last: "2026-10-25" });
  expect(factsLine(f)).toBe("2 pull requests merged, Oct 23–25, 2026");
  expect(factsLine(null)).toBeNull();
  expect(factsLine({ merged: 1204, first: "2026-09-30", last: "2026-10-02" })).toBe("1,204 pull requests merged, Sep 30–Oct 2, 2026");
});

it("the tagline's lines are the tagline, words unchanged", () => {
  expect(clauses(TAGLINE)).toEqual(["a machine that hears every note,", "and a reason to play one more time."]);
  expect(clauses(TAGLINE).join(" ")).toBe(TAGLINE);
});

// Reduced motion is the end state at t = 0 because every part rests in its end state and each animation only says where
// it comes from: keyframes have a from (or 0%) and nothing else, and reduced motion turns off every animated class.
it("reduced motion gives the end state at t = 0", () => {
  const css = readFileSync(new URL("./cards.module.css", import.meta.url), "utf8");
  for (const [, name, body] of css.matchAll(/@keyframes (\w+) \{([^@]*?)\n\}/g))
    expect(body.replace(/\/\*.*?\*\//g, "").match(/^\s*([\w%]+) \{/gm)?.map((s) => s.trim().slice(0, -2)), name).toEqual([
      expect.stringMatching(/^(from|0%)$/),
    ]);
  const animated = [...css.matchAll(/^\.(\w+) \{[^}]*\n {2}animation: (?!none)/gm)].map((m) => m[1]);
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/)![1];
  expect(animated.length).toBeGreaterThan(0);
  for (const cls of animated) expect(reduced, cls).toContain(`.${cls}`);
});
