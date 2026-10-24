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

interface Recording {
  zeroPerf: number;
  latency: number;
  startedAt: string;
  kind: InputKind | null;
  events: Take["events"];
}

export function createSavePlugin(sink: TakeSink): GamePlugin {
  let chart: Chart | null = null;
  let drill = false;
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
      // Drills (bar-loop) judge a transformed chart the server can't rebuild yet: not saved for now.
      drill = params.has("from") || params.has("to") || params.has("tempo");
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
        rec = null;
        if (drill || r.kind === "test" || r.events.length === 0) return;
        sink(crypto.randomUUID(), {
          chartId: chart.id,
          startedAt: r.startedAt,
          latencyOffsetMs: r.latency,
          inputDevice: r.kind ?? "keys",
          events: r.events,
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
