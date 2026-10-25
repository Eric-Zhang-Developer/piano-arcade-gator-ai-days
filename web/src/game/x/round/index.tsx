// The Round (spec: round, #1123): you play a round once, and the piano plays your own take back as voices 2, 3 and 4,
// each an entry later on its own channel and program. Only voice 1, you, is judged. On /play, only with ?x=round, on a
// chart with an entry in roundSettings (web/public/songs/rounds/). echo.ts is the pure part.
import Link from "next/link";
import type { Frame, GamePlugin, InputDevice } from "../../../contracts";
import { settings } from "../../core/settings";
import { canvasFonts, DataCell, kitButton, MonoLabel, Panel } from "../../duo-tokens";
import { meterLayout } from "../../fever-gauge";
import { PIANO_NAME } from "../../laptop-sound";
import { bg, gold, ink, primary, secondary } from "../../ui-tokens";
import type { Experiment } from "..";
import { saveLast } from "../highlight-reel/take";
import { echoes, echoFilter, entryFor, programChanges, roundSettings, silence, type Played } from "./echo";

// Voices 2, 3 and 4 in the Duo tokens, never hype (decision round-voices). Voice 1 is the chart's own hand color.
export const voiceColors = [gold, ink, secondary];
const RISE_MS = 500; // a played note's trail back up its lane; none under reduced motion
const LABEL_MS = 1500; // VOICE n shows this long from its entry

let motionQuery: MediaQueryList | undefined;
const still = () => (motionQuery ??= typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined)?.matches ?? false;

declare global {
  interface Window {
    // For the /sim timing log: each echo, the performance time it plays at, and when send() handed it over. at < sentAt
    // is a late echo: the piano plays it on arrival.
    __round?: { presses: { type: string; pitch: number; at: number }[]; sent: { bytes: number[]; at: number; sentAt: number }[]; counts: { received: number; filtered: number; dropped: number } };
  }
}

