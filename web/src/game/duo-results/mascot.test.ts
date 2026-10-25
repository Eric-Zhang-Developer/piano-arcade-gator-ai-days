// The mascot's SVGs (spec: mascot): flat Duo-token paint only, no shading, small. An <img> can't read CSS variables,
// so each file holds the tokens' literal values; this pins them to ui-tokens.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as tokens from "../ui-tokens";
import { duoPanelSettings } from ".";

const pub = new URL("../../../public/", import.meta.url);
const files = ["learning/companion-gator.svg", ...readdirSync(new URL("mascot/", pub)).map((f) => `mascot/${f}`)];
const palette = new Set(Object.values(tokens).filter((v): v is string => typeof v === "string" && v.startsWith("#")));
const maxBytes = 2500; // the largest variant (the pixel sprite) is about 1.9 KB

describe("mascot SVGs", () => {
  it.each(files)("%s paints only Duo tokens, with no gradient, filter or image", (f) => {
    const svg = readFileSync(new URL(f, pub), "utf8");
    expect(svg.length).toBeLessThan(maxBytes);
    expect(svg).not.toMatch(/<(linearGradient|radialGradient|filter|image)\b/);
    const paint = svg.replace(/<mask[\s\S]*?<\/mask>/g, ""); // a mask's black and white cut holes, they aren't paint
    for (const [, v] of paint.matchAll(/(?:fill|stroke)="([^"]+)"/g)) {
      if (v === "none" || v.startsWith("url(")) continue;
      expect(palette, `${f}: ${v}`).toContain(v.toLowerCase());
    }
  });

  it("the default is the select's gator, and the results tutor shows it", () => {
    expect(readFileSync(new URL("learning/companion-gator.svg", pub), "utf8")).toBe(readFileSync(new URL("mascot/a-flat.svg", pub), "utf8"));
    expect(existsSync(new URL(duoPanelSettings.gator.slice(1), pub))).toBe(true);
    expect(duoPanelSettings.gator).toBe("/learning/companion-gator.svg");
  });
});
