// A sign-in makes the LED strip dance once, about three seconds: two comets race in from both ends, meet in the
// middle, burst back out in a magenta-to-cyan wave, then the strip sparkles and goes dark. It goes through the board
// link the Lights button already opened (game/leds/serial); with no board, or the board not ready within a few
// seconds, it does nothing. Released keys fade on the board (its own 180 ms fade), which draws the comets' tails.
import { CLEAR, keyOff, keyOn, rgb7, type Message, type Rgb } from "../../game/leds/messages";
import { linkState, send, subscribe } from "../../game/leds/serial";

const LOW = 21; // A0
const HIGH = 108; // C8
const MID = Math.round((LOW + HIGH) / 2);
const WAIT_MS = 6000;

const MAGENTA = rgb7("#ff2fd0");
const CYAN = rgb7("#22e6ff");
const GOLD = rgb7("#ffd23f");
const WHITE: Rgb = [127, 127, 127];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as Rgb;

/** The show as [time ms, message] pairs. Pure, so a test can pin it. */
export function signInShow(): [number, Message][] {
  const show: [number, Message][] = [];
  const at = (ms: number, m: Message) => show.push([Math.round(ms), m]);

  // 1. Comets: one from each end toward the middle, 3 keys long, 12 ms a key.
  const steps = MID - LOW;
  for (let i = 0; i <= steps; i++) {
    const t = i * 12;
    at(t, keyOn(LOW + i, MAGENTA));
    at(t, keyOn(HIGH - i, CYAN));
    if (i >= 3) {
      at(t, keyOff(LOW + i - 3));
      at(t, keyOff(HIGH - i + 3));
    }
  }
  const meet = steps * 12;

  // 2. Burst: a flash of white at the middle, then a wave rushing back out to both ends, magenta into cyan.
  at(meet + 20, keyOn(MID, WHITE));
  for (let d = 0; d <= HIGH - MID; d++) {
    const t = meet + 60 + d * 7;
    const c = mix(MAGENTA, CYAN, d / (HIGH - MID));
    if (MID - d >= LOW) at(t, keyOn(MID - d, c));
    if (MID + d <= HIGH) at(t, keyOn(MID + d, c));
  }
  const full = meet + 60 + (HIGH - MID) * 7;

  // 3. Sparkle: the strip drops away and gold and white twinkle across it, then dark.
  at(full + 350, CLEAR);
  for (let n = 0; n < 40; n++) {
    const key = LOW + ((n * 37) % (HIGH - LOW + 1)); // spread out, the same every time
    const t = full + 400 + n * 28;
    at(t, keyOn(key, n % 3 ? GOLD : WHITE));
    at(t + 140, keyOff(key));
  }
  at(full + 400 + 40 * 28 + 300, CLEAR);
  return show.sort((a, b) => a[0] - b[0]);
}

function play(): void {
  for (const [ms, m] of signInShow()) setTimeout(() => send(m), ms);
}

/** Runs the sign-in show now, or as soon as the board connects (giving up after a few seconds). */
export function signInLights(): void {
  if (linkState() === "ready") return play();
  let done = false;
  const stop = subscribe(() => {
    if (done || linkState() !== "ready") return;
    done = true;
    stop();
    play();
  });
  setTimeout(() => {
    done = true;
    stop();
  }, WAIT_MS);
}
