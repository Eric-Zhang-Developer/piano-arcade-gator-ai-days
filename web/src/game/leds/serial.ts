// The Web Serial link to the LED board, ported from firmware/tester.html. One per page: it outlives a take, so the
// board stays connected from song to song. Writes never wait: a slow or gone port must not touch judging.
import { CLEAR, HEARTBEAT, HELLO, ledSettings, type Message } from "./messages";

export type LinkState = "off" | "unsupported" | "opening" | "ready" | "no-board" | "error";

// Just the Web Serial surface used here: TypeScript's DOM library doesn't have it.
interface Port {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}
interface Serial {
  requestPort(): Promise<Port>;
  getPorts(): Promise<Port[]>;
}
const serial = (): Serial | null =>
  typeof navigator !== "undefined" && "serial" in navigator ? (navigator as unknown as { serial: Serial }).serial : null;

let state: LinkState = "off";
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let busy = false; // load and a click can both try to open the same port
let beat: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function set(s: LinkState) {
  state = s;
  for (const l of listeners) l();
}

export const linkState = () => (serial() ? state : "unsupported");
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function send(m: Message) {
  if (state !== "ready" || !writer) return;
  writer.write(new Uint8Array(m)).catch(() => {});
}

async function open(port: Port) {
  if (busy) return;
  busy = true;
  set("opening");
  try {
    await port.open({ baudRate: 115200 });
  } catch {
    busy = false;
    return set("error"); // another program (the Arduino serial monitor) holds the port
  }
  writer = port.writable.getWriter();
  const w = writer;
  // Opening the port resets most ESP32 boards: ask again in case the boot line went by, give up after the timeout.
  setTimeout(() => w.write(new Uint8Array(HELLO)).catch(() => {}), 1800);
  setTimeout(() => state === "opening" && writer === w && set("no-board"), ledSettings.readyTimeoutMs);
  readLines(port, w);
}

async function readLines(port: Port, w: WritableStreamDefaultWriter<Uint8Array>) {
  const decoder = new TextDecoderStream();
  port.readable.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => {});
  const reader = decoder.readable.getReader();
  let buf = "";
  for (;;) {
    let r: ReadableStreamReadResult<string>;
    try {
      r = await reader.read();
    } catch {
      break; // unplugged
    }
    if (r.done) break;
    buf += r.value;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("PAL1 leds=") && state !== "ready") {
        set("ready");
        send(CLEAR);
        clearInterval(beat);
        beat = setInterval(() => send(HEARTBEAT), ledSettings.heartbeatMs);
      }
    }
  }
  clearInterval(beat);
  try {
    w.releaseLock();
  } catch {
    // already released
  }
  writer = null;
  await port.close().catch(() => {});
  busy = false;
  set("off");
}

// The button: Chrome's port picker, which needs a click.
export async function connect() {
  const s = serial();
  if (!s) return set("unsupported");
  try {
    await open(await s.requestPort());
  } catch {
    set("off"); // the picker was closed with no port
  }
}

// On load, a port Chrome granted before opens with no click, and so does a board plugged back in.
let auto = false;
export function autoConnect() {
  const s = serial();
  if (!s || auto) return;
  auto = true;
  s.getPorts().then(([p]) => p && open(p), () => {});
  (s as unknown as EventTarget).addEventListener?.("connect", (e) => open(e.target as unknown as Port));
  addEventListener("pagehide", () => send(CLEAR));
}
