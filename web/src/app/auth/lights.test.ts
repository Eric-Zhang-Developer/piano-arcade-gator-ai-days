// The sign-in light show stays on the strip, ends dark, and is over in a few seconds.
import { describe, expect, it } from "vitest";
import { signInShow } from "./lights";

describe("signInShow", () => {
  const show = signInShow();

  it("lights only keys on the strip (A0 to C8)", () => {
    const keys = show.filter(([, m]) => m[0] === 0x90 || m[0] === 0x80).map(([, m]) => m[1]);
    expect(Math.min(...keys)).toBeGreaterThanOrEqual(21);
    expect(Math.max(...keys)).toBeLessThanOrEqual(108);
  });

  it("ends with the strip cleared, within four seconds", () => {
    const [last, m] = show[show.length - 1];
    expect(m).toEqual([0xf0]);
    expect(last).toBeLessThan(4000);
  });

  it("is in time order", () => {
    for (let i = 1; i < show.length; i++) expect(show[i][0]).toBeGreaterThanOrEqual(show[i - 1][0]);
  });
});
