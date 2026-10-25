import { describe, expect, it } from "vitest";
import { nextForText, nextForUrl, readNextFor } from "./next-for";

const store = (v: Record<string, string>) => ({ getItem: (k: string) => v[k] ?? null });

describe("Next for you", () => {
  it("reads what duo-results saved for this song", () => {
    const s = store({ "pianoArcade.nextFor.fur-elise": JSON.stringify({ song: "fur-elise", from: 9, to: 12, hand: "L" }) });
    expect(readNextFor(s, "fur-elise")).toEqual({ song: "fur-elise", from: 9, to: 12, hand: "L" });
    expect(readNextFor(s, "twinkle")).toBeNull();
  });

  it("anything missing, unreadable or malformed is no suggestion", () => {
    const key = "pianoArcade.nextFor.x";
    for (const v of ["not json", "null", JSON.stringify({ song: "y", from: 1, to: 2 }), JSON.stringify({ song: "x", from: 0, to: 2 }), JSON.stringify({ song: "x", from: 5, to: 2 }), JSON.stringify({ song: "x", from: 1.5, to: 2 })])
      expect(readNextFor(store({ [key]: v }), "x")).toBeNull();
    expect(readNextFor(null, "x")).toBeNull();
    expect(readNextFor({ getItem: () => { throw new Error("blocked"); } }, "x")).toBeNull();
  });

  it("says the bars and the hand, and opens bar-loop on them at 70%", () => {
    expect(nextForText({ song: "a", from: 9, to: 12, hand: "L" })).toBe("Next for you: bars 9–12, left hand");
    expect(nextForText({ song: "a", from: 3, to: 3, hand: null })).toBe("Next for you: bar 3");
    expect(nextForUrl({ song: "fur-elise", from: 9, to: 12, hand: "L" })).toBe("/play?song=fur-elise&from=9&to=12&tempo=70");
  });
});
