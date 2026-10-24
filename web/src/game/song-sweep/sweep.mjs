// Song sweep (spec: song-sweep): a rank-a bot plays every song on / at 1920×1080, and one HTML contact sheet shows
// six frames per song (start, 25/50/75% judged, first fever, results) with each song's console errors. It fixes
// nothing; a person or an agent reads the sheet and files issues.
// Usage: node web/src/game/song-sweep/sweep.mjs [--base <url>] [--out <dir>] [--song <id>]... [--params <query>]
// Exit: 0 every song reached its results with no pageerror; 1 otherwise (names the songs); 2 build, browser or server.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const say = (s) => process.stdout.write(`${s}\n`);
const die = (s) => {
  say(`sweep: ${s}`);
  process.exit(2);
};

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = args.flatMap((a, i) => (args[i - 1] === "--song" ? [a] : []));
const git = (...a) => execFileSync("git", a, { cwd: webDir, encoding: "utf8" }).trim();
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const out = resolve(opt("--out") ?? join(git("rev-parse", "--path-format=absolute", "--git-common-dir"), "agent-evidence/song-sweep", stamp));
const commit = git("rev-parse", "--short", "HEAD");
const query = new URLSearchParams("bot=rank-a&labels=notes&capture=1");
for (const [k, v] of new URLSearchParams(opt("--params") ?? "")) query.set(k, v);

let server = null;
process.on("exit", () => {
  try {
    if (server) process.kill(-server.pid, "SIGTERM");
  } catch {
    // already gone
  }
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(1));

const reachable = async (url, ms) => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return r.ok;
  } catch {
    return false;
  }
};

