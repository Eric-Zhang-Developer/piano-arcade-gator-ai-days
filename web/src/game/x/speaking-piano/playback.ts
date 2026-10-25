// The Speaking Piano's playback (spike: speaking-piano, #1153): a phrase's frames become timed MIDI for the "Portable
// Grand" (the DGX, or laptop-sound's virtual one), handed over on piano-out's lookahead so Stop leaves at most that
// much queued. The caps are hard: no velocity above velCap and no more than n notes a frame, whatever the table says.
import { allNotesOff, pianoOutSettings, type Message } from "../../piano-out";
import { silence } from "../composers-hands/rolls";

export interface Caps {
  velCap: number;
  n: number;
}

export interface PlayFrame {
  tMs: number;
  strikes: [number, number][]; // [key, velocity]
}

export const playbackSettings = {
  leadMs: 120, // from the press to the first strike
  gapMs: 2, // a strike's note-off lands this long before the next frame's note-on, so a re-strike re-sounds
};

const PEDAL_UP = (atMs: number): Message => ({ bytes: [0xb0, 64, 0], atMs });

/** Pure: every message of a phrase, from startMs (performance.now() time), ending in All Notes Off and pedal up. */
export function phraseMessages(frames: PlayFrame[], frameMs: number, startMs: number, caps: Caps): Message[] {
  const out: Message[] = [];
  for (const f of frames) {
    const on = startMs + f.tMs;
    const kept = [...f.strikes].sort((a, b) => b[1] - a[1]).slice(0, caps.n); // the loudest n, if a table holds more
    for (const [key, vel] of kept) {
      out.push({ bytes: [0x90, key, Math.max(1, Math.min(caps.velCap, vel))], atMs: on });
      out.push({ bytes: [0x80, key, 0], atMs: on + frameMs - playbackSettings.gapMs });
    }
  }
  out.sort((a, b) => a.atMs - b.atMs || (a.bytes[0] === 0x80 ? -1 : 1));
  const end = startMs + (frames.at(-1)?.tMs ?? 0) + frameMs;
  return [...out, ...allNotesOff(end), PEDAL_UP(end)];
}

export interface Output {
  send(data: number[], timestamp?: number): void;
  clear?(): void;
}

export interface Player {
  stop(): void;
  done: Promise<void>;
}

/** Hands the messages to the output pianoOutSettings.lookaheadMs ahead of their time. Stop: clear what's queued, then
 * All Notes Off and pedal up now and again after the lookahead, since Chrome can't clear what it already holds. */
export function play(output: Output, messages: Message[], now = () => performance.now()): Player {
  let i = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let finish = () => {};
  const done = new Promise<void>((r) => (finish = r));
  const pump = () => {
    const until = now() + pianoOutSettings.lookaheadMs;
    while (i < messages.length && messages[i].atMs <= until) {
      output.send(messages[i].bytes, messages[i].atMs);
      i++;
    }
    if (i >= messages.length) {
      if (timer) clearInterval(timer);
      timer = null;
      // Resolves once the last message (All Notes Off) is due, so the page reveals the subtitle as the sound ends.
      setTimeout(finish, Math.max(0, (messages.at(-1)?.atMs ?? 0) - now()));
    }
  };
  timer = setInterval(pump, 25);
  pump();
  return {
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      i = messages.length;
      silence(output, now(), pianoOutSettings.lookaheadMs);
      finish();
    },
    done,
  };
}

/** Leaving the page silences the piano: a DGX keeps sounding whatever was struck last. Returns the remover. */
export function silenceOnPagehide(target: Pick<EventTarget, "addEventListener" | "removeEventListener">, stop: () => void): () => void {
  target.addEventListener("pagehide", stop);
  return () => target.removeEventListener("pagehide", stop);
}
