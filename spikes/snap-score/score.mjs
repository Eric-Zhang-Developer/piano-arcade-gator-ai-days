// snap-score-spike: scores every snapped chart in local/ against the committed chart of its piece, and prints one
// Markdown table for FINDINGS.md. Per chart: forge diff's share (raw, and at the best whole-16th shift), the forged
// notes left unmatched, the library rules (level-forge's check.test.ts), and the call's tokens and seconds.
//   node spikes/snap-score/score.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "../..");
const local = join(here, "local");
const say = (s) => process.stdout.write(`${s}\n`);

// The committed notes a page can be scored on, in beats. minuet-g's chart writes its A section's repeat out (bars
// 1-16 twice, its source line says), while the page prints the repeat sign and goes on to bar 32, so only the
// first pass is the same music (decision snap-score-spike-measure).
const WINDOW = { "minuet-g": 48 };
const SHIFTS = Array.from({ length: 33 }, (_, i) => (i - 16) / 4); // ±4 beats in 16ths: covers a pickup counted either way

const diff = (forged, committed) =>
  JSON.parse(execFileSync("python3", [join(root, "game-tools/forge/forge.py"), "diff", forged, committed], { encoding: "utf8" }));

function committedFor(id) {
  const path = join(root, "web/public/songs", id, "chart.json");
  if (!WINDOW[id]) return path;
  const c = JSON.parse(readFileSync(path, "utf8"));
  const out = join(local, `${id}.committed-window.json`);
  writeFileSync(out, JSON.stringify({ ...c, notes: c.notes.filter((n) => n.beat < WINDOW[id]) }));
  return out;
}

function rules(chartPath, id) {
  const r = spawnSync("pnpm", ["-C", join(root, "web"), "exec", "vitest", "run", "src/app/api/forge/check.test.ts"], {
    env: { ...process.env, FORGE_CHART: chartPath, FORGE_ID: id },
    encoding: "utf8",
  });
  return r.status === 0 ? "pass" : "fail";
}

const rows = [];
for (const f of readdirSync(local).filter((f) => f.endsWith(".chart.json")).sort()) {
  const path = join(local, f);
  const chart = JSON.parse(readFileSync(path, "utf8"));
  const id = chart.id;
  const image = f.slice(id.length + 1, -".chart.json".length);
  const committed = committedFor(id);
  const raw = diff(path, committed);
  let best = { shift: 0, d: raw };
  for (const s of SHIFTS) {
    if (!s) continue;
    const shifted = join(local, `${f}.shift.json`);
    writeFileSync(shifted, JSON.stringify({ ...chart, notes: chart.notes.map((n) => ({ ...n, beat: n.beat + s })) }));
    const d = diff(shifted, committed);
    if (d.share > best.d.share) best = { shift: s, d };
  }
  const usage = JSON.parse(readFileSync(join(local, f.replace(".chart.json", ".usage.json")), "utf8"));
  const last = usage.attempts.at(-1) ?? {};
  rows.push({
    id,
    image,
    raw: raw.share,
    shifted: best.shift ? `${best.d.share} (${best.shift > 0 ? "+" : ""}${best.shift} beats)` : "same",
    matched: `${best.d.matched}/${best.d.committed}`,
    unmatched: best.d.forged_unmatched,
    rules: rules(path, id),
    tokens: last.usage ? `${last.usage.input_tokens} in, ${last.usage.output_tokens} out` : "",
    seconds: last.seconds ?? "",
    attempts: usage.attempts.length,
  });
}

say("| Piece | Image | Share | Shifted | Matched | Forged unmatched | Rules | Tokens | Seconds | Attempts |");
say("|---|---|---|---|---|---|---|---|---|---|");
for (const r of rows) say(`| ${r.id} | ${r.image} | ${r.raw} | ${r.shifted} | ${r.matched} | ${r.unmatched} | ${r.rules} | ${r.tokens} | ${r.seconds} | ${r.attempts} |`);
