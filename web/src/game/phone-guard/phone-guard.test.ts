import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { PHONE_QUERY, phoneGuardSettings } from ".";

it("the CSS shows the card under the same media query the code focuses by", () => {
  const css = readFileSync(new URL("./phone-guard.module.css", import.meta.url), "utf8");
  expect(css).toContain(`@media ${PHONE_QUERY} {`);
});

it("has no video link until Eric gives its URL", () => {
  expect(phoneGuardSettings.videoUrl).toBe("");
});
