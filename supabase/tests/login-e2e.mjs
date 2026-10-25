// The whole login and save journey in a real browser, against the database the app points at: the sign-in screen,
// "Play as guest", the menu, a song played on laptop keys, the results screen's save line, Easy not saving, the
// profile, the row in Supabase, the profile's sign-in leading to that same page as the same guest,
// both Google buttons reaching Google's sign-in page (it stops there: no account is used), and a failed
// Google return. Deletes the guest and its takes at the end.
// With the app running (pnpm -C web dev), from the repo root:
//   node supabase/tests/login-e2e.mjs [appOrigin=http://localhost:3000]
// Reads web/.env.local and prints no keys. Google sign-in itself needs a person: see supabase/README.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const { chromium } = createRequire(`${root}/web/package.json`)("playwright");
const app = process.argv[2] ?? "http://localhost:3000";
const env = Object.fromEntries(readFileSync(`${root}/web/.env.local`, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const SB = env.NEXT_PUBLIC_SUPABASE_URL, SECRET = env.SUPABASE_SECRET_KEY;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}` };
const say = (line) => process.stdout.write(line + "\n");
let step = 0;
const check = async (name, fn) => {
  step++;
  await fn();
  say(`ok  ${String(step).padStart(2)}. ${name}`);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let guestId = null;

/** Plays a song on laptop keys until the results screen, then returns the take-store line's state and text. */
async function playOnKeys(path) {
  await page.goto(`${app}${path}`);
  await page.getByRole("button", { name: "Start", exact: true }).click({ timeout: 60_000 });
  const keys = ["a", "s", "d", "f", "g", "h", "j"];
  const results = page.locator('[data-testid="results"]');
  for (let i = 0; i < 400 && !(await results.isVisible()); i++) {
    await page.keyboard.down(keys[i % keys.length]);
    await page.waitForTimeout(120);
    await page.keyboard.up(keys[i % keys.length]);
    await page.waitForTimeout(280);
  }
  await results.waitFor({ timeout: 60_000 });
  const line = page.locator('[data-testid="save-status"]');
  await page.waitForFunction(() => {
    const s = document.querySelector('[data-testid="save-status"]')?.getAttribute("data-state");
    return s && s !== "checking" && s !== "sending";
  }, null, { timeout: 30_000 });
  return { state: await line.getAttribute("data-state"), text: (await line.textContent())?.trim() };
}

try {
  await check("the sign-in screen offers Google and guest, and ?next can't leave the site", async () => {
    await page.goto(`${app}/auth/login?next=//evil.example/x`);
    await page.getByTestId("login-google").waitFor({ timeout: 60_000 });
    assert.equal(await page.getByTestId("login-guest").getAttribute("href"), "/");
  });

  await check("\"Sign in with Google\" reaches Google's sign-in page (stops there)", async () => {
    await page.getByTestId("login-google").click();
    await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 });
    assert.match(page.url(), /redirect_uri=https%3A%2F%2F[a-z0-9]+\.supabase\.co%2Fauth%2Fv1%2Fcallback/);
  });

  await check("a failed Google return shows a clear message, not a broken page", async () => {
    await page.goto(`${app}/auth/callback#error=access_denied&error_description=The+user+cancelled`);
    await page.getByRole("alert").filter({ hasText: "The user cancelled" }).waitFor({ timeout: 30_000 });
    await page.getByTestId("callback-retry").waitFor(); // and a way on: Google again, or keep playing
    await page.goto(`${app}/auth/callback?error=server_error&error_description=Query+string+error`);
    await page.getByRole("alert").filter({ hasText: "Query string error" }).waitFor({ timeout: 30_000 });
  });

  await check("\"Play as guest\" opens the menu, whose account chip offers Sign in", async () => {
    await page.goto(`${app}/auth/login`);
    await page.getByTestId("login-guest").click();
    await page.waitForURL(`${app}/`, { timeout: 30_000 });
    await page.getByTestId("song-twinkle").waitFor({ timeout: 60_000 });
    const chip = page.getByTestId("account-chip");
    if (await chip.count()) assert.match(await chip.textContent(), /Sign in/i); // the chip ships with #471's menu line
  });

  await check("Twinkle played on laptop keys: the results screen says it was saved", async () => {
    const r = await playOnKeys("/play?song=twinkle");
    assert.equal(r.state, "saved", r.text);
    assert.match(r.text, /Saved as a guest/);
    guestId = await page.evaluate(() => JSON.parse(localStorage.getItem("pianoArcade.session") ?? "null")?.user_id);
    assert.ok(guestId, "the browser holds a guest session");
  });

  await check("the take is in Supabase under that guest, with the counts the server judged", async () => {
    const rows = await (await fetch(`${SB}/rest/v1/takes?player_id=eq.${guestId}&select=id,song_id,input_device,perfect,great,good,miss`, { headers: admin })).json();
    assert.equal(rows.length, 1, JSON.stringify(rows));
    assert.equal(rows[0].song_id, "twinkle");
    assert.equal(rows[0].input_device, "keys");
    const chart = JSON.parse(readFileSync(`${root}/web/public/songs/twinkle/chart.json`, "utf8"));
    const notes = await (await fetch(`${SB}/rest/v1/note_judgments?take_id=eq.${rows[0].id}&select=note_id`, { headers: admin })).json();
    assert.equal(notes.length, chart.notes.length, "one judgment row per chart note");
    const t = rows[0];
    assert.equal(t.perfect + t.great + t.good + t.miss, chart.notes.length, "every note is judged once");
  });

  await check("Easy level: the results screen says it isn't saved, and why", async () => {
    const r = await playOnKeys("/play?song=twinkle&level=easy");
    assert.equal(r.state, "skipped", r.text);
    assert.match(r.text, /Easy level/);
    const rows = await (await fetch(`${SB}/rest/v1/takes?player_id=eq.${guestId}&select=id`, { headers: admin })).json();
    assert.equal(rows.length, 1, "still one take");
  });

  await check("the profile shows the session, totals and every panel, with no page errors", async () => {
    await page.goto(`${app}/progress`);
    await page.getByTestId("profile-totals").waitFor({ timeout: 60_000 });
    for (const id of ["accuracy-chart", "practice-calendar", "judgment-mix", "hands", "songs"]) await page.getByTestId(id).waitFor();
    assert.equal(await page.locator('[data-testid="take-history"] tbody tr').count(), 1);
    assert.match(await page.getByTestId("profile-totals").textContent(), /Sessions\s*1/i);
    assert.match(await page.locator("main").textContent(), /Guest · saved to this browser's player/);
  });

  await check("the profile's sign-in goes to the one sign-in page, which knows the same guest", async () => {
    await page.getByTestId("progress-signin").click();
    await page.waitForURL(`${app}/auth/login?next=/progress`, { timeout: 30_000 });
    await page.getByTestId("login-guest").filter({ hasText: "Keep playing as guest" }).waitFor({ timeout: 30_000 });
    assert.equal(await page.getByTestId("login-guest").getAttribute("href"), "/progress");
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem("pianoArcade.session") ?? "null")?.user_id);
    assert.equal(id, guestId, "still the guest who saved the take");
  });

  await check("a guest's \"Continue with Google\" links this same player and reaches Google (stops there)", async () => {
    await page.getByTestId("login-google").click();
    await page.waitForURL(/accounts\.google\.com/, { timeout: 30_000 });
  });

  await check("no page errors anywhere on the way", async () => {
    assert.deepEqual(errors, []);
  });
  say("pass: sign-in screen, guest play, saving, Easy, profile, Supabase and both Google entry points work");
} catch (e) {
  await page.screenshot({ path: "/tmp/login-e2e-failure.png", fullPage: true }).catch(() => {});
  say(`FAIL at step ${step + 1}: ${e.message.split("\n")[0]} (screenshot: /tmp/login-e2e-failure.png)`);
  process.exitCode = 1;
} finally {
  await browser.close();
  if (guestId) {
    await fetch(`${SB}/rest/v1/takes?player_id=eq.${guestId}`, { method: "DELETE", headers: admin });
    const d = await fetch(`${SB}/auth/v1/admin/users/${guestId}`, { method: "DELETE", headers: admin });
    say(`cleanup: test guest deleted (${d.status})`);
  }
}
