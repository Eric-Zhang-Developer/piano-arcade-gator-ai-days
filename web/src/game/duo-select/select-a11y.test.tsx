import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SectionChips } from "../main-page/Sections";
import { NavLinks } from "../nav-bar/NavLinks";
import { SLOTS } from "../nav-bar/slots";
import { EMPTY_ROLL } from "./roll";
import { FocusPanel } from "./Select";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

// The tags that open before `marker`, still open where it sits: its ancestors, outermost first.
function ancestors(html: string, marker: string): string[] {
  const open: string[] = [];
  for (const m of html.slice(0, html.indexOf(marker)).matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*?)(\/?)>/g)) {
    if (m[4] || ["img", "br", "input", "path"].includes(m[2])) continue;
    if (m[1]) open.pop();
    else open.push(m[0]);
  }
  return open;
}

describe("select a11y (#1236-#1238)", () => {
  it("an arrow step reads the song: no live region around the buttons, one polite line with title, composer and level", () => {
    const html = renderToStaticMarkup(
      <FocusPanel id="fur-elise" title="Für Elise" composer="Ludwig van Beethoven (WoO 59)" roll={EMPTY_ROLL} level={3} notes={120} onPlay={() => {}} onPractice={() => {}}>
        <select aria-label="Preview" />
      </FocusPanel>,
    );
    expect(ancestors(html, 'data-testid="select-play"').filter((t) => t.includes("aria-live"))).toEqual([]);
    expect(ancestors(html, 'aria-label="Preview"').filter((t) => t.includes("aria-live"))).toEqual([]);
    const live = [...html.matchAll(/<[^>]*aria-live="polite"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(live).toEqual(["Für Elise, Ludwig van Beethoven, level 3"]);
  });

  it("the place is heard as Song N of M, and the visible N / M is hidden from readers", () => {
    const html = renderToStaticMarkup(<SectionChips sections={[]} place={7} count={40} onJump={() => {}} />);
    expect(html).toContain(">Song 7 of 40<");
    expect(html).not.toContain("> / 40<"); // select-calm (#1411): the visible N / M is gone, so nothing is left to hide
    expect(html).not.toContain("aria-label=\"Song");
  });

  it("the GitHub link says it opens a new tab", () => {
    const html = renderToStaticMarkup(<NavLinks slots={SLOTS} />);
    const a = html.match(/<a[^>]*data-testid="nav-github"[^>]*>/)![0];
    expect(a).toContain('target="_blank"');
    expect(a).toContain('aria-label="GitHub (opens in a new tab)"');
  });
});
