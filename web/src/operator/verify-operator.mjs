// Headless proof of the operator board, the spec's Chrome steps in order: LIVE with all three screens and every open
// plan:/contract: PR and needs-human issue that `gh` lists right now; a re-fetch after 15 s with at most one collection
// per 60 s (server log); Freeze snapshot, then ?snapshot with every non-local request blocked -> SNAPSHOT, the same
// bookkeeping, no heartbeats, no /api call; keys 1-3. A snapshot.json that was already there is put back afterwards.
// Usage: node web/src/operator/verify-operator.mjs --out <dir>
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-operator.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snapFile = join(webDir, "public/operator/snapshot.json");
const before = existsSync(snapFile) ? readFileSync(snapFile) : null;

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const server = spawn(join(webDir, "node_modules/.bin/next"), ["dev", "--port", String(port)], {
  cwd: webDir,
  detached: true,
  stdio: ["ignore", "pipe", "inherit"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
const collections = () => (log.match(/^operator: collected/gm) ?? []).length;
let browser;
let failed = false;
const check = (ok, line) => {
  say(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failed = true;
};
function cleanup() {
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
  if (before) writeFileSync(snapFile, before);
  else rmSync(snapFile, { force: true });
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

const gh = (...args) => JSON.parse(execFileSync("gh", args, { cwd: webDir, encoding: "utf8" }));
const text = (page, id) => page.locator(`#${id}`).innerText();

try {
  for (let end = Date.now() + 120_000; ; await sleep(500)) {
    if (await fetch(`${base}/operator`).then((r) => r.ok, () => false)) break;
    if (server.exitCode !== null) throw new Error("next dev exited (is another dev server running in web/?)");
    if (Date.now() > end) throw new Error("dev server not up after 120 s");
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. LIVE, gh status, three screens, and what GitHub says needs a person right now.
  await page.goto(`${base}/operator`);
  await page.getByText("● LIVE").waitFor({ timeout: 60_000 });
  await page.locator("#screen-3").waitFor();
  const header = await page.locator("header").innerText();
  check(/gh: (ok · \d+ calls|not logged in|failed)/.test(header), `LIVE header shows the gh status (${header.match(/gh: [^\n]*/)?.[0]})`);
  const needs = await text(page, "screen-1");
  const prs = gh("pr", "list", "--state", "open", "--limit", "200", "--json", "number,title,isDraft");
  const asks = gh("issue", "list", "--state", "open", "--label", "needs-human", "--limit", "200", "--json", "number");
  const want = [
    ...prs.filter((p) => !p.isDraft && /^(plan|contract)(\(|:)/.test(p.title)).map((p) => p.number),
    ...asks.map((i) => i.number),
  ];
  const missing = want.filter((n) => !needs.includes(`#${n} `));
  check(missing.length === 0, `Needs a person lists all ${want.length} open plan/contract PRs and needs-human issues${missing.length ? `; missing #${missing.join(", #")}` : ""}`);
  await page.screenshot({ path: join(out, "operator-live.png"), fullPage: true });

  // 2. The page re-fetches every 15 s; the server collects at most once a minute.
  const fetched = async () => Number((await page.locator("header").innerText()).match(/fetched (\d+) s ago/)?.[1] ?? NaN);
  await sleep(12_000);
  const late = await fetched();
  await sleep(5_000);
  const after = await fetched();
  check(late >= 10 && after < late, `the fetched age resets after a re-fetch (${late} s -> ${after} s)`);
  check(collections() === 1, `one gh collection over 17 s of polling (server log: ${collections()})`);

  // 3. Freeze, then the snapshot with nothing but localhost reachable.
  const liveBooks = await text(page, "screen-3");
  await page.getByRole("button", { name: /Freeze snapshot/ }).click();
  await page.getByText(/Snapshot frozen at/).waitFor({ timeout: 30_000 });
  const frozeAt = Date.now();
  const snap = JSON.parse(readFileSync(snapFile, "utf8"));
  check(snap.heartbeats === null && !JSON.stringify(snap).includes("agent-heartbeats"), "snapshot.json has no heartbeats");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const offline = await ctx.newPage();
  const asked = [];
  await ctx.route("**/*", (route) => {
    const url = route.request().url();
    asked.push(url);
    return new URL(url).hostname === "localhost" ? route.continue() : route.abort("internetdisconnected");
  });
  offline.on("pageerror", (e) => errors.push(e.message));
  await offline.goto(`${base}/operator?snapshot`);
  await offline.getByText("❄ SNAPSHOT").waitFor({ timeout: 30_000 });
  await offline.locator("#screen-3").waitFor();
  const snapBooks = await text(offline, "screen-3");
  check(snapBooks === liveBooks, "SNAPSHOT shows the same bookkeeping as LIVE");
  const crew = await text(offline, "screen-2");
  check(!/ran \d|idle ·|no heartbeat/.test(crew), "SNAPSHOT shows no heartbeats");
  const api = asked.filter((u) => u.includes("/api/"));
  const external = asked.filter((u) => new URL(u).hostname !== "localhost");
  check(api.length === 0 && external.length === 0, `SNAPSHOT made no /api or outside call (${asked.length} requests, all local)`);
  check(!(await offline.locator("[role=status]").innerText().catch(() => "")).includes("No snapshot"), "SNAPSHOT found the frozen file");
  await offline.screenshot({ path: join(out, "operator-snapshot.png"), fullPage: true });

  // 4. Keys 1-3 jump to each screen in turn.
  for (const k of ["1", "2", "3"]) {
    await offline.keyboard.press(k);
    await sleep(300);
    const focused = await offline.evaluate(() => document.activeElement?.id);
    check(focused === `screen-${k}`, `key ${k} -> screen ${k}`);
  }
  // A snapshot from an older board shape shows a banner, not a crash or an endless load.
  writeFileSync(snapFile, JSON.stringify({ at: "2026-10-24T00:00:00Z", features: "old shape" }));
  await offline.reload();
  const bad = await offline.locator("[role=status]").innerText({ timeout: 10_000 }).catch(() => "");
  check(/isn't a board/.test(bad), "a snapshot of the wrong shape shows a banner");
  // Back on the live page: the freeze message outlives the next 15 s poll.
  await sleep(Math.max(0, 16_000 - (Date.now() - frozeAt)));
  check(await page.getByText(/Snapshot frozen at/).isVisible(), "the freeze message survives a re-fetch");
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (e) {
  check(false, String(e?.stack ?? e));
} finally {
  await browser?.close();
}
writeFileSync(join(out, "server.log"), log);
say(failed ? "verify-operator: FAIL" : `verify-operator: pass (screenshots in ${out})`);
process.exit(failed ? 1 : 0);
