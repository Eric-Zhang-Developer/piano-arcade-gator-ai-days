// Headless proof of wait-hands on Für Elise with ?hands=R&mode=wait, the fake piano (?midi=sim) and test input: the
// left hand plays itself on the held clock. The fake output's send is wrapped in the page to log the chart clock at
// each call, and a frame sampler logs the clock, so every check reads the time a message actually went out.
// 1. Press the first 8 right-hand notes on their holds, then wait 4 s at the 9th (beat 3, A4), where the left hand's
//    A2 starts with it and E3 a quarter beat later: neither may have been sent by the end of the wait. 4 s is past
//    wait-hint's 3 s, so its A4 must sound exactly once in the wait, and no other hint anywhere (the 1 s holds).
// 2. Press each right-hand note 1 s after its hold begins, through bar 8: each left-hand note in bars 1–8 has one
//    note-on, in chart order, at or past its start and < 50 ms after, and one note-off at or past its end, < 50 ms after.
// 3. The clock never sits more than 200 ms at a time that has only left-hand notes.
// Usage: node web/src/game/wait-hands/verify-wait-hands.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-wait-hands.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);
const LATE_MS = 50; // a send may trail its chart time by this much (a few frames at 60 fps)
const STALL_MS = 200;
const HINT_MS = 3000; // wait-hint's waitHintSettings.afterMs: the held note sounds once after this
const HOLD_MS = 4000; // the 9th hold: clearly past HINT_MS, so the hint is pinned, not raced (a 3 s hold raced it, #430)
const BARS = 8;

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
const url = `${base}/play?song=fur-elise&hands=R&mode=wait&midi=sim&input=test`;
say(`verify-wait-hands: starting next dev on ${port}`);
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

