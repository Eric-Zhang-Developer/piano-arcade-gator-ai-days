// The Web Serial link to the LED board, ported from firmware/tester.html. One per page: it outlives a take, so the
// board stays connected from song to song. Writes never wait: a slow or gone port must not touch judging.
import { CLEAR, HEARTBEAT, HELLO, ledSettings, type Message } from "./messages";

// "elsewhere": another tab of this site took the board; "blocked": the browser's site settings refuse serial ports.
export type LinkState = "off" | "unsupported" | "opening" | "ready" | "no-board" | "error" | "elsewhere" | "blocked";

// Just the Web Serial surface used here: TypeScript's DOM library doesn't have it.
interface Port {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}
interface Serial {
  requestPort(o?: { filters: { usbVendorId: number }[] }): Promise<Port>;
  getPorts(): Promise<Port[]>;
}
// The USB-to-serial chips LED boards use, so the port picker lists the board and not Bluetooth or a phone:
// Silicon Labs CP210x (our ESP32 DevKit), WCH CH340, FTDI, and Espressif's own USB (ESP32-S2/S3/C3).
const BOARD_CHIPS = [0x10c4, 0x1a86, 0x0403, 0x303a].map((usbVendorId) => ({ usbVendorId }));
const serial = (): Serial | null =>
  typeof navigator !== "undefined" && "serial" in navigator ? (navigator as unknown as { serial: Serial }).serial : null;

let state: LinkState = "off";
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
let busy = false; // a port is open (or opening) and its reader runs
let reader: ReadableStreamDefaultReader<string> | null = null;
let closed: Promise<void> = Promise.resolve(); // settles once the open port is closed again
let attempt = 0; // the newest open wins: load, a click and a plugged-in board can all try at once
let beat: ReturnType<typeof setInterval> | undefined;
let brightness: number | null = null; // the board's, from its last hello line
const listeners = new Set<() => void>();

// One board, many tabs: a port opens in one tab at a time. The tab that wants the lights (a click, a load, coming back
// into view) asks the others to let go, and the one holding them closes its port.
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("pa-lights") : null;
let handedOff = false;
if (channel)
  channel.onmessage = (e) => {
    if (e.data !== "release" || !busy) return;
    handedOff = true;
    void reader?.cancel().catch(() => {});
  };
const askOthersToRelease = () => new Promise<void>((done) => (channel ? (channel.postMessage("release"), setTimeout(done, 700)) : done()));

function set(s: LinkState) {
  state = s;
  for (const l of listeners) l();
}

export const linkState = () => (serial() ? state : "unsupported");
export const boardBrightness = () => brightness;

// Why there's no Web Serial here, for the button. Chrome, Edge and Brave (1.69 on; older Brave hid it) have it, but
// only on https or localhost: the same site over plain http from another laptop gets none.
export function noSerialReason(): string {
  if (typeof window !== "undefined" && !window.isSecureContext) return "Lights need https (or localhost)";
  if (typeof navigator !== "undefined" && "brave" in navigator) return "Lights: update Brave, then allow Serial ports for this site";
  return "Lights need Chrome, Edge or Brave (Web Serial)";
}
export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function send(m: Message) {
  if (state !== "ready" || !writer) return;
  writer.write(new Uint8Array(m)).catch(() => {});
}

async function open(port: Port) {
  if (state === "ready") return;
  const mine = ++attempt;
  // A port still open from a try that got no answer (the wrong port, or a board that was asleep) is closed first,
  // so "Try again" really tries again.
  if (busy) {
    await reader?.cancel().catch(() => {});
    await closed;
  }
  if (mine !== attempt || busy) return;
  busy = true;
  set("opening");
  try {
    await port.open({ baudRate: 115200 });
  } catch {
    // Another tab of this site may hold it: ask it to let go, then try once more. Still shut: another program (the
    // Arduino serial monitor), or no permission to the device (Linux without the dialout group).
    await askOthersToRelease();
    try {
      await port.open({ baudRate: 115200 });
    } catch {
      busy = false;
      return set("error");
    }
  }
  writer = port.writable.getWriter();
  const w = writer;
  // Opening the port resets most ESP32 boards: ask again in case the boot line went by, give up after the timeout.
  setTimeout(() => w.write(new Uint8Array(HELLO)).catch(() => {}), 1800);
  setTimeout(() => state === "opening" && writer === w && set("no-board"), ledSettings.readyTimeoutMs);
  closed = readLines(port, w);
}

async function readLines(port: Port, w: WritableStreamDefaultWriter<Uint8Array>) {
  const decoder = new TextDecoderStream();
  const piped = port.readable.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => {});
  const r8 = decoder.readable.getReader();
  reader = r8;
  let buf = "";
  for (;;) {
    let r: ReadableStreamReadResult<string>;
    try {
      r = await r8.read();
    } catch {
      break; // unplugged
    }
    if (r.done) break;
    buf += r.value;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      const bright = /^PAL1 leds=.* bright=(\d+)/.exec(line);
      if (bright) {
        brightness = Number(bright[1]);
        for (const l of listeners) l();
      }
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
  reader = null;
  await piped; // the port can't close while its readable is still piped
  await port.close().catch(() => {});
  busy = false;
  set(handedOff ? "elsewhere" : "off");
  handedOff = false;
}

// Resolves with the link's next settled state: ready, or a try that ended without a board.
const settled = () =>
  new Promise<LinkState>((done) => {
    const l = () => {
      if (state === "opening") return;
      listeners.delete(l);
      done(state);
    };
    listeners.add(l);
  });

// The button: the browser's port picker, which needs a click. It lists the USB-serial boards; if none is plugged
// in it's empty, which says so better than a list of Bluetooth ports. `anyPort` lists every port, for a board on
// a chip BOARD_CHIPS doesn't name. With the lights in another tab, it takes them back with no picker.
export async function connect(anyPort = false) {
  const s = serial();
  if (!s) return set("unsupported");
  if (state === "elsewhere" && !anyPort) return reclaim();
  let port: Port;
  try {
    port = await s.requestPort(anyPort ? undefined : { filters: BOARD_CHIPS });
  } catch (e) {
    // SecurityError: the site's serial permission is blocked (Brave and Chrome site settings, or a policy).
    if (state !== "ready" && !busy) set((e as Error).name === "SecurityError" ? "blocked" : "off"); // else: closed with no port
    return;
  }
  await open(port);
}

// Every port this browser was given, in turn, until one answers: a board on another USB socket, or a second device
// granted before it, shouldn't leave the strip dark after a reload (a sign-in's redirect is one).
async function reclaim() {
  const s = serial();
  if (!s) return;
  const ports = await s.getPorts().catch(() => [] as Port[]);
  for (const p of ports) {
    if (state === "ready") return;
    const before = attempt;
    await open(p);
    if (attempt !== before + 1) return; // a click or a plugged-in board took over
    if ((state === "opening" ? await settled() : state) === "ready" || attempt !== before + 1) return;
  }
}

// On load, a port Chrome granted before opens with no click, and so does a board plugged back in.
let auto = false;
export function autoConnect() {
  const s = serial();
  if (!s || auto) return;
  auto = true;
  void reclaim();
  (s as unknown as EventTarget).addEventListener?.("connect", (e) => open(e.target as unknown as Port));
  addEventListener("pagehide", () => send(CLEAR));
  // The tab you're looking at gets the lights: coming back to one that handed them to another tab takes them back.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state === "elsewhere") void reclaim();
  });
}
