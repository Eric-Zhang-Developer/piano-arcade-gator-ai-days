import { describe, expect, it } from "vitest";
import { stampText } from "./stamp";

const at = "2026-10-24T06:00:00Z";
const t0 = Date.parse(at);
const s = 1000;
const m = 60 * s;
const h = 60 * m;
const text = (ms: number) => stampText("a1b2c3d", at, t0 + ms);

describe("stampText", () => {
  it("counts minutes, then hours, then days, rounded down", () => {
    expect(text(0).text).toBe("a1b2c3d · 0 min old");
    expect(text(59 * s).text).toBe("a1b2c3d · 0 min old");
    expect(text(59 * m).text).toBe("a1b2c3d · 59 min old");
    expect(text(60 * m).text).toBe("a1b2c3d · 1 h old");
    expect(text(47 * h).text).toBe("a1b2c3d · 47 h old · behind main?");
    expect(text(48 * h).text).toBe("a1b2c3d · 2 d old · behind main?");
  });

  it("is stale only past 120 min, and says so in words", () => {
    expect(text(120 * m)).toEqual({ text: "a1b2c3d · 2 h old", stale: false });
    expect(text(120 * m + s)).toEqual({ text: "a1b2c3d · 2 h old · behind main?", stale: true });
  });

  it("treats a commit in the future as 0, and no SHA or time as an unknown build", () => {
    expect(text(-5 * m)).toEqual({ text: "a1b2c3d · 0 min old", stale: false });
    expect(stampText(null, at, t0)).toEqual({ text: "unknown build", stale: false });
    expect(stampText("a1b2c3d", null, t0)).toEqual({ text: "unknown build", stale: false });
  });
});
