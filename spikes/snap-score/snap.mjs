// snap-score-spike: one image of a printed score page -> a chart, read by Claude's vision (spec: snap-score-spike).
// Plain Node, no dependency. The Messages API call follows web/src/app/learn/api/chat/route.ts. The key is read from
// ANTHROPIC_API_KEY and never printed, logged or written.
//
//   node --env-file=<main checkout>/web/.env.local spikes/snap-score/snap.mjs <image> --id <id> --bpm <n> \
//     --title <t> --composer <c> --source "<the committed chart's source line>" --out spikes/snap-score/local/
//   ... snap.mjs --recall --id <id> ...   the control: the same piece, no image, from memory
//   node spikes/snap-score/snap.mjs --self-test
import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2026-10-21";
const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000; // non-streaming: a page of notes plus the model's thinking fits
const TIMEOUT_MS = 600_000;
const ATTEMPTS = 2; // spec: at most 2 per image, both logged
const here = fileURLToPath(new URL(".", import.meta.url));
const say = (s) => process.stdout.write(`${s}\n`);

const SCHEMA = {
  type: "object",
  properties: {
    beatsPerBar: { type: "number" },
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          pitch: { type: "integer" },
          beat: { type: "number" },
          duration: { type: "number" },
          hand: { type: "string", enum: ["R", "L"] },
        },
        required: ["pitch", "beat", "duration", "hand"],
        additionalProperties: false,
      },
    },
  },
  required: ["beatsPerBar", "notes"],
  additionalProperties: false,
};

