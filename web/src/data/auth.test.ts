// After Google sign-in the player lands on a page of this site, never on one a crafted link names.
import { describe, expect, it } from "vitest";
import { safeNext } from "./auth";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/progress?song=fur-elise")).toBe("/progress?song=fur-elise");
    expect(safeNext("/play?song=twinkle&hands=R")).toBe("/play?song=twinkle&hands=R");
  });

  it("sends anything else to the menu", () => {
    for (const bad of [null, undefined, "", "https://evil.example", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "progress"])
      expect(safeNext(bad)).toBe("/");
  });
});
