// Finished takes wait here until the server confirms them. Retries reuse the take's id, and the server
// ignores an id it already has, so a retry can never make a duplicate.
import type { Take } from "../contracts";

export interface OutboxItem {
  id: string; // the take's UUID, made in the browser
  take: Take;
  queuedAt: string;
  sent: boolean; // true once the server confirmed it (kept for the offline progress view)
}

// "later": the take is fine but the database can't take it yet (its schema is behind the game's contracts).
// Keep it unsent and move on to the next one, so one stuck take never blocks the rest.
export type SendResult = "ok" | "retry" | "later" | "drop";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export const OUTBOX_KEY = "pianoArcade.outbox";
const MAX_ITEMS = 200;

export function readOutbox(storage: Storage): OutboxItem[] {
  try {
    const v = JSON.parse(storage.getItem(OUTBOX_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(storage: Storage, items: OutboxItem[]): void {
  try {
    storage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // storage full or blocked: the take is lost locally, play goes on
  }
}

export function enqueue(storage: Storage, id: string, take: Take, now = new Date()): void {
  const items = readOutbox(storage);
  if (items.some((i) => i.id === id)) return;
  write(storage, [...items, { id, take, queuedAt: now.toISOString(), sent: false }]);
}

/** Sends every unsent item in order. Stops at the first "retry" (offline or server down) to keep order. */
export async function flush(storage: Storage, send: (item: OutboxItem) => Promise<SendResult>): Promise<number> {
  let sent = 0;
  for (const item of readOutbox(storage).filter((i) => !i.sent)) {
    let r: SendResult;
    try {
      r = await send(item);
    } catch {
      r = "retry";
    }
    if (r === "retry") break;
    if (r === "later") continue;
    // "drop": the server rejected it for good (invalid take); keep it locally but stop resending
    write(storage, readOutbox(storage).map((i) => (i.id === item.id ? { ...i, sent: true } : i)));
    if (r === "ok") sent++;
  }
  return sent;
}
