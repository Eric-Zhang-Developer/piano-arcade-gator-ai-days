// Headless proof of the student graph end to end (spec: student-graph, slice V). Its own `next dev`. At 1280×720 a
// fresh learner takes the whole diagnostic on /learn/diagnostic?sim (theory answers and passages played on the
// simulated piano), lands on the map with its three colours and a Next activity (the prepared fallback counts), then
// earns a node from attempts seeded in the device store until it is mastered, and two cold failures turn it back to
// in progress. Usage: node web/src/learn/frontend/mastery/verify-mastery.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-mastery.mjs --out <dir>");
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
say(`verify-mastery: starting next dev on ${port}`);
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

// The node earned from seeded attempts: a backbone node with two theory items of three choices each.
const NODE = "chords-triads";
const ITEMS = ["chords-triads-1", "chords-triads-2"];
const ATTEMPTS_KEY = "pianoArcade.mastery.attempts.v1";

const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
const heading = async () => (await page.locator("h1").textContent())?.trim();
const onMap = () => new URL(page.url()).pathname === "/learn";
const mapLabel = () => page.locator("svg[role=group][aria-label^='Your learning map']").getAttribute("aria-label");
const nodeState = (id) => page.locator(`g[data-skill='${id}']`).getAttribute("data-state");
const states = () => page.evaluate(() => [...document.querySelectorAll("g[data-skill]")].map((g) => g.dataset.state));

/** Plays the passage on the beat once Start is pressed, then waits for the next item or the map. */
async function playPassage(passage) {
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((n) => n.textContent === "Start");
    return b && !b.disabled;
  }, null, { timeout: 15_000 });
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("[data-start-ms]"), null, { timeout: 5_000 });
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
  await page.waitForFunction((was) => {
    if (location.pathname === "/learn") return true;
    const h = document.querySelector("h1")?.textContent?.trim();
    return h && h !== was && document.querySelector("[data-phase=saving]") === null;
  }, passage, { timeout: (4 + beats.count + 1) * beats.beat + 15_000 });
}

/** Appends attempts to the device store as the learner on this device, each a minute after the last. */
async function seed(attempts) {
  await page.evaluate(({ key, attempts }) => {
    const list = JSON.parse(localStorage.getItem(key) ?? "[]");
    const last = Math.max(Date.now(), ...list.map((a) => Date.parse(a.at)));
    attempts.forEach((a, i) => list.push({
      id: crypto.randomUUID(),
      learnerId: "local",
      at: new Date(last + (i + 1) * 60_000).toISOString(),
      itemId: a.itemId,
      nodeId: a.nodeId,
      mode: "activity",
      correct: a.correct,
      cold: true,
      helpShare: 0,
      revealed: false,
      kind: "theory",
      details: { choiceId: a.choiceId },
    }));
    localStorage.setItem(key, JSON.stringify(list));
  }, { key: ATTEMPTS_KEY, attempts });
  await page.reload();
  await page.locator("svg[role=group][aria-label^='Your learning map']").waitFor({ timeout: 60_000 });
  // The server paints every node unknown; the device store is read after hydration, and a seeded node has evidence.
  await page.waitForFunction((ids) => ids.every((id) => document.querySelector(`g[data-skill='${id}']`)?.dataset.state !== "unknown"),
    [...new Set(attempts.map((a) => a.nodeId))], { timeout: 30_000 });
}

