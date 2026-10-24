import { describe, expect, it } from "vitest";
import { hitLinePath } from ".";

describe("hitLinePath", () => {
  it("stays within ±3 px of the line, at any time", () => {
    for (let t = -4000; t <= 60000; t += 37) for (const p of hitLinePath(1920, t)) expect(Math.abs(p.dy)).toBeLessThanOrEqual(3);
  });

  it("is the same for the same time", () => {
    expect(hitLinePath(1280, 1234.5)).toEqual(hitLinePath(1280, 1234.5));
  });

  it("moves over time", () => {
    expect(hitLinePath(1280, 0)).not.toEqual(hitLinePath(1280, 300));
  });

  it("spans the whole width", () => {
    const path = hitLinePath(1283, 0);
    expect(path[0].x).toBe(0);
    expect(path.at(-1)!.x).toBe(1283);
  });

  it("is a flat line when still (reduced motion)", () => {
    expect(hitLinePath(1280, 900, true).every((p) => p.dy === 0)).toBe(true);
  });
});
