import { describe, expect, it } from "vitest";
import { controlFor } from ".";

describe("controlFor (piano-controls)", () => {
  it("pauses mid-song from the lowest A or A♯, and lets every other key play", () => {
    expect(controlFor("playing", 21)).toBe("pause");
    expect(controlFor("playing", 22)).toBe("pause");
    expect(controlFor("playing", 23)).toBeNull(); // B0 is in a chart
    expect(controlFor("playing", 60)).toBeNull();
  });
  it("retries, goes to the songs and resumes from the pause menu", () => {
    expect(controlFor("menu", 21)).toBe("retry");
    expect(controlFor("menu", 22)).toBe("songs");
    expect(controlFor("menu", 23)).toBe("resume");
  });
  it("retries or goes to the songs from the results, and does nothing elsewhere", () => {
    expect(controlFor("results", 21)).toBe("retry");
    expect(controlFor("results", 22)).toBe("songs");
    expect(controlFor("results", 23)).toBeNull();
    expect(controlFor("off", 21)).toBeNull();
  });
});
