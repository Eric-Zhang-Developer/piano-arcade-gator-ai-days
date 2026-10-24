// Converts the spike's real capture into a fixture: node web/src/game/sim/fixtures/convert-log.mjs
// One segment per run header (`# listen in='…'`): each run restarts the log's clock. Every message is kept with its
// logged time, raw bytes and log line.
import { readFileSync, writeFileSync } from "node:fs";

const source = "spikes/piano-midi/python-piano.log";
const root = new URL("../../../../../", import.meta.url);
const lines = readFileSync(new URL(source, root), "utf8").split("\n");

const segments = [];
lines.forEach((text, i) => {
  const header = text.match(/^# (\w[\w ]*?)\s+in='/);
  if (header) return segments.push({ label: header[1], startLine: i + 1, messages: [] });
  if (text.startsWith("#") || !text.trim()) return;
  const tokens = text.trim().split(/\s+/);
  const type = tokens.findIndex((t) => /^ch\d+$/.test(t)) + 1;
  const bytes = tokens.slice(type + 1).map((b) => parseInt(b, 16));
  if (type < 1 || !bytes.length || bytes.some(Number.isNaN)) throw new Error(`line ${i + 1}: can't parse: ${text}`);
  segments.at(-1).messages.push({ timeMs: Number(tokens[0]), bytes, line: i + 1 });
});

const kept = segments.filter((s) => s.messages.length);
for (const s of kept)
  s.messages.forEach((m, j) => {
    if (j && m.timeMs < s.messages[j - 1].timeMs) throw new Error(`line ${m.line}: time goes backwards in a segment`);
  });
writeFileSync(new URL("python-piano.json", import.meta.url), JSON.stringify({ source, segments: kept }) + "\n");
process.stdout.write(`${kept.length} segments, ${kept.reduce((n, s) => n + s.messages.length, 0)} messages from ${source}\n`);
