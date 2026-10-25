// Headless proof of the retrieval test (spec: theory-screens, slice V3). Its own `next dev`. At 1280×720 on
// /learn/review/theory: answer question 1 right (Correct, no ✕), question 2 wrong (✕, and the chosen option's
// explanation in its own row, to the right of the option), and check the look: square, upright, no gradient,
// nothing under 16px, no reference beside the question. Then ?node=pitch-grand-staff: only that node's questions, each
// Check appended to the device's attempts, ending on Test done and the way back to the map. Usage: node web/src/learn/frontend/retrieval/verify-retrieval.mjs --out <dir>
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const webDir = fileURLToPath(new URL("../../../../", import.meta.url));
const outArg = process.argv.indexOf("--out");
if (outArg < 0 || !process.argv[outArg + 1]) {
  console.error("usage: verify-retrieval.mjs --out <dir>");
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
say(`verify-retrieval: starting next dev on ${port}`);
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

const EXPLANATION = "Scale degree 5 is the dominant: G in C major.";
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(`${base}/learn/review/theory`);
  const option = (text) => page.locator("label", { has: page.locator("span", { hasText: new RegExp(`^${text}$`) }) });
  await option("C").waitFor({ timeout: 90_000 });
  // Hydration: the radio only answers once React is attached.
  await page.waitForFunction(() => document.querySelector("input[type=radio]") && Object.keys(document.querySelector("input[type=radio]")).some((k) => k.startsWith("__react")), null, { timeout: 60_000 });

  // Next decides what follows, so no count is shown (decision "Agent drives").
  check((await page.getByText(/Question \d+ of/).count()) === 0, "no question count");
  check((await page.getByText(/Reference|Previous answers/).count()) === 0, "no reference or history beside the question");

  await option("C").click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText("Correct", { exact: true }).waitFor({ timeout: 10_000 });
  check(await page.getByText("Correct", { exact: true }).isVisible(), "a right answer shows Correct");
  check((await page.getByText("✕").count()) === 0, "a right answer shows no ✕");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await option("5").waitFor({ timeout: 10_000 });
  await option("5").click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText(EXPLANATION).waitFor({ timeout: 10_000 });
  check(await page.getByText("✕").isVisible(), "a wrong answer shows ✕");
  const beside = await page.evaluate((expl) => {
    const p = [...document.querySelectorAll("p")].find((n) => n.textContent === expl);
    const row = p?.closest("[data-verdict]");
    const label = row?.querySelector("label");
    if (!p || !row || !label) return null;
    const pb = p.getBoundingClientRect(), lb = label.querySelector("span").getBoundingClientRect();
    return { verdict: row.dataset.verdict, label: label.textContent, right: pb.left > lb.right, sameBand: pb.top < lb.bottom && pb.bottom > lb.top };
  }, EXPLANATION);
  check(beside?.verdict === "wrong" && beside.label === "5", `the explanation sits in the chosen option's row (${JSON.stringify(beside)})`);
  check(Boolean(beside?.right && beside.sameBand), "the explanation is beside the answer, to its right");
  check((await page.getByText("The tonic is scale degree 1").count()) === 0, "the right answer's explanation is not given away");

  const look = await page.evaluate(() => {
    const radius = (el) => (el ? getComputedStyle(el).borderRadius : "missing");
    const panel = document.querySelector("fieldset")?.parentElement;
    const small = [];
    for (const el of document.querySelectorAll("main *")) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const r = el.getBoundingClientRect();
      if (own && r.width && r.height && parseFloat(getComputedStyle(el).fontSize) < 16) small.push(`${el.tagName} ${getComputedStyle(el).fontSize} "${el.textContent.trim().slice(0, 20)}"`);
    }
    const screen = document.querySelector("h1").closest("[class*='screen']");
    return {
      radii: [radius(panel), radius(document.querySelector("button")), radius(document.querySelector("[data-verdict]")), radius(document.querySelector("input[type=radio]"))],
      bg: getComputedStyle(screen).backgroundImage,
      h1: getComputedStyle(document.querySelector("h1")).fontStyle,
      small,
      scrollX: document.documentElement.scrollWidth > innerWidth,
    };
  });
  check(look.radii.every((r) => r === "0px"), `square: panel, button, row and radio radius ${look.radii.join(", ")}`);
  check(look.bg === "none", `no gradient behind the panel (${look.bg})`);
  check(look.h1 === "normal", `the question is upright (${look.h1})`);
  check(look.small.length === 0, `nothing under 16px${look.small.length ? `: ${look.small.join("; ")}` : ""}`);
  check(!look.scrollX, "no horizontal scroll at 1280");
  await page.screenshot({ path: join(out, "retrieval.png") });
  say(`verify-retrieval: screenshot ${join(out, "retrieval.png")}`);

  // One node, as Next sends it: its own two questions, each Check appended to the device.
  const ATTEMPTS_KEY = "pianoArcade.mastery.attempts.v1";
  await page.goto(`${base}/learn/review/theory?node=pitch-grand-staff`);
  await page.evaluate((key) => localStorage.removeItem(key), ATTEMPTS_KEY);
  await page.reload();
  await option("G").waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector("input[type=radio]") && Object.keys(document.querySelector("input[type=radio]")).some((k) => k.startsWith("__react")), null, { timeout: 60_000 });
  check((await page.getByText("In treble clef, which note sits on the second line from the bottom?").count()) === 1, "the node's first question is shown");
  await option("G").click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText("Correct", { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await option("On the bottom line of the treble staff").click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.getByText("✕").waitFor({ timeout: 10_000 });
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length === 2, ATTEMPTS_KEY, { timeout: 10_000 }).catch(() => {});
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), ATTEMPTS_KEY);
  check(
    stored.length === 2 && stored.map((a) => a.correct).join() === "true,false" && stored.every((a) => a.nodeId === "pitch-grand-staff" && a.learnerId === "local"),
    `both Checks are appended for the node (${JSON.stringify(stored.map(({ itemId, correct, cold }) => ({ itemId, correct, cold })))})`,
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Test done", { exact: true }).waitFor({ timeout: 10_000 });
  check(await page.getByRole("link", { name: "Back to map" }).isVisible(), "the node test ends on Test done and the way back to the map");
  await page.screenshot({ path: join(out, "retrieval-node.png") });
} catch (e) {
  check(false, e.message.split("\n")[0]);
}
await browser.close();

check(errors.length === 0, errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors");
if (failures.length) {
  say(`verify-retrieval: ${failures.length} failed`);
  process.exit(1);
}
say(`verify-retrieval: pass (evidence: ${out})`);
process.exit(0);