function roundPlugin(): GamePlugin {
  let entry: ReturnType<typeof entryFor> = null;
  let output: MIDIOutput | null = null;
  let input: MIDIInput | null = null;
  const filter = echoFilter();
  let played: Played[] = [];
  let zero = 0; // performance.now() at chart time 0
  let scheduledUntil = -Infinity;
  let ticker: ReturnType<typeof setInterval> | null = null;
  let ended = false;
  let dropped = 0; // echoes a pause dropped before they went out
  const log = () => (window.__round ??= { presses: [], sent: [], counts: { received: 0, filtered: 0, dropped: 0 } });

  const heard = (e: Event) => {
    const m = e as MIDIMessageEvent;
    if (m.data && m.data.length >= 3) filter.heard(m.data[0], m.data[1], m.data[2], m.timeStamp);
  };
  const connect = async () => {
    if (output || typeof navigator === "undefined" || !navigator.requestMIDIAccess) return;
    try {
      const access = await navigator.requestMIDIAccess();
      output = [...access.outputs.values()].find((o) => o.name?.includes(PIANO_NAME)) ?? null;
      input = [...access.inputs.values()].find((i) => i.name?.includes(PIANO_NAME)) ?? null;
      input?.addEventListener("midimessage", heard); // read-only, beside core's own listener
    } catch {
      output = null; // no permission or no MIDI: the round has no voices to send, and says so on its card
    }
  };

  // Chrome's MIDIOutput has no clear(), and echoes are queued up to the lookahead ahead: silence now and again after it.
  const quiet = () => {
    if (!entry || !output) return;
    (output as MIDIOutput & { clear?(): void }).clear?.();
    const now = performance.now();
    for (const at of [now, now + roundSettings.lookaheadMs]) for (const b of silence(entry.voices)) output.send(b, at);
  };
  const stop = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
    quiet();
  };
  const lastDue = () => (played.length && entry ? played[played.length - 1].atMs + (entry.voices - 1) * entry.intervalMs : -Infinity);

  const tick = () => {
    if (!entry || !output) return;
    const now = performance.now() - zero;
    const until = now + roundSettings.lookaheadMs;
    const rec = log();
    for (const s of echoes(played, entry.intervalMs, entry.voices, scheduledUntil, until)) {
      const at = zero + s.atMs;
      output.send(s.bytes, at);
      if ((s.bytes[0] & 0xf0) === 0x90) filter.sent(s.bytes[1], s.bytes[2], at);
      rec.sent.push({ bytes: s.bytes, at, sentAt: performance.now() });
    }
    scheduledUntil = until;
    rec.counts = { ...filter.counts(), dropped };
    // After the last note, voices 2–4 finish their copies in turn, then everything goes quiet.
    if (ended && now > lastDue() + roundSettings.lookaheadMs) stop();
  };

  const onPagehide = () => stop();

  return {
    id: "x-round",
    transformChart(c) {
      entry = entryFor(c);
      if (entry) void connect();
      return c;
    },
    wrapInput(dev: InputDevice): InputDevice {
      return {
        ...dev,
        start: (onEvent) =>
          dev.start((e) => {
            if (entry && filter.drop(e.type, e.pitch, e.velocity, e.timeMs)) return; // the piano echoing a voice: never judged
            if (entry && ticker) {
              played.push({ type: e.type, pitch: e.pitch, velocity: e.velocity, atMs: e.timeMs - zero });
              log().presses.push({ type: e.type, pitch: e.pitch, at: e.timeMs });
            }
            onEvent(e);
          }),
      };
    },
    onEvent(e) {
      if (!entry) return;
      if (e.type === "songStart") {
        stop();
        played = [];
        ended = false;
        dropped = 0;
        filter.clear();
        window.__round = undefined; // a fresh log per take
        zero = performance.now() - e.atMs;
        scheduledUntil = -Infinity;
        if (output) for (const b of programChanges(entry.voices)) output.send(b);
        window.addEventListener("pagehide", onPagehide);
        ticker = setInterval(tick, 20);
      } else if (e.type === "pause") {
        // A pause drops the echoes that haven't gone out: after it the clock stood still, so they'd land wrong.
        const now = performance.now() - zero;
        dropped += echoes(played, entry.intervalMs, entry.voices, scheduledUntil, Infinity).length;
        played = played.filter((p) => p.atMs > now);
        stop();
      } else if (e.type === "resume") {
        zero = performance.now() - e.atMs;
        scheduledUntil = e.atMs;
        ticker ??= setInterval(tick, 20);
      } else if (e.type === "quit") {
        stop();
        window.removeEventListener("pagehide", onPagehide);
      } else if (e.type === "songEnd") ended = true;
    },
    draw(ctx: CanvasRenderingContext2D, f: Frame) {
      if (!entry || !played.length) return;
      const line = f.judgmentLineY;
      const pxPerMs = line / settings.lookaheadMs;
      const calm = still();
      const ons = played.filter((p) => p.type === "on");
      ctx.save();
      // Under the HUD and its meter, as the notes are: x plugins draw last, so clip rather than trust the order.
      const { bar } = meterLayout(f.width, line);
      ctx.beginPath();
      ctx.rect(0, bar.y + bar.h, f.width, line - bar.y - bar.h);
      ctx.clip();
      ctx.lineWidth = 2;
      for (const on of ons) {
        const off = played.find((p) => p.type === "off" && p.pitch === on.pitch && p.atMs >= on.atMs);
        const dur = (off ? off.atMs : f.nowMs) - on.atMs;
        const k = f.keyX(on.pitch);
        // Your note rises back up its lane...
        const since = f.nowMs - on.atMs;
        if (!calm && since >= 0 && since < RISE_MS) {
          ctx.globalAlpha = 1 - since / RISE_MS;
          ctx.strokeStyle = voiceColors[0];
          const y = line - since * pxPerMs * 0.5;
          ctx.strokeRect(k.x + 2, y - 6, k.width - 4, 6);
        }
        // ...then falls again as an outline in voice 2's color, then 3's, then 4's, landing as that voice sounds.
        ctx.globalAlpha = 1;
        for (let v = 1; v < entry.voices; v++) {
          const at = on.atMs + v * entry.intervalMs;
          const bottom = line - (at - f.nowMs) * pxPerMs;
          const top = bottom - Math.max(4, dur * pxPerMs);
          if (bottom < 0 || top > line) continue;
          ctx.strokeStyle = voiceColors[v - 1];
          ctx.strokeRect(k.x + 3, Math.max(0, top), k.width - 6, Math.min(line, bottom) - Math.max(0, top));
        }
      }
      // VOICE n where each voice comes in: over the lane of your first note, as its copy lands on the line.
      const first = ons[0];
      const k = f.keyX(first.pitch);
      const size = Math.max(14, Math.round(f.height / 40));
      ctx.font = canvasFonts.data(size);
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      for (let v = 1; v < entry.voices; v++) {
        const since = f.nowMs - (first.atMs + v * entry.intervalMs);
        if (since < 0 || since > LABEL_MS) continue;
        ctx.globalAlpha = calm ? 1 : 1 - since / LABEL_MS;
        // On a black plate, so the lanes' outlines never run through the word.
        const text = `VOICE ${v + 1}`;
        const w = ctx.measureText(text).width + size;
        const x = k.x + k.width / 2;
        const y = line - size * 0.6;
        ctx.fillStyle = bg;
        ctx.fillRect(x - w / 2, y - size * 1.2, w, size * 1.4);
        ctx.fillStyle = voiceColors[v - 1];
        ctx.fillText(text, x, y);
      }
      ctx.restore();
    },
    resultsPanel: ({ chart: c, take, results }) => {
      if (!entry) return null;
      saveLast({ chart: c, take, results }); // highlight-reel renders it from here
      // What voices 2–4 sing in all: the card shows at your last note, while they're still singing.
      const sung = played.filter((p) => p.type === "on").length * (entry.voices - 1);
      const filtered = window.__round?.counts.filtered ?? 0;
      const link = kitButton("secondary");
      return (
        <Panel style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap", gap: 0 }}>
          <div data-testid="round-card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 14px 10px 0" }}>
            <MonoLabel>Voices, all you</MonoLabel>
            {/* One chip per voice, in the colors they fell in: you, then 2, 3, 4. */}
            <span style={{ display: "flex", gap: 6, alignItems: "center", height: 32 }}>
              {[primary, ...voiceColors.slice(0, entry.voices - 1)].map((c) => (
                <span key={c} style={{ width: 22, height: 22, border: `2px solid ${c}`, background: c === primary ? c : "transparent" }} />
              ))}
            </span>
          </div>
          <DataCell label="Notes sung back" value={sung} size={32} />
          {filtered ? <DataCell label="Echoes filtered" value={filtered} size={32} /> : null}
          {output ? null : (
            <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderLeft: "1px solid var(--pa-line)" }}>
              <MonoLabel>No piano: voices 2–{entry.voices} had nowhere to play</MonoLabel>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", marginLeft: "auto", paddingLeft: 14 }}>
            <Link href="/highlight?take=last" className={link.className} style={link.style}>
              Highlight reel →
            </Link>
          </div>
        </Panel>
      );
    },
  };
}

export const round: Experiment = {
  name: "round",
  title: "The Round",
  group: "Wow",
  line: "Play a round once and the DGX sings it back as voices 2–4 (#1123)",
  issue: 1123,
  href: "/play?song=rounds/frere-jacques&x=round",
  plugin: roundPlugin,
};
