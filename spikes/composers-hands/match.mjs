// Validation (b): a roll against our chart, section by section (spike: composers-hands).
// Usage: node spikes/composers-hands/match.mjs <roll.mid> <chart.json> [--spool <passage start ms>-<end ms>]
// Prints the spool rate it found (and corrects it when --spool names a steady passage), then each section's kind,
// its chart bars and its pitch match. Exit 1 when a matched section is under 90%.
import { readFileSync } from "node:fs";
import { sections, sequence } from "../../web/src/game/x/composers-hands/align.ts";
import { parseMidi, spoolRate, unspool } from "../../web/src/game/x/composers-hands/roll.ts";

const say = (s) => process.stdout.write(`${s}\n`);
const [rollPath, chartPath] = process.argv.slice(2);
if (!rollPath || !chartPath) {
  console.error("usage: match.mjs <roll.mid> <chart.json> [--spool <from ms>-<to ms>]");
  process.exit(2);
}
let roll = parseMidi(new Uint8Array(readFileSync(rollPath)));
const chart = JSON.parse(readFileSync(chartPath, "utf8"));
say(`roll: ${roll.notes.length} notes, ${(roll.notes.at(-1).onMs / 1000).toFixed(1)} s, dynamics: ${roll.dynamics ? "yes" : "no (one velocity)"}, pedal events: ${roll.pedal.length}`);
const spool = process.argv.indexOf("--spool");
if (spool > 0) {
  const [from, to] = process.argv[spool + 1].split("-").map(Number);
  const onsets = [...new Set(roll.notes.filter((n) => n.onMs >= from && n.onMs < to).map((n) => Math.round(n.onMs)))].sort((a, b) => a - b);
  const a = spoolRate(onsets);
  say(`spool: rate ${a.toExponential(2)} per ms over ${onsets.length} onsets in ${from}–${to} ms (1 + a·t: ${((a * (to - from)) * 100).toFixed(1)}% across the passage)`);
  roll = unspool(roll, a);
}
const mpb = 60000 / chart.bpm;
const seqR = sequence(roll.notes.map((n) => ({ pitch: n.pitch, ms: n.onMs })));
const seqC = sequence(chart.notes.map((n) => ({ pitch: n.pitch, ms: n.beat * mpb, bar: Math.floor(n.beat / chart.beatsPerBar) + 1 })));
let low = false;
for (const s of sections(seqR, seqC)) {
  const bars = s.bars ? `bars ${s.bars[0]}–${s.bars[1]}` : "";
  const pct = s.kind === "matched" ? `${(s.match * 100).toFixed(1)}%` : "";
  say(`${s.kind.padEnd(8)} roll ${s.roll[0]}–${s.roll[1]}  chart ${s.chart[0]}–${s.chart[1]}  ${bars}  ${pct}`);
  if (s.kind === "matched" && s.match < 0.9) low = true;
}
process.exit(low ? 1 : 0);
