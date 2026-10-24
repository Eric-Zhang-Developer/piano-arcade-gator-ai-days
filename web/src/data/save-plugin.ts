// Saves every finished take, after the results screen is up, without touching the playing loop.
// Registered in web/src/game/layers.ts. It rebuilds the Take from what any plugin sees: the chart (transformChart),
// the raw key events (wrapInput) and the clock (songStart). The play screen emits songStart in the same tick it
// sets chart time 0, so the rebuilt times match the judged ones to well under a millisecond, and the server
// re-judges from this Take anyway.
import type { Chart, GamePlugin, InputDevice, InputKind, Take } from "../contracts";
import { loadLatencyOffset } from "../game/core/settings";
import { ensureSession } from "./auth";
import { isConfigured } from "./config";
import { enqueue, flush, type OutboxItem, type SendResult } from "./outbox";

export interface TakeSink {
  (id: string, take: Take): void;
}

/** The chart as committed, for comparing with the chart that was played. */
export type LoadChart = (songId: string) => Promise<Chart | null>;
const loadCommittedChart: LoadChart = (songId) =>
  fetch(`/songs/${songId}/chart.json`).then((r) => (r.ok ? (r.json() as Promise<Chart>) : null), () => null);

/**
 * Why a take can't be stored as a plain take of its song, or null when it can. The server re-judges every take
 * against the song's committed chart, so only takes played on that exact chart, by a person, judged normally, fit.
 */
export function unsavableReason(params: URLSearchParams): string | null {
  const song = params.get("song") || "twinkle";
  if (song.includes("/")) return "local song: all-rights-reserved charts stay on this machine (decision 003)";
  if (params.has("bot")) return "a bot played it";
  if (params.get("midi") === "sim") return "the fake piano played it";
  if (params.has("versus")) return "two players shared the take";
  if (params.get("mode") === "wait") return "wait mode: nothing is judged in time";
  return null;
}

/** Same notes, tempo and meter. Any plugin that changes what's played (loops, one hand, chunks, tempo) fails this. */
export function sameChart(a: Chart, b: Chart): boolean {
  if (a.id !== b.id || a.bpm !== b.bpm || a.beatsPerBar !== b.beatsPerBar || a.notes.length !== b.notes.length) return false;
  return a.notes.every((n, i) => {
    const m = b.notes[i];
    return n.id === m.id && n.pitch === m.pitch && n.beat === m.beat && n.hand === m.hand;
  });
}

interface Recording {
  zeroPerf: number;
  latency: number;
  startedAt: string;
  kind: InputKind | null;
  events: Take["events"];
}

export function createSavePlugin(sink: TakeSink, loadChart: LoadChart = loadCommittedChart): GamePlugin {
  let chart: Chart | null = null;
  let skip: string | null = null;
  let rec: Recording | null = null;

  const record = (kind: InputKind, type: "on" | "off", pitch: number, velocity: number, perfMs: number) => {
    if (!rec) return;
    const t = perfMs - rec.zeroPerf - rec.latency;
    if (type === "on") {
      rec.kind ??= kind;
      rec.events.push({ pitch, velocity, timeMs: t, offTimeMs: null });
    } else {
      const ev = rec.events.findLast((x) => x.pitch === pitch && x.offTimeMs === null);
      if (ev) ev.offTimeMs = t;
    }
  };

  return {
    id: "take-store",
    transformChart(c, params) {
      chart = c;
      skip = unsavableReason(params);
      return c;
    },
    wrapInput(input: InputDevice): InputDevice {
      return {
        kind: input.kind,
        start: (onEvent) =>
          input.start((e) => {
            record(input.kind, e.type, e.pitch, e.velocity, e.timeMs);
            onEvent(e);
          }),
        stop: () => input.stop(),
      };
    },
    onEvent(e) {
      if (e.type === "songStart") {
        rec = { zeroPerf: performance.now() - e.atMs, latency: loadLatencyOffset(), startedAt: new Date().toISOString(), kind: null, events: [] };
      } else if (e.type === "songEnd" && rec && chart) {
        const r = rec;
        const played = chart;
        rec = null;
        if (skip || r.kind === "test" || r.events.length === 0) return;
        const take: Take = {
          chartId: played.id,
          startedAt: r.startedAt,
          latencyOffsetMs: r.latency,
          inputDevice: r.kind ?? "keys",
          events: r.events,
        };
        // Drills and variants (bar-loop, hand-mode, chunk practice, tempo) play a changed chart the server can't
        // rebuild: only a take of the committed chart is saved, so stored scores always match what was played.
        void loadChart(played.id).then((committed) => {
          if (committed && sameChart(committed, played)) sink(crypto.randomUUID(), take);
        });
      }
    },
  };
}

/** POST one take; maps the answer to what the outbox should do with it. */
export async function sendTake(item: OutboxItem): Promise<SendResult> {
  const session = await ensureSession();
  const res = await fetch("/api/takes", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ id: item.id, take: item.take }),
  });
  if (res.ok) return "ok";
  if (res.status === 424) return "later"; // the database refused a take the game accepted: resend after a migration
  if ([400, 409, 413, 422].includes(res.status)) return "drop"; // the take itself is bad: resending won't help
  return "retry"; // offline, 401 (session expired), 5xx, or not configured on the server
}

export function flushOutbox(): Promise<number> {
  if (!isConfigured()) return Promise.resolve(0);
  return flush(localStorage, sendTake);
}

/** The default sink: queue locally, then try to send in the background. Never throws into the game. */
export const queueAndSend: TakeSink = (id, take) => {
  try {
    enqueue(localStorage, id, take);
  } catch {
    return;
  }
  setTimeout(() => void flushOutbox().catch(() => {}), 0);
};
