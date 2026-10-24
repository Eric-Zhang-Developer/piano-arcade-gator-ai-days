// Headless proof of piano voice on the fake piano: /play?song=twinkle&voice=4&midi=sim (with test input). The fake
// output must get Program Change [0xC0, 3] before any note at chart time 0 or later, and the restore [0xC0, 0] after
// the results show. Without ?voice, Twinkle sends no Program Change. (The /sim log shows only the fake piano's input,
// so this reads its output's sent list.)
// Usage: node web/src/game/piano-voice/verify-voice.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-voice.mjs --out <dir>");
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
const base = `http://localhost:${port}/play?song=twinkle&midi=sim&input=test`;
say(`verify-voice: starting next dev on ${port}`);
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

async function run(browser, query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(base + query);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true, null, { timeout: 60_000 });
  const chart = await page.evaluate(() => window.__pianoArcade.chart);
  const mpb = 60000 / chart.bpm;
  await page.evaluate(([notes, mpb]) => notes.forEach((n) => window.__pianoArcade.press(n.pitch, n.beat * mpb)), [chart.notes, mpb]);
  await page.waitForFunction(() => window.__pianoArcade.results !== null, null, { timeout: 90_000 });
  await page.waitForTimeout(300);
  const sent = await page.evaluate(async () => {
    const out = [...(await navigator.requestMIDIAccess()).outputs.values()][0];
    return out.sent.map((s) => ({ data: [...s.data], at: s.timestamp ?? null }));
  });
  await page.close();
  return { sent, errors, mpb };
}

const browser = await chromium.launch({ headless: true });
let failed = false;
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    if (i > 240) throw new Error("server not ready after 120 s");
    await new Promise((r) => setTimeout(r, 500));
  }
  const fail = [];
  const { sent, errors } = await run(browser, "&voice=4");
  const pcs = sent.map((s, i) => ({ ...s, i })).filter((s) => (s.data[0] & 0xf0) === 0xc0);
  const kick = sent.findIndex((s) => s.data[0] === 0x99 && s.data[1] === 36); // beat-track's first kick: chart time 0
  if (JSON.stringify(pcs.map((p) => p.data)) !== JSON.stringify([[0xc0, 3], [0xc0, 0]])) fail.push(`program changes ${JSON.stringify(pcs.map((p) => p.data))}`);
  else if (!(kick > pcs[0].i)) fail.push(`voice sent at message ${pcs[0].i}, after the first kick at ${kick}`);
  else if (!(pcs[1].i > kick)) fail.push("restore came before the song");
  fail.push(...errors);
  const plain = await run(browser, "");
  const plainPcs = plain.sent.filter((s) => (s.data[0] & 0xf0) === 0xc0);
  if (plainPcs.length) fail.push(`without ?voice: ${JSON.stringify(plainPcs)}`);
  if (fail.length) throw new Error(fail.join("; "));
  say(`verify-voice: pass, [0xC0, 3] went out at songStart (message ${pcs[0].i}, before the first kick at ${kick}) and [0xC0, 0] after the results (message ${pcs[1].i}); none without ?voice (evidence: ${out})`);
} catch (e) {
  failed = true;
  console.error(`verify-voice: FAIL: ${e.message}`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
