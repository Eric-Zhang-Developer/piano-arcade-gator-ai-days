// The band's MIDI: read a Standard MIDI File into timed events, pick the events due in a chart-time window, and the
// messages for setup and silence. Plain JS so the game (TypeScript, allowJs) and the band player page
// (spikes/band-player/, a browser module) play the same thing.

/** @typedef {{ atMs: number, data: number[] }} BandEvent  file time in ms; one channel message */

/** GM System On. */
export const GM_ON = [0xf0, 0x7e, 0x7f, 0x09, 0x01, 0xf7];

/**
 * Reads format 0 or 1, tracks merged: running status, note-on velocity 0 as note-off, the tempo map from every FF 51
 * on any track. Meta and SysEx events are skipped. Throws, with a reason, on SMPTE division, format 2 and cut-short
 * files.
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {{ events: BandEvent[], endMs: number, channels: number[], channel1Notes: number, beatMs: number }}
 *   channels are 1-based; beatMs is a quarter note at the file's first tempo.
 */
export function readMidi(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  let p = 0;
  const need = (n) => {
    if (p + n > b.length) throw new Error("the file is cut short");
  };
  const u8 = () => (need(1), b[p++]);
  const u16 = () => (need(2), (p += 2), (b[p - 2] << 8) | b[p - 1]);
  const u32 = () => (need(4), (p += 4), ((b[p - 4] << 24) | (b[p - 3] << 16) | (b[p - 2] << 8) | b[p - 1]) >>> 0);
  const tag = () => (need(4), (p += 4), String.fromCharCode(...b.subarray(p - 4, p)));
  const vlq = () => {
    let v = 0;
    for (let i = 0; i < 4; i++) {
      const x = u8();
      v = (v << 7) | (x & 0x7f);
      if (!(x & 0x80)) return v;
    }
    throw new Error("a delta time is longer than 4 bytes");
  };

  if (tag() !== "MThd") throw new Error("not a MIDI file");
  const headLen = u32();
  const format = u16(), ntrk = u16(), division = u16();
  p = 8 + headLen;
  if (format > 1) throw new Error(`format ${format} isn't supported (0 or 1 only)`);
  if (division & 0x8000) throw new Error("SMPTE time division isn't supported");

  /** @type {{ tick: number, data: number[] }[]} */
  const raw = [];
  /** @type {{ tick: number, us: number }[]} */
  const tempos = [];
  for (let k = 0; k < ntrk; k++) {
    if (tag() !== "MTrk") throw new Error(`track ${k + 1} has no MTrk header`);
    const end = u32() + p;
    if (end > b.length) throw new Error("the file is cut short");
    let tick = 0, status = 0;
    while (p < end) {
      tick += vlq();
      if (b[p] & 0x80) status = u8();
      else if (!status) throw new Error("running status with no status before it");
      if (status === 0xff) {
        const type = u8(), len = vlq();
        need(len);
        if (type === 0x51 && len === 3) tempos.push({ tick, us: (b[p] << 16) | (b[p + 1] << 8) | b[p + 2] });
        p += len;
        status = 0; // meta and SysEx cancel running status
      } else if (status === 0xf0 || status === 0xf7) {
        const len = vlq();
        need(len);
        p += len;
        status = 0;
      } else {
        const kind = status & 0xf0;
        const data = [status, u8()];
        if (kind !== 0xc0 && kind !== 0xd0) data.push(u8());
        if (kind === 0x90 && data[2] === 0) data[0] = 0x80 | (status & 0x0f);
        raw.push({ tick, data });
      }
    }
  }

  tempos.sort((x, y) => x.tick - y.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, us: 500000 });
  // ms at each tempo change, then ms(tick) from the last change at or before it
  const at = [0];
  for (let i = 1; i < tempos.length; i++)
    at.push(at[i - 1] + ((tempos[i].tick - tempos[i - 1].tick) * tempos[i - 1].us) / division / 1000);
  const ms = (tick) => {
    let i = tempos.length - 1;
    while (tempos[i].tick > tick) i--;
    return at[i] + ((tick - tempos[i].tick) * tempos[i].us) / division / 1000;
  };

  const events = raw.map((e) => ({ atMs: ms(e.tick), data: e.data })).sort((x, y) => x.atMs - y.atMs);
  const channels = [...new Set(events.map((e) => (e.data[0] & 0x0f) + 1))].sort((x, y) => x - y);
  const channel1Notes = events.filter((e) => e.data[0] === 0x90).length;
  return { events, endMs: events.length ? events[events.length - 1].atMs : 0, channels, channel1Notes, beatMs: tempos[0].us / 1000 };
}

/** First index with atMs >= ms. */
function lowerBound(events, ms) {
  let lo = 0, hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].atMs < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The events due in the chart-time window [fromMs, toMs), with atMs on the chart clock. File time m plays at
 * (m - seekMs) × 100 / tempo + k × passMs on pass k; only m in [seekMs, untilMs) plays. Consecutive windows never
 * return an event twice.
 * @param {BandEvent[]} events sorted by atMs, as readMidi returns them
 * @param {number} fromMs
 * @param {number} toMs
 * @param {{ tempo?: number, seekMs?: number, untilMs?: number, passMs?: number, passes?: number }} [opts]
 *   tempo in percent (default 100); untilMs is the segment's end in file time (default: none)
 * @returns {BandEvent[]}
 */
export function between(events, fromMs, toMs, { tempo = 100, seekMs = 0, untilMs = Infinity, passMs = Infinity, passes = 1 } = {}) {
  const scale = tempo / 100;
  const out = [];
  for (let k = 0; k < passes; k++) {
    const base = k ? k * passMs : 0;
    const lo = Math.max(fromMs, base), hi = Math.min(toMs, base + passMs);
    if (lo >= hi) continue;
    const mLo = Math.max(seekMs, seekMs + (lo - base) * scale), mHi = Math.min(untilMs, seekMs + (hi - base) * scale);
    for (let i = lowerBound(events, mLo); i < events.length && events[i].atMs < mHi; i++)
      out.push({ atMs: (events[i].atMs - seekMs) / scale + base, data: events[i].data });
  }
  return out;
}

/**
 * The state at a seek point, to send before playing from it: per channel, the last program change and the last value
 * of each controller at or before seekMs. The sustain pedal (CC 64) is left out: it starts up.
 * @param {BandEvent[]} events
 * @param {number} seekMs
 * @returns {number[][]}
 */
export function setup(events, seekMs) {
  /** @type {Map<string, number[]>} */
  const last = new Map();
  for (const e of events) {
    if (e.atMs > seekMs) break;
    const kind = e.data[0] & 0xf0;
    if (kind === 0xc0) last.set(`${e.data[0]}`, e.data);
    else if (kind === 0xb0 && e.data[1] !== 64) last.set(`${e.data[0]}:${e.data[1]}`, e.data);
  }
  return [...last.values()];
}

/**
 * All Notes Off (CC 123) and pedal up (CC 64 = 0) on each channel listed, 1-based.
 * @param {number[]} channels
 * @returns {number[][]}
 */
export function silence(channels) {
  return channels.flatMap((ch) => [[0xb0 | (ch - 1), 123, 0], [0xb0 | (ch - 1), 64, 0]]);
}
