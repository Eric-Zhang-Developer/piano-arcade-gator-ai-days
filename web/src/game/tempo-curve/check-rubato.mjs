// Plays Twinkle through /play's test input, slowing steadily from 100% to 80% tempo, and checks the tempo-curve panel
// shows a rubato score above the strict one. Usage: node web/src/game/tempo-curve/check-rubato.mjs <base-url> [out-dir]
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/play?song=twinkle&input=test`);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => {
    const { chart, press } = window.__pianoArcade;
    const mpb = 60000 / chart.bpm;
    const end = Math.max(...chart.notes.map((n) => n.beat * mpb));
    const k = 0.2 / end; // tempo falls linearly to 80%; played time is the integral of 1 / tempo
    for (const n of chart.notes) press(n.pitch, Math.log(1 / (1 - k * n.beat * mpb)) / k);
  });
  const panel = page.locator('[data-testid="tempo-curve"]');
  await panel.waitFor({ timeout: 90_000 });
  await panel.scrollIntoViewIfNeeded();
  if (out) await page.screenshot({ path: `${out}/rubato-slowing.png` });
  const text = (await panel.innerText()).replace(/\s+/g, " ");
  const m = text.match(/Rubato score (\d+)% · strict (\d+)%/);
  if (!m || Number(m[1]) <= Number(m[2])) throw new Error(`want a rubato score above the strict one, got: ${text}`);
  process.stdout.write(`check-rubato: pass: ${text}\n`);
} finally {
  await browser.close();
}
