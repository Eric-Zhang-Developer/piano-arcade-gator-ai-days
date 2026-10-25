import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { rewind } from ".";

describe("rewind's start panel (kit-leftovers-small, #1209)", () => {
  const panel = (q: string) => {
    const node = rewind().startPanel!({ params: new URLSearchParams(q), chart: {} as Chart } as never);
    return node ? renderToStaticMarkup(<>{node}</>) : "";
  };

  it("Learn mode shows ← → as square chips, like the help overlay's", () => {
    const html = panel("song=twinkle&mode=wait");
    expect(html.match(/<kbd/g)).toHaveLength(2);
    for (const m of html.matchAll(/border-radius:\s*([\d.]+)/g)) expect(Number(m[1])).toBe(0);
    expect(html).toMatch(/border-radius:0/);
  });

  it("says nothing outside Learn mode", () => {
    expect(panel("song=twinkle")).toBe("");
  });
});
