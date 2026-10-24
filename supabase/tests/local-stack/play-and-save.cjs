// End-to-end: plays Twinkle on laptop keys (one note skipped) against the local stack, then checks /progress. See README.md.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const say = (...a) => process.stdout.write(a.join(" ") + "\n");
const chart = require(require("node:path").resolve(__dirname, "../../../web/public/songs/twinkle/chart.json"));
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  page.on("console", (m) => m.type() === "error" && say("browser error:", m.text()));
  await page.goto("http://localhost:3100/play");
  const codes = ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon"];
  const white = [0, 2, 4, 5, 7, 9, 11], low = Math.min(...chart.notes.map((n) => n.pitch));
  const idx = (p) => Math.floor(p / 12) * 7 + white.indexOf(p % 12);
  const mpb = 60000 / chart.bpm;
  const plan = chart.notes.map((n, i) => ({ code: codes[idx(n.pitch) - idx(low)], at: 4 * mpb + n.beat * mpb + (i % 3) * 12 - 6, skip: i === 5 }));
  await page.evaluate((plan) => {
    window.addEventListener("click", () => {
      const t0 = performance.now();
      for (const p of plan) if (!p.skip) setTimeout(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { code: p.code }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: p.code })), 120);
      }, p.at - (performance.now() - t0));
    }, { capture: true, once: true });
  }, plan);
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByTestId("results").waitFor({ timeout: 60000 });
  const miss = await page.getByTestId("count-MISS").innerText();
  say("results: rank", await page.getByTestId("rank").innerText(), "miss", miss);
  assert.equal(miss, "1");
  await page.waitForTimeout(2000);
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem("pianoArcade.session") || "null")?.user_id);
  assert.ok(token, "an anonymous user was created");
  const outbox = await page.evaluate(() => JSON.parse(localStorage.getItem("pianoArcade.outbox") || "[]"));
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].sent, true, "the server confirmed the take");
  await page.goto("http://localhost:3100/progress");
  await page.getByTestId("take-history").waitFor({ timeout: 10000 });
  assert.equal(await page.locator("[data-testid=take-history] tbody tr").count(), 1);
  say("weak bars:", (await page.getByTestId("weak-bars").innerText()).replace(/\n/g, " | "));
  await page.screenshot({ path: process.env.OUT ? process.env.OUT + "/progress.png" : "progress.png", fullPage: true });
  await page.reload(); await page.getByTestId("take-history").waitFor();
  assert.equal(await page.locator("[data-testid=take-history] tbody tr").count(), 1, "no duplicate after reload");
  say("pass");
  await b.close();
})().catch((e) => { process.stderr.write(String(e && e.stack || e) + "\n"); process.exit(1); });
