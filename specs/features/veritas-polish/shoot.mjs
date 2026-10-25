// Screenshots of /veritas for the polish passes (spec: veritas-polish, Validation): 1280×720 and 1920×1080 with
// motion, each mid-sweep (the first take, 2 s in) and at the end state, plus 1280×720 and 1920×1080 under reduced
// motion, which is the end state at once; each also full page. Against a server you already run (main for
// "before", a pass's branch for "after").
// Usage: node specs/features/veritas-polish/shoot.mjs <base url> <out dir> <tag>
//   e.g. node specs/features/veritas-polish/shoot.mjs http://localhost:3101 specs/features/veritas-polish before
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

// playwright lives in web/node_modules, which Node doesn't search from this folder
const { chromium } = createRequire(new URL("../../../web/package.json", import.meta.url))("playwright");

const [base, outArg, tag] = process.argv.slice(2);
if (!base || !outArg || !tag) {
  console.error("usage: shoot.mjs <base url> <out dir> <tag>");
  process.exit(2);
}
const out = resolve(outArg);
mkdirSync(out, { recursive: true });
const SWEEP_MS = 4000; // the hero's --sweep
const TAKES = 5;

const browser = await chromium.launch();
try {
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    for (const reduced of [false, true]) {
      const name = `${tag}-${w}${reduced ? "-reduced" : ""}`;
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: reduced ? "reduce" : "no-preference" });
      await page.goto(`${base}/veritas`);
      await page.locator("[data-tally]").first().waitFor({ state: "attached", timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready);
      if (!reduced) {
        await page.waitForTimeout(SWEEP_MS / 2);
        await page.screenshot({ path: join(out, `${name}-mid.png`) });
        await page.waitForTimeout(TAKES * SWEEP_MS + 1000); // every take swept and tallied
      }
      await page.screenshot({ path: join(out, `${name}.png`) });
      await page.screenshot({ path: join(out, `${name}-full.png`), fullPage: true });
      process.stdout.write(`shoot: ${name}\n`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
