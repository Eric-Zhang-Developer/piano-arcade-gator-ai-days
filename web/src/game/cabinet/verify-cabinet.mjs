// Headless proof of the cabinet (spec: cabinet, the Chrome steps), with a stand-in DGX in every frame that echoes each
// demo note back to the cabinet 10 ms later:
//   /cabinet?title=3&attract=20 -> the title, attract (playing), the demo playing Twinkle, the title again; the echoes
//   never start a game. (Attract gets 20 s, not the spec's 5: in dev its data takes ~8 s before it can play.) A laptop key during attract opens song select; a piano key starts a game with cabinet=1.
//   A finished ?cabinet=1 game goes back to /cabinet after 30 s with no input.
// Usage: node web/src/game/cabinet/verify-cabinet.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-cabinet.mjs --out <dir>");
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
say(`verify-cabinet: starting next dev on ${port}`);
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
      return await page.goto(`${base}${path}`);
    } catch (e) {
      if (i > 60) throw e;
      await page.waitForTimeout(1000); // the dev server is still starting
    }
  }
}

// Every frame gets a stand-in "Portable Grand", installed as the frame's MIDIOutput so the cabinet can watch its sends.
// It records sends; a note-on sent from inside an iframe (attract or the demo) is echoed 10 ms later as a note-on on
// the top frame's input, as a piano with Local Control on might.
const fakePiano = () => {
  const input = new EventTarget();
  input.name = "Digital Piano Portable Grand";
  input.onmidimessage = null;
  // A real MIDIMessageEvent's timeStamp is when the message arrived, not when the busy page got round to it.
  window.__noteOn = (pitch, at = performance.now()) => {
    const e = new Event("midimessage");
    Object.defineProperty(e, "data", { value: new Uint8Array([0x90, pitch, 64]) });
    Object.defineProperty(e, "timeStamp", { value: at });
    input.dispatchEvent(e);
    input.onmidimessage?.(e);
  };
  window.__sent = [];
  window.__echoes = 0;
  class FakeOutput {
    name = "Digital Piano Portable Grand";
    send(m, timestamp) {
      window.__sent.push([...m]);
      if (window.top !== window && (m[0] & 0xf0) === 0x90 && m[2] > 0) {
        // The piano sounds the note at its timestamp (beat-track queues ahead) and echoes it 10 ms later.
        const wait = Math.max(0, (timestamp ?? performance.now()) - performance.now()) + 10;
        const at = window.top.performance.now() + wait;
        setTimeout(() => {
          window.top.__echoes++;
          window.top.__noteOn(m[1], at);
        }, wait);
      }
    }
    clear() {}
  }
  window.MIDIOutput = FakeOutput;
  const output = new FakeOutput();
  const access = Object.assign(new EventTarget(), { inputs: new Map([["in", input]]), outputs: new Map([["out", output]]) });
  navigator.requestMIDIAccess = () => Promise.resolve(access);
};

// Attract replays the board's merged PRs, which /api/operator gets from `gh`. Where gh fails (not logged in, rate
// limited: CI, #429) the board has none and attract has nothing to play, so this check would test gh, not the cabinet.
// Then attract gets a few stand-in merges; with gh working it replays the real ones.
const standInPrs = (at) =>
  Array.from({ length: 8 }, (_, i) => {
    const t = new Date(Date.parse(at) - (8 - i) * 60_000).toISOString();
    return { number: i + 1, title: `chore: stand-in merge ${i + 1}`, state: "MERGED", createdAt: t, mergedAt: t, closedAt: t, url: `https://github.com/stand-in/repo/pull/${i + 1}`, worker: "stand-in" };
  });
const withMerges = async (route) => {
  try {
    const res = await route.fetch();
    const board = await res.json().catch(() => null);
    if (!board?.at || board.prs?.some((p) => p.mergedAt)) return await route.fulfill({ response: res });
    say(`verify-cabinet: the board has no merged PRs (gh: ${board.gh?.status ?? "?"}); attract gets ${standInPrs(board.at).length} stand-ins`);
    await route.fulfill({ response: res, json: { ...board, prs: standInPrs(board.at) } });
  } catch {
    // the page closed while gh was still answering: nothing left to fulfil
  }
};

const browser = await chromium.launch({ headless: true });
const errors = [];
const fresh = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/operator", withMerges);
  await page.addInitScript(fakePiano);
  return page;
};
const phase = (page) => page.getByTestId("cabinet").getAttribute("data-phase");