const browser = await chromium.launch({ headless: true });
const fail = [];
try {
  for (let end = Date.now() + 120_000; ; ) {
    if (Date.now() > end) throw new Error("server not ready after 120 s");
    if (await fetch(url).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const full = await (await fetch(`${base}/songs/fur-elise/chart.json`)).json();
  const mpb = 60000 / full.bpm;
  const barEnd = BARS * full.beatsPerBar;
  const byTime = (a, b) => a.beat - b.beat || a.pitch - b.pitch;
  const left = full.notes.filter((n) => n.hand === "L" && n.beat < barEnd).sort(byTime);
  // The right hand's holds: one per start time (a chord holds until every note in it is pressed).
  const groups = [];
  for (const n of full.notes.filter((n) => n.hand === "R").sort(byTime)) {
    const g = groups.at(-1);
    if (g && g.beat === n.beat) g.pitches.push(n.pitch);
    else groups.push({ beat: n.beat, ms: n.beat * mpb, pitches: [n.pitch] });
  }
  const ninth = groups[8];
  const atNinth = left.filter((n) => n.beat >= ninth.beat && n.beat <= ninth.beat + 0.25);
  if (ninth.beat !== 3 || ninth.pitches.join() !== "69") throw new Error(`the 9th right-hand hold is ${JSON.stringify(ninth)}, want beat 3, A4 (69)`);
  const through = groups.filter((g) => g.beat < barEnd).length;

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__pianoArcade?.ready === true && window.__pianoArcade.now, null, { timeout: 60_000 });

  // The log: every send with the chart clock at the call, and the clock once a frame.
  await page.evaluate(async () => {
    const access = await navigator.requestMIDIAccess();
    const o = [...access.outputs.values()][0];
    const send = o.send.bind(o);
    window.__sent = [];
    window.__clock = [];
    o.send = (data, ts) => {
      window.__sent.push({ data: [...data], ts: ts ?? null, clock: window.__pianoArcade.now(), perf: performance.now() });
      send(data, ts);
    };
    const sample = () => {
      window.__clock.push({ perf: performance.now(), now: window.__pianoArcade.now() });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  // Play: the first 8 holds pressed at once, the 9th after HOLD_MS (the snapshot), the rest 1 s into each hold.
  const snapshot = await page.evaluate(
    async ([groups, through, holdMs]) => {
      const hook = window.__pianoArcade;
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      let snap = null;
      for (let i = 0; i < through; i++) {
        const g = groups[i];
        while (hook.now() < g.ms - 0.01) await frame(); // the clock holds here until it's pressed
        if (i === 8) {
          const heldAt = performance.now();
          await sleep(holdMs);
          snap = { clock: hook.now(), sent: window.__sent.slice(), heldAt };
        } else if (i > 8) await sleep(1000);
        for (const p of g.pitches) hook.press(p, hook.now());
      }
      return snap;
    },
    [groups, through, HOLD_MS],
  );
  // Past bar 8 the clock runs on to the next hold; the left hand's last notes in bar 8 end before it.
  await page.waitForFunction((t) => window.__pianoArcade.now() >= t - 0.01, groups[through].ms, { timeout: 30_000 });
  await page.waitForTimeout(1000);
  const { sent, clock } = await page.evaluate(() => ({ sent: window.__sent, clock: window.__clock }));
  await page.screenshot({ path: join(out, "held-after-bar-8.png") });
  writeFileSync(join(out, "sent.json"), JSON.stringify({ snapshot, sent }, null, 1));

  // 1. Nothing early at the 9th hold.
  const early = snapshot.sent.filter((s) => s.data[0] === 0x90 && s.data[2] > 0 && atNinth.some((n) => n.pitch === s.data[1]));
  if (early.length) {
    const what = early.map((s) => `${s.data[1]} at chart ${s.clock.toFixed(0)} ms`).join(", ");
    fail.push(`step 1: during the ${HOLD_MS / 1000} s hold at beat 3 (chart ${ninth.ms.toFixed(0)} ms), already sent the left hand's ${what}; want neither of ${atNinth.map((n) => `${n.pitch} (beat ${n.beat})`).join(", ")}`);
  } else say(`verify-wait-hands: step 1 pass, nothing sent for ${atNinth.map((n) => n.pitch).join(" and ")} during ${HOLD_MS / 1000} s held at beat 3`);

  // 1b. wait-hint sounds the held A4 once, HINT_MS into the hold; nothing else in this check waits that long.
  const isOn = (s) => s.data[0] === 0x90 && s.data[2] > 0;
  const hints = sent.filter((s) => isOn(s) && ninth.pitches.includes(s.data[1]) && Math.abs(s.clock - ninth.ms) < 1);
  const hintAt = hints.map((s) => s.perf - snapshot.heldAt);
  if (hints.length !== 1 || !(hintAt[0] >= HINT_MS - LATE_MS && hintAt[0] <= HOLD_MS))
    fail.push(`step 1: wait-hint's ${ninth.pitches.join()} note-ons in the hold at ${hintAt.map((t) => `${t.toFixed(0)} ms`).join(", ") || "none"}; want one, ${HINT_MS}–${HOLD_MS} ms in`);
  else say(`verify-wait-hands: step 1 pass, wait-hint sounded ${ninth.pitches.join()} once, ${hintAt[0].toFixed(0)} ms into the hold`);

  // 2. Each left-hand note in bars 1–8: one note-on and one note-off, each in its frame window. The hint isn't one.
  const ons = sent.filter((s) => isOn(s) && !hints.includes(s) && s.clock < barEnd * mpb + LATE_MS);
  const want = left.map((n) => n.pitch).join();
  const got = [...ons].sort((a, b) => a.clock - b.clock || a.data[1] - b.data[1]).map((s) => s.data[1]).join();
  if (ons.length !== left.length || got !== want) fail.push(`step 2: note-ons ${got || "none"}, want ${want} (${left.length} left-hand notes in bars 1–${BARS})`);
  const used = new Set();
  const take = (pred) => {
    const i = sent.findIndex((s, k) => !used.has(k) && pred(s));
    if (i >= 0) used.add(i);
    return i >= 0 ? sent[i] : null;
  };
  const bad = [];
  for (const n of left) {
    const start = n.beat * mpb;
    const end = (n.beat + n.duration) * mpb;
    const on = take((s) => s.data[0] === 0x90 && s.data[1] === n.pitch && s.data[2] > 0);
    const off = take((s) => s.data[0] === 0x80 && s.data[1] === n.pitch && (!on || s.perf >= on.perf));
    const late = (s, t) => (s ? s.clock - t : NaN);
    if (!(late(on, start) >= 0 && late(on, start) < LATE_MS)) bad.push(`${n.pitch}@${n.beat} on ${on ? `${late(on, start).toFixed(1)} ms` : "missing"}`);
    if (!(late(off, end) >= 0 && late(off, end) < LATE_MS)) bad.push(`${n.pitch}@${n.beat} off ${off ? `${late(off, end).toFixed(1)} ms` : "missing"}`);
  }
  if (bad.length) fail.push(`step 2: off its chart time (want 0 to <${LATE_MS} ms after): ${bad.join("; ")}`);
  else say(`verify-wait-hands: step 2 pass, ${left.length} left-hand notes in bars 1–${BARS}, each on and off within ${LATE_MS} ms after its chart time`);

  // 3. No stall at a left-hand-only time.
  const holds = new Set(groups.map((g) => g.ms.toFixed(3)));
  const stalls = [];
  for (let i = 0, j = 0; i < clock.length; i = j) {
    for (j = i + 1; j < clock.length && clock[j].now === clock[i].now; j++);
    const ms = clock[j - 1].perf - clock[i].perf;
    if (ms > STALL_MS && clock[i].now >= 0 && !holds.has(clock[i].now.toFixed(3))) stalls.push(`${ms.toFixed(0)} ms at chart ${clock[i].now.toFixed(1)}`);
  }
  if (stalls.length) fail.push(`step 3: the clock sat at times with no right-hand note: ${stalls.join("; ")}`);
  else say(`verify-wait-hands: step 3 pass, the clock held only at right-hand notes (${clock.length} frames sampled)`);
  fail.push(...errors);
} catch (e) {
  fail.push(e.message);
} finally {
  await browser.close();
}
if (fail.length) {
  say(`verify-wait-hands: FAIL\n  ${fail.join("\n  ")}`);
  process.exit(1);
}
say(`verify-wait-hands: pass (evidence: ${out})`);
process.exit(0);
