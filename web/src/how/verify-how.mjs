// Headless proof of /how (specs/features/how-it-works/spec.md, Validation): the four figures and the incidents, every
// data-value checked against this script's own reading of the snapshot, git and the repo's files, (a) with whatever
// snapshot is there and (b) with fixture-snapshot.json written in place; no request off localhost; screenshots; read
// text at least 24 px at 1920×1080; Tab reaches every link in order; /how/ci's panels and numbers. A snapshot.json
// that was there is put back.
// Usage: node web/src/how/verify-how.mjs --out <dir>
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-how.mjs --out <dir>");
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

// --- the expected values, read and computed here, not imported from data.ts --------------------------------------

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: webDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 });
  } catch {
    return null;
  }
};
const root = git("rev-parse", "--show-toplevel")?.trim() ?? resolve(webDir, "..");
const readOr = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const U = "unknown";
const show = (v) => (v === null || v === undefined ? U : String(v));

const KIND = { feat: "feat", fix: "fix", refactor: "fix", perf: "fix", test: "fix", plan: "plan", contract: "plan" };
const TYPES = ["feat", "fix", "refactor", "perf", "test", "chore", "style", "docs", "contract", "plan", "revert"];
function kind(title) {
  const m = /^([a-z]+)(?:\(([^)]*)\))?!?:\s*\S/.exec(title.trim());
  if (title.trim().startsWith('Revert "') || !m || !TYPES.includes(m[1]) || (m[1] === "feat" && !m[2]?.trim())) return "other";
  return KIND[m[1]] ?? "other";
}
const nyParts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric" });
const nyLabel = (t) => {
  const p = Object.fromEntries(nyParts.formatToParts(t).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.hour} ${p.dayPeriod}`;
};
const NAMED = ["eric-asking-agent", "eric-planning-agent", ...[1, 2, 3, 4, 5, 6].map((n) => `eric-agent-${n}`), "eric-foreman-agent"];

function snapshotValues(b) {
  const e = {};
  const valid = b && typeof b.at === "string" && Array.isArray(b.features) && b.books;
  if (!valid) {
    for (const k of ["at", "mainSha", "medianMergeMin", "totalMerged", "busiest", "gapSec", "fixMin", "buildStamp", "ciBrowser"]) e[k] = U;
    for (const s of ["backlog", "ready", "blocked", "inFlight", "done"]) e[`stage:${s}`] = U;
    for (const w of NAMED) e[`worker:${w}`] = U;
    return e;
  }
  const merged = (b.prs ?? []).filter((p) => p.mergedAt);
  e.at = new Date(b.at).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit" }) + " ET";
  e.mainSha = show(b.mainSha);
  e.medianMergeMin = show(b.books.medianMergeMin);
  e.totalMerged = b.prs ? String(merged.length) : U;
  const states = { backlog: "backlog", ready: "ready", blocked: "blocked", inFlight: "in flight", done: "done" };
  for (const [k, s] of Object.entries(states)) e[`stage:${k}`] = String(b.features.filter((f) => f.state === s).length);
  e.buildStamp = show(b.features.find((f) => f.slug === "build-stamp")?.state);
  e.ciBrowser = show(b.features.find((f) => f.slug === "ci-browser")?.state);
  const per = {};
  for (const p of merged) per[p.worker] = (per[p.worker] ?? 0) + 1;
  for (const w of NAMED) e[`worker:${w}`] = b.prs ? String(per[w] ?? 0) : U;
  for (const [w, n] of Object.entries(per)) if (!NAMED.includes(w)) e[`worker:${w}`] = String(n);
  // Merges per hour: UTC hours from the first merge to the last, empty ones included.
  const H = 3_600_000;
  const hours = new Map();
  const ts = merged.map((p) => Date.parse(p.mergedAt));
  if (ts.length) {
    for (let h = Math.floor(Math.min(...ts) / H) * H; h <= Math.max(...ts); h += H) hours.set(h, { feat: 0, fix: 0, plan: 0, other: 0 });
    for (const p of merged) hours.get(Math.floor(Date.parse(p.mergedAt) / H) * H)[kind(p.title)]++;
  }
  let busiest = null;
  for (const [h, c] of hours) {
    const total = c.feat + c.fix + c.plan + c.other;
    if (!busiest || total > busiest.total) busiest = { h, total };
    for (const [k, n] of Object.entries(c)) e[`hour:${new Date(h).toISOString()}:${k}`] = String(n);
  }
  e.busiest = busiest ? `${nyLabel(busiest.h)} (${busiest.total})` : U;
  const at = (n) => {
    const p = (b.prs ?? []).find((x) => x.number === n);
    return p?.mergedAt ? Date.parse(p.mergedAt) : null;
  };
  const [a, c, fix] = [at(387), at(391), at(397)];
  const ok = a !== null && c !== null && fix !== null;
  e.gapSec = ok ? String(Math.round(Math.abs(c - a) / 1000)) : U;
  e.fixMin = ok ? String(Math.round((fix - Math.max(a, c)) / 60_000)) : U;
  return e;
}

function repoValues() {
  const e = {};
  const count = (t) => (t.match(/\n/g)?.length ?? 0) + (t && !t.endsWith("\n") ? 1 : 0);
  const known = (src) => {
    const m = src && /KNOWN_RED\s*=\s*\{([\s\S]*?)\}/.exec(src);
    return m ? String(m[1].match(/^\s*"[^"]+"\s*:\s*\d+/gm)?.length ?? 0) : U;
  };
  const sha433 = git("log", "-1", "--format=%H", "--grep=(#433)$")?.trim();
  e.knownRedFirst = known(sha433 ? git("show", `${sha433}:web/e2e/run-checks.mjs`) : null);
  e.knownRedNow = known(readOr(join(root, "web/e2e/run-checks.mjs")));
  const owners = (readOr(join(root, ".github/CODEOWNERS")) ?? "")
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim().split(/\s+/))
    .filter((p) => p.length >= 2)
    .map(([p, o]) => [p.replace(/^\//, ""), o]);
  const lanesMd = (readOr(join(root, "AGENTS.md")) ?? "").split(/^## Lanes$/m)[1]?.split(/^## /m)[0] ?? "";
  const lanes = lanesMd
    .split("\n")
    .filter((l) => l.startsWith("|") && !/^\|\s*(-|Person\s*\|)/.test(l))
    .map((l) => l.split("|").slice(1, -1))
    .filter((c) => c.length >= 4)
    .map((c) => [c[0].replace(/`/g, "").trim(), [...c[3].matchAll(/`([^`]+)`/g)].map((m) => m[1])]);
  const listed = git("-C", root, "ls-files", "web/src");
  if (!listed) return e;
  const lines = {};
  for (const path of listed.split("\n").filter(Boolean)) {
    const text = readOr(join(root, path));
    if (text === null) continue;
    const parts = path.split("/"); // web, src, ...
    let folder;
    if (parts.length === 3) folder = "web/src/";
    else if (parts[2] === "app") folder = parts.length === 4 ? "web/src/app/" : `web/src/app/${parts[3]}/`;
    else folder = `web/src/${parts[2]}/`;
    lines[folder] = (lines[folder] ?? 0) + count(text);
  }
  for (const [folder, n] of Object.entries(lines)) {
    e[`folder:${folder}:lines`] = String(n);
    const hit = owners.filter(([p]) => folder.startsWith(p)).sort((x, y) => y[0].length - x[0].length)[0];
    e[`folder:${folder}:owner`] = hit ? hit[1] : (lanes.find(([, fs]) => fs.some((f) => folder.startsWith(f)))?.[0] ?? "no owner listed");
  }
  return e;
}

// Every data-value on the page against `want`; keys of a family (hour:, folder:, worker:) the page has and `want`
// lacks are extra rows, which fail too.
// /how/ci's expected values, computed here from ci-snapshot.json, not imported from ci.ts.
function ciValues() {
  const snap = JSON.parse(readFileSync(new URL("./ci-snapshot.json", import.meta.url), "utf8"));
  const end = Math.round((Date.parse(snap.at) - Date.parse(snap.since)) / 1000);
  const cut = snap.marks.find((m) => m.n === 687)?.t ?? null;
  const before = (t) => cut === null || t < cut;
  let peak = 0;
  for (let t = 0; t < end && before(t); t += 300) {
    const running = snap.jobs.filter((j) => j[1] === 1 && j[3] !== null && j[3] <= t && t < (j[4] ?? end)).length;
    peak = Math.max(peak, running);
  }
  // A green PR run's time: its jobs' first queued to last completed.
  const green = [];
  snap.runs.forEach((r, i) => {
    if (r[0] !== "pull_request" || r[5] !== "success") return;
    const js = snap.jobs.filter((j) => j[0] === i);
    const from = Math.min(...js.map((j) => j[2] ?? Infinity));
    if (!js.length || js.some((j) => j[4] === null) || !Number.isFinite(from)) return;
    const to = Math.max(...js.map((j) => j[4]));
    if (to >= from) green.push({ t: from, min: Math.round(((to - from) / 60) * 10) / 10 });
  });
  const mins = green.filter((r) => before(r.t)).map((r) => r.min).sort((a, b) => a - b);
  const after = cut === null ? [] : green.filter((r) => r.t >= cut);
  const measuring = cut === null || end - cut < 3 * 3600 || after.length < 3;
  const want = {
    peakRunningBefore: show(peak || null),
    greenBeforeN: show(mins.length || null),
    greenBeforeMedian: mins.length ? `${mins[Math.ceil(mins.length / 2) - 1]} min` : U,
    greenBeforeMax: mins.length ? `${mins.at(-1)} min` : U,
  };
  if (measuring) for (const k of ["flightAfter", "greenAfter", "mergesAfter", "cellAfter"]) want[k] = "measuring";
  const start = Date.parse(snap.since);
  for (let ms = Math.ceil(start / 3_600_000) * 3_600_000; ms + 3_600_000 <= start + end * 1000; ms += 3_600_000) {
    const t = (ms - start) / 1000;
    const label = new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric" });
    want[`merges:${label}`] = String(snap.merges.filter((m) => m >= t && m < t + 3600).length);
  }
  return { want, measuring };
}

async function compare(page, want, label) {
  const got = Object.fromEntries(await page.$$eval("[data-value]", (els) => els.map((el) => [el.dataset.value, el.dataset.n])));
  const wrong = Object.entries(want).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k}: page ${got[k]}, expected ${v}`);
  const extra = Object.keys(got).filter((k) => /^(hour|folder|worker):/.test(k) && !(k in want));
  check(wrong.length === 0 && extra.length === 0, `${label}: ${Object.keys(want).length} values match${wrong.length ? `; ${wrong.slice(0, 8).join("; ")}` : ""}${extra.length ? `; extra ${extra.join(", ")}` : ""}`);
}

