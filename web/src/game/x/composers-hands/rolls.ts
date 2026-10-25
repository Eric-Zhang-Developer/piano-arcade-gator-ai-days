// The rolls this spike knows (spike: composers-hands), every field from spikes/composers-hands/sources.md: quoted from
// the archive's page, empty where the page is silent. The files are local (decision composers-hands-rolls-local), so
// they load only on Eric's machine; anywhere else the page offers the test roll, built from our own chart.
import type { Chart } from "../../../contracts";
import { allNotesOff } from "../../piano-out";
import type { Roll } from "./roll";

export interface RollInfo {
  file: string; // under web/public, self-ignored
  performer: string; // as credited
  maker: string;
  number: string;
  year: string; // the source table's own value; empty when the page gives none
  type: string;
  page: string; // the archive page the fields come from
}

export const ROLLS: Record<string, RollInfo> = {
  "rachmaninoff-prelude-cs": {
    file: "/rolls/local/rachmaninoff-prelude-cs.mid",
    performer: "Rachmaninoff, Sergei",
    maker: "Ampico",
    number: "57504",
    year: "1922",
    type: "Ampico, reproducing (emulated MIDI)",
    page: "https://www.pianorollmusic.org/rolldatabase.php?sortby=composer&showpage=61",
  },
  "maple-leaf-rag": {
    file: "/rolls/local/maple-leaf-rag.mid",
    performer: "Joplin, Scott",
    maker: "Connorized",
    number: "10265",
    year: "1916",
    type: "",
    page: "https://www.pianorollmusic.org/rolldatabase.php?sortby=composer&showpage=46",
  },
};

// The test roll: our chart's notes at its own tempo, for checks and for a machine without the local roll. It is never
// shown as a performance; the page says what it is.
export function testRoll(chart: Chart): Roll {
  const mpb = 60000 / chart.bpm;
  return {
    notes: chart.notes
      .map((n) => ({ pitch: n.pitch, onMs: n.beat * mpb, offMs: (n.beat + n.duration) * mpb, velocity: n.velocity ?? 80 }))
      .sort((a, b) => a.onMs - b.onMs),
    pedal: [],
    dynamics: chart.notes.some((n) => n.velocity !== undefined),
  };
}

export interface Send {
  bytes: number[];
  atMs: number; // roll time
}

// What goes to the piano in [fromMs, toMs) of roll time, on channel 1: note-ons, note-offs and the pedal, in time order,
// a note-off before a note-on at the same time, so a repeated pitch isn't cut by its own release.
export function sendsBetween(notes: { pitch: number; onMs: number; offMs: number; velocity: number }[], pedal: Roll["pedal"], fromMs: number, toMs: number): Send[] {
  const out: (Send & { rank: number })[] = [];
  const inside = (t: number) => t >= fromMs && t < toMs;
  for (const n of notes) {
    if (inside(n.onMs)) out.push({ bytes: [0x90, n.pitch, n.velocity], atMs: n.onMs, rank: 2 });
    if (inside(n.offMs)) out.push({ bytes: [0x80, n.pitch, 0], atMs: n.offMs, rank: 1 });
  }
  for (const p of pedal) if (inside(p.atMs)) out.push({ bytes: [0xb0, 64, p.down ? 127 : 0], atMs: p.atMs, rank: 0 });
  return out.sort((a, b) => a.atMs - b.atMs || a.rank - b.rank).map(({ bytes, atMs }) => ({ bytes, atMs }));
}

export const AHEAD_MS = 150; // the scheduler queues this far ahead, timestamped
export type Out = { send(data: number[], timestamp?: number): void; clear?(): void; name?: string | null };

// Every stop (#1206): the button, the end, unmount and pagehide. Drop what's queued where the port can, then All Notes
// Off and the pedal up now and again aheadMs later, since note-ons and pedal-downs may be queued that far ahead. The
// other DGX pages pass their own scheduler's lookahead (#1311, #1312).
export function silence(out: Out | null, now: number, aheadMs = AHEAD_MS) {
  if (!out) return;
  if (typeof out.clear === "function") out.clear();
  for (const at of [now, now + aheadMs]) {
    for (const m of allNotesOff(at)) out.send(m.bytes, m.atMs);
    out.send([0xb0, 64, 0], at);
  }
}