// prompt.md's "## Read" or "## Recall" section, with {title}, {composer} and {source} filled in.
export function promptFor(part, meta, text = readFileSync(join(here, "prompt.md"), "utf8")) {
  const m = text.match(new RegExp(`^## ${part}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  if (!m) throw new Error(`prompt.md has no "## ${part}" section`);
  return m[1].trim().replace(/\{(title|composer|source)\}/g, (_, k) => meta[k]);
}

const MEDIA = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

export function request({ image, part, meta, model }) {
  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: MEDIA[extname(image.name).toLowerCase()], data: image.data } });
  content.push({ type: "text", text: promptFor(part, meta) });
  return {
    model,
    max_tokens: MAX_TOKENS,
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  };
}

// The reply's notes, or a reason it has none: a cut-off, a refusal, or text that isn't the JSON asked for.
export function readReply(message) {
  if (!message || typeof message !== "object") return { error: "no message in the reply" };
  if (message.stop_reason !== "end_turn") return { error: `stop_reason ${message.stop_reason}${message.stop_details?.category ? ` (${message.stop_details.category})` : ""}` };
  const text = (message.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: `not JSON: ${text.slice(0, 80)}` };
  }
  if (!Array.isArray(parsed?.notes) || typeof parsed.beatsPerBar !== "number") return { error: "JSON without beatsPerBar and notes" };
  return { beatsPerBar: parsed.beatsPerBar, notes: parsed.notes };
}

// The library's chart shape. A pickup's negative beats move by whole bars, so the pickup pads a full bar 0 as the
// committed charts do (sheet-pickups).
export function toChart({ beatsPerBar, notes }, meta, model) {
  const min = Math.min(0, ...notes.map((n) => n.beat));
  const shift = min < 0 ? Math.ceil(-min / beatsPerBar - 1e-9) * beatsPerBar : 0;
  const sorted = notes
    .map((n) => ({ pitch: n.pitch, beat: n.beat + shift, duration: n.duration, hand: n.hand }))
    .sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
  return {
    id: meta.id,
    title: meta.title,
    composer: meta.composer,
    source: `Read from ${meta.recall ? "memory, no image, of" : "a photo of"} ${meta.source} by ${model} (snap-score-spike)`,
    bpm: meta.bpm,
    beatsPerBar,
    notes: sorted.map((n, i) => ({ id: `n${i + 1}`, ...n })),
  };
}

// One image (or the recall control): up to ATTEMPTS calls, each logged. Returns { chart } or { error }.
export async function snap({ image, meta, key, model = DEFAULT_MODEL, fetchFn = fetch, log = say }) {
  if (!key) return { error: "not configured: no ANTHROPIC_API_KEY" };
  const body = JSON.stringify(request({ image, part: meta.recall ? "Recall" : "Read", meta, model }));
  const attempts = [];
  for (let i = 1; i <= ATTEMPTS; i++) {
    const t0 = Date.now();
    let message = null;
    let error = null;
    try {
      const res = await fetchFn(MESSAGES_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": ANTHROPIC_VERSION },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      message = await res.json().catch(() => null);
      if (!res.ok) error = `HTTP ${res.status}: ${message?.error?.message ?? "no body"}`;
    } catch (e) {
      error = `request failed: ${e.name}`;
    }
    const read = error ? { error } : readReply(message);
    const seconds = (Date.now() - t0) / 1000;
    attempts.push({ attempt: i, seconds, model: message?.model ?? model, stop_reason: message?.stop_reason ?? null, usage: message?.usage ?? null, error: read.error ?? null });
    log(`snap: attempt ${i}: ${read.error ?? `${read.notes.length} notes`} (${seconds.toFixed(1)} s)`);
    if (!read.error) return { chart: toChart(read, meta, message.model ?? model), attempts };
  }
  return { error: attempts[attempts.length - 1].error, attempts };
}

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv) {
  if (argv.includes("--self-test")) return selfTest();
  const recall = argv.includes("--recall");
  const imagePath = recall ? null : argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const meta = { id: arg(argv, "--id"), bpm: Number(arg(argv, "--bpm")), title: arg(argv, "--title"), composer: arg(argv, "--composer"), source: arg(argv, "--source"), recall };
  const out = arg(argv, "--out");
  if (!meta.id || !meta.bpm || !meta.title || !meta.composer || !meta.source || !out || (!recall && !imagePath)) {
    console.error("usage: snap.mjs <image> | --recall  --id <id> --bpm <n> --title <t> --composer <c> --source <s> --out <dir>");
    return 2;
  }
  const image = imagePath && { name: imagePath, data: readFileSync(imagePath).toString("base64") };
  const model = process.env.SNAP_MODEL?.trim() || DEFAULT_MODEL;
  const r = await snap({ image, meta, key: process.env.ANTHROPIC_API_KEY?.trim(), model });
  const stem = `${meta.id}.${recall ? "recall" : basename(imagePath, extname(imagePath))}`;
  writeFileSync(join(out, `${stem}.usage.json`), JSON.stringify({ image: imagePath ?? null, model, attempts: r.attempts ?? [], error: r.error ?? null }, null, 2) + "\n");
  if (r.error) {
    console.error(`snap: ${stem}: ${r.error}`);
    return 1;
  }
  writeFileSync(join(out, `${stem}.chart.json`), JSON.stringify(r.chart, null, 2) + "\n");
  say(`snap: wrote ${join(out, `${stem}.chart.json`)}: ${r.chart.notes.length} notes`);
  return 0;
}

// ---------- self-test: no network ----------

async function selfTest() {
  const KEY = "sk-ant-SELFTEST-SECRET";
  const lines = [];
  const log = (s) => lines.push(s);
  const meta = { id: "minuet-g", bpm: 100, title: "Minuet", composer: "Petzold", source: "Mutopia 75", recall: false };
  const image = { name: "x.png", data: "AAAA" };
  const reply = (over) => async () => ({ ok: true, status: 200, json: async () => ({ model: "claude-opus-5-5", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 2 }, ...over }) });
  const ok = (j) => ({ content: [{ type: "text", text: JSON.stringify(j) }] });
  const check = (cond, what) => {
    if (!cond) throw new Error(`self-test: ${what}`);
    say(`ok   ${what}`);
  };

  const good = await snap({ image, meta, key: KEY, fetchFn: reply(ok({ beatsPerBar: 1.5, notes: [{ pitch: 76, beat: -0.5, duration: 0.25, hand: "R" }, { pitch: 75, beat: -0.25, duration: 0.25, hand: "R" }, { pitch: 45, beat: 0, duration: 0.25, hand: "L" }] })), log });
  check(good.chart?.notes.map((n) => n.id).join() === "n1,n2,n3", "a canned reply becomes a chart with ids n1..n3");
  check(good.chart.bpm === 100 && good.chart.id === "minuet-g", "the chart takes --bpm and --id");
  check(good.chart.source === "Read from a photo of Mutopia 75 by claude-opus-5-5 (snap-score-spike)", "the source names the edition and the model");
  check(good.chart.notes[0].beat === 1 && good.chart.notes[2].beat === 1.5, "a pickup's negative beats pad a full bar 0");

  const notJson = await snap({ image, meta, key: KEY, fetchFn: reply({ content: [{ type: "text", text: "Here are the notes:" }] }), log });
  check(notJson.error?.startsWith("not JSON") && notJson.attempts.length === 2, "a reply that isn't JSON fails with a reason, after 2 attempts");
  const cut = await snap({ image, meta, key: KEY, fetchFn: reply({ stop_reason: "max_tokens", content: [] }), log });
  check(cut.error === "stop_reason max_tokens", "a cut-off reply fails with a reason");
  const refused = await snap({ image, meta, key: KEY, fetchFn: reply({ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] }), log });
  check(refused.error === "stop_reason refusal (cyber)", "a refusal fails with its category");
  const noKey = await snap({ image, meta, key: undefined, fetchFn: reply(ok({})), log });
  check(noKey.error?.startsWith("not configured"), "no key: not configured, and no call is made");

  const req = request({ image, part: "Read", meta, model: DEFAULT_MODEL });
  check(req.messages[0].content[0].type === "image" && req.messages[0].content[1].text.startsWith("This image is one page"), "the image goes first, then the Read prompt");
  const recall = request({ image: null, part: "Recall", meta: { ...meta, recall: true }, model: DEFAULT_MODEL });
  check(recall.messages[0].content.length === 1 && recall.messages[0].content[0].text.includes("Minuet by Petzold"), "the recall control sends no image and names the piece");

  const everything = [...lines, JSON.stringify([good, notJson, cut, refused, noKey, req, recall])].join("\n");
  check(!everything.includes(KEY), "the key appears in no output, log or result");
  say("snap: self-test pass");
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(await main(process.argv.slice(2)));