// 1. The whole loop.
let page = await fresh();
await goto(page, "/cabinet?title=3&attract=20");
await page.getByTestId("press-any-key").waitFor({ timeout: 60_000 });
check(true, "the title says PRESS ANY KEY");
await page.screenshot({ path: join(out, "cabinet-title.png") });
await page.getByTestId("cabinet-attract").waitFor({ timeout: 10_000 });
const attract = page.frameLocator("[data-testid=cabinet-attract]");
await attract.getByText("Pause").first().waitFor({ timeout: 20_000 });
check(true, "after 3 s idle: attract, playing");
const attrs = await page.getByTestId("cabinet-attract").evaluate((f) => [f.tabIndex, getComputedStyle(f).pointerEvents, f.allow]);
await page.waitForTimeout(3000);
check((await page.evaluate(() => window.__echoes)) > 0 && (await phase(page)) === "attract", `attract plays the piano, and its ${await page.evaluate(() => window.__echoes)} echoes didn't start a game`);
check(attrs[0] === -1 && attrs[1] === "none" && attrs[2] === "midi", `the iframe takes no input and may use MIDI (${attrs.join(", ")})`);
await page.screenshot({ path: join(out, "cabinet-attract.png") });
await page.getByTestId("cabinet-demo").waitFor({ timeout: 25_000 });
check((await page.getByTestId("cabinet-demo").getAttribute("src")).includes("song=twinkle&bot=perfect&audible=1"), "after attract: the demo, Twinkle with the perfect bot, audible");
const demo = page.frameLocator("[data-testid=cabinet-demo]");
await page.waitForTimeout(8000);
await page.screenshot({ path: join(out, "cabinet-demo.png") });
const sent = await page.frames().find((f) => f.url().includes("cabinet=demo")).evaluate(() => window.__sent.filter((m) => m[0] === 0x90 && m[2] > 0).length);
check(sent > 0, `the demo plays on the piano (${sent} note-ons so far)`);
check((await page.evaluate(() => window.__echoes)) > 0 && (await phase(page)) === "demo", `the piano's ${await page.evaluate(() => window.__echoes)} echoes didn't start a game`);
await demo.getByTestId("results").waitFor({ timeout: 60_000 });
const r = await page.frames().find((f) => f.url().includes("cabinet=demo")).evaluate(() => document.querySelector("[data-testid=rank]")?.textContent);
check(r === "S", `the demo finishes with rank ${r}`);
await page.getByTestId("press-any-key").waitFor({ timeout: 15_000 });
check(page.url().endsWith("/cabinet?title=3&attract=20"), "10 s after the results: back to the title");
await page.close();

// 2. A laptop key during attract opens song select.
page = await fresh();
await goto(page, "/cabinet?title=1&attract=30");
await page.getByTestId("cabinet-attract").waitFor({ timeout: 30_000 });
await page.keyboard.press("k");
await page.waitForURL(`${base}/`, { timeout: 15_000 });
check(true, "a laptop key during attract opens song select");
await page.close();

// 3. A piano key on the title starts a game that comes back here.
page = await fresh();
await goto(page, "/cabinet");
await page.getByTestId("press-any-key").waitFor({ timeout: 30_000 });
await page.waitForTimeout(1000); // MIDI access resolves
await page.evaluate(() => window.__noteOn(64));
await page.waitForURL(/\/play\?song=twinkle&cabinet=1$/, { timeout: 15_000 });
check(true, `a piano key starts ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
await page.close();

// 4. A finished cabinet game returns to /cabinet after 30 s with no input (?input=test plays it).
page = await fresh();
await goto(page, "/play?song=twinkle&cabinet=1&input=test&beat=off&stage=off");
await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
const chart = await page.evaluate(() => window.__pianoArcade.chart);
await page.evaluate((notes) => notes.forEach(([p, t]) => window.__pianoArcade.press(p, t)), chart.notes.map((n) => [n.pitch, (n.beat * 60000) / chart.bpm]));
await page.getByTestId("results").waitFor({ timeout: 120_000 });
const shown = Date.now();
await page.waitForURL(`${base}/cabinet`, { timeout: 45_000 });
const after = (Date.now() - shown) / 1000;
check(after >= 29 && after < 40, `a finished cabinet game returns to /cabinet ${after.toFixed(1)} s after its results`);
await page.close();

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
writeFileSync(join(out, "verify-cabinet.json"), JSON.stringify({ failures, errors }, null, 2));
await browser.close();
say(failures.length ? `verify-cabinet: ${failures.length} failed` : "verify-cabinet: all checks passed");
process.exit(failures.length ? 1 : 0);