let base = opt("--base");
if (base) {
  if (!(await reachable(base, 3000))) die(`${base} isn't reachable`);
} else {
  say("sweep: next build");
  try {
    execFileSync(join(webDir, "node_modules/.bin/next"), ["build"], { cwd: webDir, stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    die("next build failed");
  }
  const port = await new Promise((res, rej) => {
    const s = createServer().once("error", rej);
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
  base = `http://localhost:${port}`;
  say(`sweep: next start on ${port}`);
  server = spawn(join(webDir, "node_modules/.bin/next"), ["start", "--port", String(port)], { cwd: webDir, detached: true, stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) up = (await reachable(base, 1000)) || (await new Promise((r) => setTimeout(r, 1000)), false);
  if (!up) die(`next start on ${port} never answered`);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  die(`can't launch Chromium (pnpm -C web exec playwright install chromium): ${e.message.split("\n")[0]}`);
}
mkdirSync(out, { recursive: true });

// The song list, in its order on /.
const home = await browser.newPage();
await home.goto(base);
await home.waitForSelector('a[data-testid^="song-"]', { timeout: 60_000 });
const listed = await home.$$eval('a[data-testid^="song-"]', (as) => as.map((a) => a.dataset.testid.slice("song-".length)));
await home.close();
const songs = only.length ? only : listed;
for (const id of only) if (!listed.includes(id)) say(`sweep: ${id} isn't on /; sweeping it anyway`);

const SHOTS = ["start", "25", "50", "75", "fever", "results"];
const rows = [];
for (const id of songs) {
  const chart = await (await fetch(`${base}/songs/${id}/chart.json`)).json();
  const total = chart.notes.length;
  const lengthMs = (Math.max(...chart.notes.map((n) => n.beat + n.duration)) * 60000) / chart.bpm;
  const row = { id, shots: {}, rank: "no results", errors: [], pageerror: false, timedOut: false };
  rows.push(row);
  mkdirSync(join(out, id), { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("console", (m) => m.type() === "error" && row.errors.push(`console.error: ${m.text()}`));
  page.on("pageerror", (e) => {
    row.errors.push(`pageerror: ${e.message}`);
    row.pageerror = true;
  });
  const shoot = async (name, judged, fullPage = false) => {
    await page.screenshot({ path: join(out, id, `${name}.png`), fullPage });
    row.shots[name] = { judged };
  };
  const state = () =>
    page.evaluate(() => {
      const h = window.__pianoArcadeHud;
      return {
        judged: h ? h.PERFECT + h.GREAT + h.GOOD + h.MISS : 0,
        fever: window.__pianoArcadeFeverGauge?.fever === true,
        results: !!document.querySelector('[data-testid="results"]'),
      };
    });
  try {
    await page.goto(`${base}/play?song=${encodeURIComponent(id)}&${query}`);
    const start = page.getByRole("button", { name: "Start" });
    await start.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500); // the stage card's sweep in
    await shoot("start", 0);
    await start.click();
    const deadline = Date.now() + lengthMs + 60_000;
    const quarters = [25, 50, 75];
    for (;;) {
      const s = await state();
      while (quarters.length && s.judged >= (quarters[0] / 100) * total) await shoot(String(quarters.shift()), s.judged);
      if (s.fever && !row.shots.fever) await shoot("fever", s.judged);
      if (s.results) {
        await page.waitForTimeout(3000); // the tally and the rank stamp settle
        await shoot("results", s.judged, true);
        row.rank = (await page.getByTestId("rank").textContent().catch(() => null))?.trim() || "no rank";
        break;
      }
      if (Date.now() > deadline) {
        row.timedOut = true;
        break;
      }
      await page.waitForTimeout(100);
    }
  } catch (e) {
    row.errors.push(`sweep: ${e.message.split("\n")[0]}`);
  }
  await page.close();
  say(`sweep: ${id} -> ${row.timedOut ? "timed out" : row.rank}${row.shots.fever ? "" : ", no fever"}, ${row.errors.length} error line(s)`);
}
const version = browser.version();
await browser.close();

// The contact sheet: relative links, so the folder opens anywhere.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const cell = (row, name) => {
  const shot = row.shots[name];
  if (!shot) return `<td class="none">${name === "fever" ? "no fever" : row.timedOut ? "timed out" : "no shot"}</td>`;
  const src = `${encodeURI(row.id)}/${name}.png`;
  return `<td><a href="${src}"><img src="${src}" loading="lazy" alt="${esc(row.id)} ${name}"></a><span>${name} · ${shot.judged} judged</span></td>`;
};
const failed = rows.filter((r) => r.timedOut || r.rank === "no results" || r.pageerror);
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Song sweep ${commit}</title>
<style>
body{background:#000;color:#f2f2f5;font:14px system-ui,sans-serif;margin:24px}
h1{font-size:20px;margin:0 0 4px}header p{margin:2px 0;color:#aaa}
table{border-collapse:collapse;margin-top:16px}th,td{border-top:1px solid #333;padding:8px;vertical-align:top;text-align:left}
td img{display:block;width:240px;border:1px solid #333}td span{display:block;margin-top:4px;color:#aaa;font-size:12px}
td.none{width:240px;color:#c98a9a}.bad{color:#ff4d5e}ul{margin:0;padding-left:16px;max-width:320px;font:12px ui-monospace,monospace}
</style>
<header><h1>Song sweep</h1>
<p>Commit ${esc(commit)} · ${esc(base)} · <code>${esc(query)}</code> · Chromium ${esc(version)}</p>
<p>${rows.length} song(s); ${failed.length ? `<span class="bad">failed: ${esc(failed.map((r) => r.id).join(", "))}</span>` : "every song reached its results"}</p></header>
<table><tr><th>Song</th>${SHOTS.map((s) => `<th>${s}</th>`).join("")}<th>Errors</th></tr>
${rows
  .map(
    (r) =>
      `<tr><th>${esc(r.id)}<br><span class="${failed.includes(r) ? "bad" : ""}">${r.timedOut ? "timed out" : esc(r.rank)}</span></th>${SHOTS.map((s) => cell(r, s)).join("")}<td>${
        r.errors.length ? `<ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : "none"
      }</td></tr>`,
  )
  .join("\n")}
</table>`,
);
if (failed.length) say(`sweep: fail: ${failed.map((r) => `${r.id} (${r.timedOut ? "timed out" : r.pageerror ? "pageerror" : "no results"})`).join(", ")}`);
say(join(out, "index.html"));
process.exit(failed.length ? 1 : 0);
