// Headless proof of led-game (spec: led-game). A fake LED board stands in for Web Serial: it answers the hello line
// and records every byte with the chart time. A plain Twinkle take with every note hit on time must light each key
// at least 500 ms before its note, light every hit in PERFECT's color, turn each key off on release, send a heartbeat
// every second, and end with 0xF0 and no hint after the results. With no Web Serial the button says so.
// Starts its own dev server. Usage: node web/src/game/leds/verify-leds.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-leds.mjs --out <dir>");
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
say(`verify-leds: starting next dev on ${port}`);
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
// Before any page script: a granted port whose board prints its PAL1 line once opened.
const fakeBoard = () => {
  window.__ledLog = [];
  const port = {
    async open() {
      let ctl;
      this.readable = new ReadableStream({ start: (c) => (ctl = c) });
      setTimeout(() => ctl.enqueue(new TextEncoder().encode("PAL1 leds=288 bright=80\n")), 300);
      this.writable = new WritableStream({
        write(chunk) {
          window.__ledLog.push({ t: window.__pianoArcade?.now?.() ?? null, m: [...chunk] });
        },
      });
    },
    async close() {},
  };
  Object.defineProperty(navigator, "serial", {
    value: Object.assign(new EventTarget(), { getPorts: async () => [port], requestPort: async () => port }),
  });
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

const browser = await chromium.launch({ headless: true });
const errors = [];
const newPage = async (w, h, init) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.message));
  if (init) await page.addInitScript(init);
  return page;
};
const hex = (m) => m.map((b) => b.toString(16).padStart(2, "0")).join(" ");
try {
  // The start screen: the board connects with no click (Chrome granted it before), at both sizes. The button sits in
  // the closed Options drawer (duo-start), mounted but not shown, so wait for it attached, then open the drawer.
  for (const [w, h] of [[1280, 720], [1920, 1080]]) {
    const page = await newPage(w, h, fakeBoard);
    await goto(page, "/play?song=twinkle");
    const btn = page.getByTestId("connect-lights");
    await btn.waitFor({ state: "attached", timeout: 60_000 });
    const ok = await page.waitForFunction(() => document.querySelector('[data-testid="connect-lights"]')?.dataset.state === "ready", null, { timeout: 10_000 }).then(() => true, () => false);
    check(ok, `${w}×${h} start screen: a granted board connects by itself -> "${await btn.textContent()}"`);
    await page.getByTestId("options-open").click();
    await page.screenshot({ path: join(out, `start-${w}.png`) });
    await page.close();
  }

  // No Web Serial (Safari, Firefox): the button says so, and the take plays as before.
  {
    const page = await newPage(1280, 720, () => delete Navigator.prototype.serial);
    await goto(page, "/play?song=twinkle");
    const btn = page.getByTestId("connect-lights");
    await btn.waitFor({ state: "attached", timeout: 60_000 });
    const text = await btn.textContent();
    check(/Chrome or Edge/.test(text) && (await btn.isDisabled()), `no Web Serial: "${text}", disabled`);
    await page.close();
  }

  // A whole take, every note hit on time.
  const page = await newPage(1280, 720, fakeBoard);
  await goto(page, "/play?song=twinkle&input=test");
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => {
    const c = window.__pianoArcade.chart;
    return c.notes.map((n) => [n.pitch, n.beat * (60000 / c.bpm)]);
  });
  await page.evaluate((notes) => {
    for (const [p, t] of notes) window.__pianoArcade.press(p, t);
  }, chart);
  await page.getByTestId("results").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  const log = await page.evaluate(() => window.__ledLog);
  writeFileSync(join(out, "bytes.txt"), log.map((e) => `${e.t === null ? "-" : Math.round(e.t)}\t${hex(e.m)}`).join("\n"));
  const hints = log.filter((e) => e.m[0] === 0xa0);
  let late = 0;
  for (const [i, [p, t]] of chart.entries()) {
    const prev = chart.slice(0, i).filter(([q]) => q === p).at(-1);
    const lit = hints.filter((e) => e.m[1] === p && e.t !== null && e.t < t).at(-1);
    const since = Math.max(t - 500, prev ? prev[1] : -Infinity);
    if (!lit || lit.m.slice(2).every((v) => v === 0) || lit.t > since) late++;
  }
  check(late === 0, `${chart.length - late} of ${chart.length} notes' keys glowed from 500 ms before (or their last note)`);
  const ons = log.filter((e) => e.m[0] === 0x90);
  const gold = [127, 113, 61];
  check(ons.length === chart.length && ons.every((e) => e.m.slice(2).join() === gold.join()), `${ons.length} key ons, all PERFECT gold (want ${chart.length})`);
  const offs = log.filter((e) => e.m[0] === 0x80).length;
  check(offs >= chart.length, `${offs} key offs on release (want ${chart.length})`);
  const beats = log.filter((e) => e.m[0] === 0xfe).length;
  const lastT = Math.max(...log.map((e) => e.t ?? 0));
  check(beats >= Math.floor(lastT / 1000) - 1, `${beats} heartbeats over ${Math.round(lastT / 1000)} s of take`);
  const after = log.slice(log.findLastIndex((e) => e.m[0] === 0xf0)); // songEnd's clear is the last one
  check(after[0]?.m[0] === 0xf0 && !after.some((e) => e.m[0] === 0xa0 || e.m[0] === 0x90), `the take ends with f0 and lights nothing after (${after.length - 1} later messages, heartbeats only)`);
  await page.screenshot({ path: join(out, "results-1280.png") });
  await page.close();
} catch (e) {
  check(false, `error: ${e.message}`);
} finally {
  await browser.close();
}
check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "result.json"), JSON.stringify({ failures, errors }, null, 2));
say(failures.length ? `verify-leds: FAIL (${failures.length}): ${failures.join("; ")}` : `verify-leds: pass (evidence: ${out})`);
process.exit(failures.length ? 1 : 0);
