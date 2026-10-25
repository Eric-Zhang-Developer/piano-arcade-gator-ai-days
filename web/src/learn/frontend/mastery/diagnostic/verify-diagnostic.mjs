// Headless proof of the diagnostic (spec: student-graph, slice X). Its own `next dev`. At 1280×720 on
// /learn/diagnostic?sim, with a fresh learner: answer the first theory item, play the passage on the simulated piano
// after the count-in, reload, check it resumes on the same item, and check the look: square, upright, no gradient,
// nothing under 16px, no verdict, Stop always there. Usage: node web/src/learn/frontend/mastery/diagnostic/verify-diagnostic.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-diagnostic.mjs --out <dir>");
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
say(`verify-diagnostic: starting next dev on ${port}`);
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
let exited = null;
server.once("exit", (code) => (exited = code));
for (let i = 0; ; i++) {
  if (exited !== null) throw new Error(`next dev exited (code ${exited}) before it was ready`);
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    // not up yet
  }
  if (i > 240) throw new Error("server not ready after 120 s");
  await new Promise((r) => setTimeout(r, 500));
}

const failures = [];
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures.push(line);
};

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
const heading = async () => (await page.locator("h1").textContent())?.trim();
const stopShown = async () => page.getByRole("link", { name: "Stop", exact: true }).isVisible();
const noVerdict = async () => (await page.getByText(/^(Correct|Wrong|Right)$|✕|✓/).count()) === 0;
try {
  await page.goto(`${base}/learn/diagnostic?sim`);
  await page.locator("input[type=radio]").first().waitFor({ timeout: 90_000 });
  // Hydration: the radio only answers once React is attached.
  await page.waitForFunction(() => Object.keys(document.querySelector("input[type=radio]")).some((k) => k.startsWith("__react")), null, { timeout: 60_000 });

  const theory = await heading();
  check(Boolean(theory), `a theory item is asked first ("${theory}")`);
  check(await stopShown(), "Stop is shown on the theory item");
  await page.locator("label").first().click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  const playing = page.locator("[data-phase]");
  await playing.waitFor({ timeout: 10_000 });
  const passage = await heading();
  check(passage !== theory, `the next item is a passage to play ("${passage}")`);
  check(await noVerdict(), "the theory answer shows no verdict");
  check(await page.locator("[data-phase] svg[role=img] [data-pitch]").count() > 0, "the passage is on paper before it is played");
  check(await stopShown(), "Stop is shown on the playing item");
  const startButton = page.getByRole("button", { name: "Start", exact: true });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((n) => n.textContent === "Start");
    return b && !b.disabled;
  }, null, { timeout: 10_000 });
  await startButton.click();

  await page.waitForFunction(() => document.querySelector("[data-start-ms]"), null, { timeout: 5_000 });
  check((await page.getByRole("status").textContent()).startsWith("Count-in"), "a count-in comes before listening");
  // Play every note of the passage on the beat, in the page's own clock.
  const beats = await page.evaluate(() => {
    const root = document.querySelector("[data-start-ms]");
    const startMs = Number(root.dataset.startMs);
    const beat = 60000 / Number(root.dataset.bpm);
    const notes = [...root.querySelectorAll("[data-pitch]")].map((n) => n.dataset);
    notes.forEach((n) => {
      const pitch = Number(n.pitch);
      const on = startMs + Number(n.beat) * beat;
      const off = on + (Number(n.beats) - 0.2) * beat;
      setTimeout(() => window.__masteryMidi.push({ data: [0x90, pitch, 80], timeMs: on }), on - performance.now());
      setTimeout(() => window.__masteryMidi.push({ data: [0x80, pitch, 0], timeMs: off }), off - performance.now());
    });
    return { count: Math.max(...notes.map((n) => Number(n.beat) + Number(n.beats))), beat };
  });
  await page.waitForFunction(() => document.querySelector("[role=status]")?.textContent === "Play", null, { timeout: 10_000 });
  check(true, "listening begins after the count-in");
  const waitMs = (4 + beats.count + 1) * beats.beat + 15_000;
  await page.waitForFunction((was) => {
    const h = document.querySelector("h1")?.textContent?.trim();
    return h && h !== was && document.querySelector("[data-phase=saving]") === null;
  }, passage, { timeout: waitMs });
  const third = await heading();
  check(Boolean(third) && third !== passage, `the take is stored and the next item comes ("${third}")`);
  check(await noVerdict(), "the take shows no verdict");

  await page.reload();
  await page.locator("h1").waitFor({ timeout: 60_000 });
  const resumed = await heading();
  check(resumed === third, `a reload resumes on the same item ("${resumed}")`);
  check(await stopShown(), "Stop is shown after resuming");

  const look = await page.evaluate(() => {
    const radius = (el) => (el ? getComputedStyle(el).borderRadius : "missing");
    const panel = document.querySelector("h1").closest("[class*='column']")?.querySelector("[style*='padding']");
    const small = [];
    for (const el of document.querySelectorAll("body *")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const r = el.getBoundingClientRect();
      if (own && r.width && r.height && parseFloat(getComputedStyle(el).fontSize) < 16) small.push(`${el.tagName} ${getComputedStyle(el).fontSize} "${el.textContent.trim().slice(0, 20)}"`);
    }
    const screen = document.querySelector("h1").closest("[class*='screen']");
    return {
      radii: [radius(panel), radius(document.querySelector("button")), radius(document.querySelector("a[href='/learn']"))],
      bg: getComputedStyle(screen).backgroundImage,
      h1: getComputedStyle(document.querySelector("h1")).fontStyle,
      small,
      scrollX: document.documentElement.scrollWidth > innerWidth,
    };
  });
  check(look.radii.every((r) => r === "0px"), `square: panel, button and Stop radius ${look.radii.join(", ")}`);
  check(look.bg === "none", `no gradient behind the panel (${look.bg})`);
  check(look.h1 === "normal", `the prompt is upright (${look.h1})`);
  check(look.small.length === 0, `nothing under 16px${look.small.length ? `: ${look.small.join("; ")}` : ""}`);
  check(!look.scrollX, "no horizontal scroll at 1280");
  await page.screenshot({ path: join(out, "diagnostic.png") });
  say(`verify-diagnostic: screenshot ${join(out, "diagnostic.png")}`);
} catch (e) {
  check(false, e.message.split("\n")[0]);
}
await browser.close();

check(errors.length === 0, errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
if (failures.length) {
  say(`verify-diagnostic: ${failures.length} failed`);
  process.exit(1);
}
say(`verify-diagnostic: pass (evidence: ${out})`);
process.exit(0);
