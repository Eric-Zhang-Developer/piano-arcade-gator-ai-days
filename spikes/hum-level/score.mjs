#!/usr/bin/env node
// hum-level-spike's measurement: every hum in local/ (the synthetic clean and sloppy ones, and Eric's
// local/<id>.eric.wav once he hums) through hum.mjs, diffed against its truth with forge's diff, plus the library's
// rules through level-forge's vitest check. Prints one Markdown table for FINDINGS.md.
//
//   node spikes/hum-level/score.mjs [--no-rules]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL, hum } from "./hum.mjs";
import { PIECES, truthPath } from "./truth.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VENV = join(ROOT, "game-tools", "midi-to-chart", ".venv", "bin", "python");
const PYTHON = existsSync(VENV) ? VENV : "python3"; // forge's diff needs only the standard library
const INPUTS = ["clean", "sloppy", "eric"];
const SHIFTS = 8; // a real hum may also be diffed shifted up to this many 8ths early or late (one alignment)

function diff(chartPath, id) {
  const p = spawnSync(PYTHON, [join(ROOT, "game-tools", "forge", "forge.py"), "diff", chartPath, truthPath(id)], { encoding: "utf8" });
  if (p.status !== 0) throw new Error(`forge diff: ${p.stderr}`);
  return JSON.parse(p.stdout);
}

function rules(chartPath, chartId) {
  const p = spawnSync("pnpm", ["-C", join(ROOT, "web"), "exec", "vitest", "run", "src/app/api/forge/check.test.ts"], {
    encoding: "utf8",
    env: { ...process.env, FORGE_CHART: chartPath, FORGE_ID: chartId },
  });
  // A skipped test also exits 0: pass means vitest ran it and it passed.
  return p.status === 0 && /Tests\s+1 passed/.test(p.stdout) ? "pass" : `fail: ${(p.stdout + p.stderr).match(/AssertionError[^\n]*|expected[^\n]*/)?.[0] ?? "see vitest"}`;
}

// The best constant shift in 8ths, for a real hum that starts late or early: another chart, diffed the same way.
function bestShift(chart, chartPath, id) {
  let best = { shift: 0, result: diff(chartPath, id) };
  for (let k = -SHIFTS; k <= SHIFTS; k++) {
    if (!k) continue;
    const notes = chart.notes.map((n) => ({ ...n, beat: n.beat + k / 2 })).filter((n) => n.beat >= 0);
    if (!notes.length) continue;
    const path = chartPath.replace(/\.chart\.json$/, `.shift${k}.chart.json`);
    writeFileSync(path, JSON.stringify({ ...chart, notes }, null, 2) + "\n");
    const result = diff(path, id);
    if (result.share > best.result.share) best = { shift: k, result };
  }
  return best;
}

const rows = [];
for (const id of PIECES) {
  const truth = JSON.parse(readFileSync(truthPath(id), "utf8"));
  for (const input of INPUTS) {
    const wav = join(LOCAL, `${id}.${input}.wav`);
    if (!existsSync(wav)) {
      rows.push(`| ${id} | ${input} | pending | | | | |`);
      continue;
    }
    const { chart, tuningCents } = hum(readFileSync(wav), { bpm: truth.bpm, beatsPerBar: truth.beatsPerBar, id: `${id}-${input}` });
    const chartPath = join(LOCAL, `${id}.${input}.chart.json`);
    writeFileSync(chartPath, JSON.stringify(chart, null, 2) + "\n");
    const d = diff(chartPath, id);
    const shifted = input === "eric" ? bestShift(chart, chartPath, id) : null;
    const aligned = shifted && shifted.shift ? `${(shifted.result.share * 100).toFixed(1)}% at ${shifted.shift > 0 ? "+" : ""}${shifted.shift} 8ths` : "";
    const rule = process.argv.includes("--no-rules") ? "not run" : rules(chartPath, chart.id);
    rows.push(
      `| ${id} | ${input} | ${(d.share * 100).toFixed(1)}% (${d.matched}/${d.committed}) | ${d.forged_unmatched} | ${tuningCents} | ${aligned} | ${rule} |`,
    );
  }
}
process.stdout.write(
  ["| piece | hum | share (matched/truth) | hummed, unmatched | tuning (cents) | aligned | library rules |", "|---|---|---|---|---|---|---|", ...rows].join("\n") + "\n",
);
