import { expect, it } from "vitest";
import { isCapture } from ".";

it("?capture=1 turns it on", () => {
  expect(isCapture("?capture=1", null)).toBe(true);
  expect(isCapture("?song=twinkle&capture=1", "0")).toBe(true);
});

it("?capture=0 turns it off, even when stored", () => {
  expect(isCapture("?capture=0", "1")).toBe(false);
});

it("with no param, the stored value decides", () => {
  expect(isCapture("?song=twinkle", "1")).toBe(true);
  expect(isCapture("", "0")).toBe(false);
  expect(isCapture("", null)).toBe(false); // nothing stored, or storage blocked
});
