import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { keyMap } from "../core/input";
import { helpGroups, laptopBlacks, laptopWhites, unlisted } from "./keys";

const src = new URL("../../", import.meta.url).pathname;

// Every non-test .ts/.tsx under these paths (spec: help-overlay, Drift test).
function walk(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path) ? [path] : [];
  return readdirSync(path).flatMap((f) => walk(join(path, f)));
}
const files = ["game", "app/page.tsx", "app/play", "app/sheet", "app/simon"].flatMap((p) => walk(join(src, p)));

const HANDLES = /addEventListener\(\s*["']keydown["']|onKeyDown|["']keydown["']/;
// `e.key === "x"`, `code !== "KeyZ"`, `k === "Enter"`, and `e.key.toLowerCase() !== "f"`.
const LITERAL = /(key|code|\bk)(?:\.toLowerCase\(\))?\s*[!=]==\s*"([^"]+)"/g;

const lines = helpGroups.flatMap((g) => g.lines);
const sources = new Set(lines.flatMap((l) => l.source ?? []));

describe("help overlay's drift test", () => {
  const handlers = files.filter((f) => HANDLES.test(readFileSync(f, "utf8"))).map((f) => relative(src, f));

  it("finds the key handlers on main", () => {
    for (const f of ["game/records/initials.ts", "game/sheet-view/SheetView.tsx", "game/core/input.ts", "game/laptop-octaves/index.tsx", "game/replay-view/overlay.tsx", "game/select-layout/index.tsx", "game/song-preview/index.tsx", "app/play/page.tsx", "app/simon/page.tsx"])
      expect(handlers, f).toContain(f);
  });

  it("every file that handles a key has a line on the card, or a reason it needs none", () => {
    const missing = handlers
      .filter((f) => !sources.has(f) && !(f in unlisted))
      .map((f) => `${f} handles ${[...readFileSync(join(src, f), "utf8").matchAll(LITERAL)].map((m) => `"${m[2]}"`).join(", ") || "keys"}`);
    expect(missing, `not on the card: add a line with its keys to help-overlay/keys.ts (a fix(help-overlay) PR), or an unlisted reason`).toEqual([]);
  });

  it("every key a listed handler compares is on one of its lines", () => {
    const gaps: string[] = [];
    for (const f of handlers.filter((h) => sources.has(h))) {
      const own = lines.filter((l) => l.source?.includes(f)).flatMap((l) => l.match ?? []).map((k) => k.toLowerCase());
      for (const [, , k] of readFileSync(join(src, f), "utf8").matchAll(LITERAL))
        if (!own.includes(k.toLowerCase())) gaps.push(`${f} handles "${k}": add it to a line's match in help-overlay/keys.ts (a fix(help-overlay) PR)`);
    }
    expect(gaps).toEqual([]);
  });

  it("every source and unlisted file still exists", () => {
    for (const f of [...sources, ...Object.keys(unlisted)]) expect(existsSync(join(src, f)), f).toBe(true);
  });

  // mouse-first: every action is clickable, keys are only shortcuts. A control is found by its accessible name in the
  // screen's sources: an exact string literal (aria-label="Pause", ["Resume", onResume]) or an element's whole JSX text
  // (`>PLAY<`, `>EASY Lv {easy}`), so a word inside a sentence (the old "· W WATCH ·" hint) doesn't count.
  it("every line names its control on its screen, or says why it's key-only", () => {
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wrong: string[] = [];
    for (const g of helpGroups) {
      const text = g.files.map((f) => readFileSync(join(src, f), "utf8")).join("\n");
      for (const l of g.lines) {
        const what = `${g.screen}: ${l.keys.join(" ")} ${l.what}`;
        if (!l.control === !l.keyOnly) wrong.push(`${what}: needs exactly one of control and keyOnly`);
        else if (l.control && !new RegExp(`["'\`]${esc(l.control)}["'\`]|>\\s*${esc(l.control)}\\s*[<{]`).test(text))
          wrong.push(`${what}: no control named "${l.control}" in ${g.files.join(", ")}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("the control check fails on a control that isn't there", () => {
    const src = '<button aria-label="Pause">❚❚</button><b>\n  PLAY\n</b><p><b>W</b> WATCH · <b>E</b> EASY</p>';
    const found = (name: string) => new RegExp(`["'\`]${name}["'\`]|>\\s*${name}\\s*[<{]`).test(src);
    expect([found("Pause"), found("PLAY"), found("WATCH"), found("PLA")]).toEqual([true, true, false, false]);
  });

  it("renders the laptop keys from core's key map at middle C", () => {
    expect(laptopWhites.length + laptopBlacks.length).toBe(keyMap(60).size);
    expect(laptopWhites[0]).toBe("A"); // C4
    expect(laptopBlacks[0]).toBe("W"); // C♯4
  });
});
