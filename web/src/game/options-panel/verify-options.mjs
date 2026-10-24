// Headless proof of the Options drawer (spec: options-panel), at 1280×720 and 1920×1080, each in a fresh profile:
// 1. On /, O opens it with the focus on the first row; → ten times sets latency +10 ms; Esc closes it and the focus
//    goes back to the song card; /play's slider shows the new value.
// 2. Mute ticked and labels set to Off from the drawer -> on /play, Mute is ticked and __pianoArcadeLabels says off.
// 3. /play's latency slider moved -> back on /, O shows that value.
// Screenshots of the drawer open at both sizes and with reduced motion.
// Usage: node web/src/game/options-panel/verify-options.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-options.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-options: starting next dev on ${port}`);
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
  cwd: webDir,
  detached: true,
  stdio: ["ignore", "ignore", "inherit"],
});
process.on("exit", () => {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

const failures = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};

async function goto(page, path) {
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${base}${path}`);
      return;
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}
const home = async (page) => {
  await goto(page, "/");
  await page.locator('ol a[data-testid^="song-"]').first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(300); // hydration: the O listener is in an effect
};
const focused = (page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute("data-testid") || document.activeElement?.tagName);
const open = (page) => page.evaluate(() => document.querySelector('[data-testid="options"]')?.open === true);
const playLatency = async (page) => {
  await goto(page, "/play?song=twinkle");
  const slider = page.locator('main input[type="range"][min="-150"]');
  await slider.waitFor({ timeout: 60_000 });
  return slider;
};

const browser = await chromium.launch({ headless: true });
const errors = [];
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  const tag = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. O, → ×10, Esc.
  await home(page);
  await page.screenshot({ path: join(out, `closed-${tag}.png`) });
  const card = await focused(page);
  await page.keyboard.press("o");
  await page.waitForTimeout(300);
  check((await open(page)) && (await focused(page)) === "opt-latency", `${tag}: O opens the drawer, focus on the first row (${await focused(page)})`);
  await page.screenshot({ path: join(out, `open-${tag}.png`) });
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  const shown = await page.getByTestId("opt-latency-value").textContent();
  check(shown === "10 ms", `→ ten times: ${shown}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  check(!(await open(page)) && (await focused(page)) === card, `Esc closes it, focus back on ${card} (${await focused(page)})`);
  let slider = await playLatency(page);
  check((await slider.inputValue()) === "10", `/play's slider shows ${await slider.inputValue()}`);

  // 2. Mute and labels Off, by keyboard: ↓ to Mute, Space; ↓↓ to labels, → three times.
  await home(page);
  await page.keyboard.press("o");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  check((await focused(page)) === "opt-mute", `↓↓ reaches Mute (${await focused(page)})`);
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown"); // the last row: stays
  check((await focused(page)) === "opt-labels-off", `labels at Off, and ↓ stops at the last row (${await focused(page)})`);
  await page.keyboard.press("Escape");
  slider = await playLatency(page);
  const muted = await page.getByRole("checkbox", { name: "Mute" }).isChecked();
  const labels = await page.evaluate(() => window.__pianoArcadeLabels?.setting);
  check(muted && labels === "off", `on /play: Mute ${muted}, labels ${labels}`);

  // 3. /play's slider moved, then the drawer shows it.
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  const played = await slider.inputValue();
  await home(page);
  await page.keyboard.press("o");
  await page.waitForTimeout(300);
  const back = await page.getByTestId("opt-latency-value").textContent();
  check(back === `${played} ms`, `the drawer shows /play's ${played}: ${back}`);
  await context.close();
}
const still = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
const sp = await still.newPage();
await home(sp);
await sp.keyboard.press("o");
await sp.waitForTimeout(50); // no slide: it's in place at once
await sp.screenshot({ path: join(out, "open-1920x1080-reduced.png") });
const moving = await sp.evaluate(() => document.querySelector('[data-testid="options"]').getAnimations().length);
check(moving === 0, `reduced motion: the drawer doesn't move (${moving} animation(s))`);
await browser.close();
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);

writeFileSync(join(out, "result.txt"), failures.length ? `fail\n${failures.join("\n")}\n` : "pass\n");
if (failures.length) {
  say(`verify-options: fail, ${failures.length} step(s): ${failures.join("; ")}`);
  process.exit(1);
}
say(`verify-options: pass (evidence: ${out})`);
process.exit(0);