try {
  // The diagnostic, from a fresh learner to the map.
  await page.goto(`${base}/learn/diagnostic?sim`);
  await page.locator("h1").waitFor({ timeout: 90_000 });
  await page.waitForFunction(() => Object.keys(document.querySelector("h1")).some((k) => k.startsWith("__react")), null, { timeout: 60_000 });
  const asked = { theory: 0, playing: 0 };
  for (let i = 0; i < 60 && !onMap(); i++) {
    const kind = await page.waitForFunction(() => {
      if (location.pathname === "/learn") return "map";
      if (document.querySelector("[data-phase=ready]")) return "playing";
      const radio = document.querySelector("input[type=radio]:not(:disabled)");
      return radio && Object.keys(radio).some((k) => k.startsWith("__react")) ? "theory" : null;
    }, null, { timeout: 30_000 }).then((h) => h.jsonValue());
    if (kind === "map") break;
    if (asked.theory + asked.playing === 0) {
      await page.screenshot({ path: join(out, "diagnostic.png") });
      say(`verify-mastery: screenshot ${join(out, "diagnostic.png")}`);
    }
    const prompt = await heading();
    asked[kind]++;
    if (kind === "playing") {
      await playPassage(prompt);
    } else {
      await page.locator("label").first().click();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForFunction((was) => location.pathname === "/learn" || document.querySelector("h1")?.textContent?.trim() !== was, prompt, { timeout: 15_000 });
    }
  }
  await page.waitForURL((u) => u.pathname === "/learn", { timeout: 30_000 });
  check(asked.theory > 0 && asked.playing > 0, `the diagnostic asked ${asked.theory} theory items and ${asked.playing} passages, then went to the map`);

  // The map after the diagnostic.
  await page.locator("svg[role=group][aria-label^='Your learning map']").waitFor({ timeout: 60_000 });
  const legend = await page.locator("ul[aria-label='Map colours'] li").evaluateAll((lis) => lis.map((li) => li.dataset.state));
  check(["unknown", "in-progress", "mastered"].every((s) => legend.includes(s)), `the legend names the three colours (${legend.join(", ")})`);
  const after = await states();
  check(after.includes("in-progress") && after.includes("unknown"), `the diagnostic paints the map (${after.filter((s) => s === "in-progress").length} in progress, ${after.filter((s) => s === "unknown").length} not yet)`);
  say(`verify-mastery: ${await mapLabel()}`);
  const next = page.locator("aside[aria-label='Your next activity'] button");
  await next.waitFor({ timeout: 20_000 });
  const fallback = await page.getByText("Next isn't connected, so this is the prepared activity.").count();
  check(Boolean(await next.getAttribute("aria-label")), `a next activity is offered: "${await next.getAttribute("aria-label")}"${fallback ? " (prepared fallback)" : ""}`);
  await page.screenshot({ path: join(out, "map.png") });
  say(`verify-mastery: screenshot ${join(out, "map.png")}`);

  // Earn the node: cold successes on both its items until it is promoted to retrieval.
  const before = await nodeState(NODE);
  const right = { "chords-triads-1": "c-e-g", "chords-triads-2": "minor" };
  const wrong = { "chords-triads-1": "c-eflat-g", "chords-triads-2": "major" };
  await seed(Array.from({ length: 8 }, (_, i) => ({ itemId: ITEMS[i % 2], nodeId: NODE, correct: true, choiceId: right[ITEMS[i % 2]] })));
  const earned = await nodeState(NODE);
  check(earned === "mastered", `${NODE} goes from ${before} to mastered after eight cold successes on two items (${earned})`);
  const three = await states();
  check(["unknown", "in-progress", "mastered"].every((s) => three.includes(s)), "the map shows all three colours at once");
  check(/[1-9]\d* mastered/.test(await mapLabel()), `the map's label counts it: "${await mapLabel()}"`);
  await page.screenshot({ path: join(out, "map-mastered.png") });
  say(`verify-mastery: screenshot ${join(out, "map-mastered.png")}`);

  // Two cold failures in retrieval: belief falls under the demote line.
  await seed(ITEMS.map((itemId) => ({ itemId, nodeId: NODE, correct: false, choiceId: wrong[itemId] })));
  const lost = await nodeState(NODE);
  check(lost === "in-progress", `two cold failures turn ${NODE} back to in progress (${lost})`);
  await page.screenshot({ path: join(out, "map-demoted.png") });
  say(`verify-mastery: screenshot ${join(out, "map-demoted.png")}`);
} catch (e) {
  check(false, e.message.split("\n")[0]);
  await page.screenshot({ path: join(out, "failure.png") }).catch(() => {});
}
await browser.close();

check(errors.length === 0, errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
if (failures.length) {
  say(`verify-mastery: ${failures.length} failed`);
  process.exit(1);
}
say(`verify-mastery: pass (evidence: ${out})`);
process.exit(0);