const outside = [];
const watch = (page) =>
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") outside.push(r.url());
  });

try {
  for (let end = Date.now() + 180_000; ; await sleep(500)) {
    if (await fetch(`${base}/how`).then((r) => r.ok, () => false)) break;
    if (server.exitCode !== null) throw new Error("next dev exited (is another dev server running in web/?)");
    if (Date.now() > end) throw new Error("dev server not up after 180 s");
  }
  browser = await chromium.launch({ headless: true });
  const errors = [];
  const open = async (opts) => {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    watch(page);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/how`);
    await page.locator("section[data-incidents]").waitFor({ timeout: 60_000 });
    return page;
  };
  const repo = repoValues();

  // (a) Whatever snapshot is there (none: every snapshot value reads unknown).
  const big = await open({ viewport: { width: 1920, height: 1080 } });
  for (const v of ["who", "life", "lanes", "time"]) {
    const fig = big.locator(`figure[data-visual="${v}"]`);
    check((await fig.count()) === 1 && (await fig.locator("svg").count()) >= 1 && (await fig.locator("details").count()) >= 1, `figure ${v} has an SVG and a <details>`);
  }
  check((await big.locator("section[data-incidents] article").count()) === 3, "section[data-incidents] has three items");
  check((await big.title()) === "How it works · Piano Arcade", `title "${await big.title()}"`);
  const current = before ? JSON.parse(before.toString("utf8")) : null;
  await compare(big, { ...snapshotValues(current), ...repo }, `(a) ${before ? "the snapshot on disk" : "no snapshot"}`);

  // Read text: CSS size times the SVG's scale, at least 24 px at 1920×1080.
  const small = await big.$$eval("[data-read]", (els) =>
    els
      .map((el) => {
        const svg = el.closest("svg");
        const scale = svg ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
        return [el.textContent.trim().slice(0, 40), Math.round(parseFloat(getComputedStyle(el).fontSize) * scale * 10) / 10];
      })
      .filter(([, px]) => px < 24),
  );
  check(small.length === 0, `every [data-read] is at least 24 px at 1920×1080${small.length ? `; under: ${JSON.stringify(small.slice(0, 6))}` : ""}`);
  check((await big.locator("[data-read]").count()) > 40, "the page marks its read text with data-read");
  await big.screenshot({ path: join(out, "how-1920.png"), fullPage: true });

  // Keyboard: Tab from the top meets every link, in document order.
  const links = await big.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") + " " + a.textContent));
  const tabbed = [];
  await big.evaluate(() => document.activeElement?.blur());
  for (let i = 0; i < links.length + 40; i++) {
    await big.keyboard.press("Tab");
    const a = await big.evaluate(() => (document.activeElement?.matches("a[href]") ? document.activeElement.getAttribute("href") + " " + document.activeElement.textContent : null));
    if (a && tabbed.at(-1) !== a) tabbed.push(a);
    if (tabbed.length === links.length) break;
  }
  check(JSON.stringify(tabbed) === JSON.stringify(links), `Tab reaches all ${links.length} links in reading order${tabbed.length !== links.length ? ` (reached ${tabbed.length})` : ""}`);
  const ring = await big.evaluate(() => {
    const a = document.querySelector("main a[href]");
    a.focus();
    const s = getComputedStyle(a);
    return `${s.outlineStyle} ${s.outlineWidth}`;
  });
  check(ring.startsWith("solid") && parseFloat(ring.split(" ")[1]) >= 2, `a focused link has a visible ring (${ring})`);

  const small1280 = await open({ viewport: { width: 1280, height: 720 } });
  const scroll = await small1280.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(scroll <= 0, `no horizontal scroll at 1280×720 (${scroll} px over)`);
  await small1280.screenshot({ path: join(out, "how-1280.png"), fullPage: true });
  const reduced = await open({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
  await reduced.screenshot({ path: join(out, "how-1920-reduced-motion.png"), fullPage: true });

  // (b) The fixture written in place.
  const fixture = JSON.parse(readFileSync(new URL("./fixture-snapshot.json", import.meta.url), "utf8"));
  writeFileSync(snapFile, JSON.stringify(fixture));
  await big.reload();
  await big.locator("section[data-incidents]").waitFor();
  await compare(big, { ...snapshotValues(fixture), ...repo }, "(b) the fixture snapshot");
  check(
    (await big.locator('[data-value="hour:2026-10-24T14:00:00.000Z:feat"]').getAttribute("data-n")) === "0",
    "(b) the empty hour between two busy ones is drawn with zeros",
  );

  // /how/ci: three panels, the tab row on both pages, numbers from the committed CI snapshot, "after" still measuring.
  check((await big.locator('nav a[href="/how/ci"]').count()) === 1, "/how links the CI tab");
  const ci = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  watch(ci);
  ci.on("pageerror", (e) => errors.push(e.message));
  await ci.goto(`${base}/how/ci`);
  await ci.locator('section[data-visual="merges"]').waitFor({ timeout: 60_000 });
  for (const v of ["flight", "green", "merges"]) {
    const sec = ci.locator(`section[data-visual="${v}"]`);
    check((await sec.locator("svg").count()) === 1 && (await sec.locator("ul li").count()) >= 4, `/how/ci ${v} has an SVG and four beats`);
  }
  check((await ci.locator('nav a[href="/how"]').count()) === 1, "/how/ci links back to /how");
  const civ = ciValues();
  await compare(ci, civ.want, `/how/ci${civ.measuring ? ", after still measuring" : ""}`);
  check(!(await ci.content()).includes("NaN"), "/how/ci shows no NaN");
  await ci.screenshot({ path: join(out, "how-ci-1920.png"), fullPage: true });

  check(outside.length === 0, `no request off localhost${outside.length ? `: ${outside.slice(0, 5).join(", ")}` : ""}`);
  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (e) {
  check(false, String(e?.stack ?? e));
} finally {
  await browser?.close();
}
writeFileSync(join(out, "server.log"), log);
say(failed ? "verify-how: FAIL" : `verify-how: pass (screenshots in ${out})`);
process.exit(failed ? 1 : 0);
