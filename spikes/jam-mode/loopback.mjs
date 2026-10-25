// The jam spike's IAC loopback run (spec Validation 2): serve the repo, open the page with ?loopback=1 in Chromium
// (the desktop app's browser refuses Web MIDI), let it play the scripted progression through IAC Driver Bus 1, then
// save its log to local/ and print the table for FINDINGS.md. One run; take the verify lock:
//   python3 .agents/scripts/verify.py --slug jam-mode-spike --worktree . --cmd "node spikes/jam-mode/loopback.mjs --out {out}"
// Analyse a saved log again: node spikes/jam-mode/loopback.mjs --log spikes/jam-mode/local/<file>.json
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../..");
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const say = (s) => process.stdout.write(`${s}\n`);

const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const rootOf = (name) => NAMES.indexOf(name.match(/^[A-G][♯♭]?/)[0]);
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q) => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
  return s.length ? { n: s.length, median: at(0.5), p95: at(0.95), max: s.at(-1) } : { n: 0 };
};
const ms = (x) => (x === undefined ? "–" : x.toFixed(1));

/** The FINDINGS.md table from one loopback log. */
export function analyse(log) {
  const { lookaheadMs: ahead, bpm } = log.meta;
  const beat = 60_000 / bpm;
  const ons = (ch) => log.inputs.filter(([, d]) => d[0] === (0x90 | ch) && d[2] > 0);
  const keys = ons(0);

  // Each strike: when it arrived, and the name it settled on (the last change within 50 ms of its first key).
  const strikes = log.meta.strikes.map((s) => {
    const arrived = keys.find(([t]) => t >= s.at - 2)?.[0];
    const settled = log.changes.filter((c) => c.at >= arrived && c.at <= arrived + 50).at(-1);
    return { ...s, arrived, settledAt: settled?.at, got: settled?.name };
  });
  const named = strikes.filter((s) => s.got === s.name).length;

  // Bass notes: the band's sent 8ths with a root, in order, against what came back on channel 2.
  const sent = log.sent.filter((s) => s.root !== null);
  const back = ons(1);
  const eighth = beat / 2;
  const bass = sent.map((s, i) => ({ ...s, arrived: back[i]?.[0], pc: back[i] ? back[i][1][1] % 12 : null, beatAt: s.eighth % 2 ? s.at - eighth : s.at }));
  const jitter = bass.filter((b) => b.arrived !== undefined).map((b) => Math.abs(b.arrived - b.at));

  // Right root: the latest strike settled at least the lookahead before the note's beat. A strike settled inside the
  // lookahead of that beat may go either way, so its beat counts apart.
  let right = 0, wrong = 0, either = 0;
  for (const b of bass) {
    const before = strikes.filter((s) => s.settledAt !== undefined && s.settledAt <= b.beatAt - ahead).at(-1);
    const inside = strikes.some((s) => s.settledAt > b.beatAt - ahead && s.settledAt <= b.beatAt);
    if (!before) continue;
    if (inside) either++;
    else if (b.pc === rootOf(before.name)) right++;
    else wrong++;
  }

  // Change to follow: strike arrival to the first bass note back on the new root. A change that keeps the root
  // (Cmaj7 to C) is left out: the bass is already there.
  const follow = [];
  let sameRoot = 0;
  strikes.forEach((s, i) => {
    if (i > 0 && rootOf(strikes[i - 1].name) === rootOf(s.name)) return void sameRoot++;
    const first = bass.find((b) => b.arrived > s.arrived && b.pc === rootOf(s.name));
    if (first) follow.push(first.arrived - s.arrived);
  });

  // Stuck notes: a note-on from the band (channel 2 or 10) arriving after the last All Notes Off.
  const offs = log.inputs.filter(([, d]) => (d[0] === 0xb1 || d[0] === 0xb9) && d[1] === 123).map(([t]) => t);
  const lastOff = Math.max(...offs);
  const bandOns = [...ons(1), ...ons(9)].map(([t]) => t);
  const stuck = bandOns.filter((t) => t > lastOff).length;
  const afterFirstOff = bandOns.filter((t) => t > Math.min(...offs)).length;

  return { strikes, named, bassNotes: bass.length, right, wrong, either, follow: stats(follow), followBound: beat + ahead, sameRoot, jitter: stats(jitter), offs: offs.length, stuck, afterFirstOff, sentBack: back.length, sentCount: sent.length };
}

function table(a) {
  return [
    `| Measure | Result |`,
    `|---|---|`,
    `| Changes named right | ${a.named} of ${a.strikes.length} |`,
    `| Bass notes on the right root | ${a.right} of ${a.right + a.wrong} that had to follow (${a.either} more inside a change's lookahead, either root allowed) |`,
    `| Change to follow, ms (${a.follow.n} changes) | median ${ms(a.follow.median)}, p95 ${ms(a.follow.p95)}, max ${ms(a.follow.max)} (bar: ${a.followBound}) |`,
    `| Send jitter, ms (arrival − send timestamp, ${a.jitter.n} bass notes) | median ${ms(a.jitter.median)}, p95 ${ms(a.jitter.p95)}, max ${ms(a.jitter.max)} |`,
    `| Bass notes sent / back | ${a.sentCount} / ${a.sentBack} |`,
    `| All Notes Off back | ${a.offs} (expected 4) |`,
    `| Band notes after the last All Notes Off (stuck) | ${a.stuck} (${a.afterFirstOff} after the first) |`,
  ].join("\n");
}

async function run(out) {
  const types = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript" };
  const server = createServer((req, res) => {
    const p = normalize(join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)));
    if (!p.startsWith(root)) return res.writeHead(403).end();
    try {
      const file = p.endsWith("/") ? join(p, "index.html") : p;
      res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://localhost:${server.address().port}/spikes/jam-mode/?loopback=1`;
  const { chromium } = createRequire(join(root, "web/package.json"))("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    await context.grantPermissions(["midi", "midi-sysex"], { origin: new URL(url).origin });
    const page = await context.newPage();
    page.on("pageerror", (e) => say(`page error: ${e.message}`));
    say(`loopback: ${url}`);
    await page.goto(url);
    await page.waitForFunction(() => window.__jamLog || window.__jamError, null, { timeout: 200_000, polling: 1000 });
    const err = await page.evaluate(() => window.__jamError);
    if (err) throw new Error(err);
    const log = await page.evaluate(() => window.__jamLog);
    const local = join(here, "local");
    mkdirSync(local, { recursive: true });
    const name = `jam-loopback-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(join(local, name), JSON.stringify(log));
    if (out) writeFileSync(join(out, name), JSON.stringify(log));
    say(`loopback: log saved to spikes/jam-mode/local/${name}`);
    return log;
  } finally {
    await browser.close();
    server.close();
  }
}

const saved = arg("--log");
const log = saved ? JSON.parse(readFileSync(saved, "utf8")) : await run(arg("--out"));
const a = analyse(log);
say(table(a));
for (const s of a.strikes.filter((s) => s.got !== s.name)) say(`misnamed: ${s.name} struck at +${s.offsetMs} ms in its beat, named ${s.got}`);
process.exit(a.named === a.strikes.length && a.wrong === 0 && a.stuck === 0 && a.follow.max <= a.followBound ? 0 : 1);
