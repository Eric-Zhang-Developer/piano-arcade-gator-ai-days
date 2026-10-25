// Headless proof of the encoding sandbox at /learn/understand (spec: theory-screens, V1). Its own `next dev`. At 1280×720:
// - a wrong answer is judged wrong and, after a reload, is still on record (progress is kept on this device);
// - every gate answered through to the end shows complete and 3/3, never before;
// - the chat replies, or says plainly it isn't connected;
// - no page errors, and the Gates, Score and Reference files render on screen.
// Keeps the screenshots. Usage: node web/src/learn/frontend/encoding/verify-encoding.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-encoding.mjs --out <dir>");
  process.exit(2);
}
const out = resolve(process.argv[outArg + 1]);
mkdirSync(out, { recursive: true });
const say = (s) => process.stdout.write(`${s}\n`);

// The right option for each question, as theory/content.ts has it, keyed "<gate>/<question>".
const ANSWERS = {
  "home/tonic": "c",
  "home/tonic-degree": "1",
  "home/dominant": "g",
  "endings/phrase-1-end": "g",
  "endings/phrase-2-end": "c",
  "endings/tonic-ending": "phrase-2",
  "endings/descent": "steps",
  "reading/g-line": "second-line",
  "reading/c-ledger": "ledger",
  "reading/cadence-proof": "no",
  "reading/half-cadence": "half",
};
const PROGRESS_KEY = "pianoArcade.theory.v1";

const port = await new Promise((res, rej) => {
  const s = createServer().once("error", rej);
  s.listen(0, () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});
const base = `http://localhost:${port}`;
say(`verify-encoding: starting next dev on ${port}`);
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
for (let i = 0; ; i++) {
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
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const url = `${base}/learn/understand`;
const prompt = page.locator("p[data-question]");
const current = async () => {
  await prompt.waitFor();
  return `${await prompt.getAttribute("data-gate")}/${await prompt.getAttribute("data-question")}`;
};
const storedAttempts = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"attempts":[]}').attempts.length, PROGRESS_KEY);
const answer = async (choice) => {
  await page.locator(`input[data-choice="${choice}"]`).check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  return page.locator("[data-result]").getAttribute("data-result");
};
const next = () => page.getByRole("button", { name: "Next", exact: true }).click();

await page.goto(url);
await page.evaluate((key) => localStorage.removeItem(key), PROGRESS_KEY);
await page.reload();

// A miss is judged wrong, says it comes back, and moves the gate on.
const first = await current();
check(first === "home/tonic", `opens on the first question (${first})`);
check((await answer("g")) === "wrong", "a wrong answer is judged wrong");
check(await page.getByText("This question comes back later.").isVisible(), "a miss says it comes back later");
await page.screenshot({ path: join(out, "encoding-miss.png") });
await next();
const afterMiss = await current();

// Reload: the miss is still on record and the same question is up.
await page.reload();
check((await storedAttempts()) === 1, "the miss is saved on this device");
check((await current()) === afterMiss, `a reload resumes on the same question (${afterMiss})`);
check((await page.locator("[data-passed]").innerText()).startsWith("0/3"), "no gate has passed yet");

// Stop goes back to /learn; coming back keeps progress.
await page.getByRole("link", { name: "Stop" }).click();
await page.waitForURL(`${base}/learn`);
await page.goto(url);
check((await storedAttempts()) === 1 && (await current()) === afterMiss, "Stop keeps progress");

// The Score and Reference files.
await page.getByRole("tab", { name: "Score" }).click();
check((await page.locator("figure[data-phrase]").count()) === 2, "Score shows both phrases on paper");
check((await page.getByRole("button", { name: "Listen" }).count()) === 2, "each phrase has Listen");
await page.screenshot({ path: join(out, "encoding-score.png") });
await page.getByRole("tab", { name: "Reference" }).click();
check(await page.getByRole("heading", { name: "Reference" }).isVisible(), "Reference opens");
await page.getByRole("tab", { name: "Gates" }).click();

// Answer every gate through; complete shows only at the end.
let completeEarly = false;
for (let i = 0; i < 40; i++) {
  if (await page.locator("[data-complete]").count()) break;
  const key = await current();
  const choice = ANSWERS[key];
  if (!choice) {
    check(false, `knows the answer to ${key}`);
    break;
  }
  if ((await answer(choice)) !== "correct") check(false, `${key} judged correct`);
  if (await page.locator("[data-complete]").count()) completeEarly = true;
  await next();
}
check(!completeEarly, "complete shows only after the last Next");
check(await page.locator('[data-complete="true"]').isVisible(), "every gate passed shows complete");
check((await page.locator("[data-passed]").innerText()).startsWith("3/3"), "the header shows 3/3 gates passed");

// The chat replies, or says it isn't connected.
await page.locator("#chat-input").fill("Why is C home?");
await page.getByRole("button", { name: "Send", exact: true }).click();
const tutor = page.locator('[data-role="tutor"]');
const status = page.locator("[data-chat-status]");
await tutor.or(status).first().waitFor({ timeout: 60_000 });
const replied = await tutor.count();
const statusText = replied ? "" : await status.innerText();
check(replied > 0 || statusText.includes("isn’t connected"), `the chat ${replied ? "replies" : `says: ${statusText}`}`);
await page.screenshot({ path: join(out, "encoding-complete.png") });

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();

if (failures.length) {
  say(`verify-encoding: FAIL (${failures.length})`);
  process.exit(1);
}
say(`verify-encoding: pass (evidence: ${out})`);
process.exit(0);
