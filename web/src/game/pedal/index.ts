// The sustain pedal for a local song's autoplay (spec: golden-demo). A sidecar next to the chart,
// songs/local/<id>/pedal.json: { "pedal": [[down, up], …] }, each pair in beats on the chart clock. The bot sends it to
// the piano as CC64 on the same queue as its notes. Local-only, like the recording (decision 003, amended).
export type Pedal = [number, number][];

// Valid: down < up, pairs in order and not overlapping (a re-pedal may put a down on the last up). Anything else: null.
export function parsePedal(raw: unknown): Pedal | null {
  const pairs = (raw as { pedal?: unknown } | null)?.pedal;
  if (!Array.isArray(pairs)) return null;
  let last = -Infinity;
  for (const pair of pairs) {
    if (!Array.isArray(pair) || pair.length !== 2 || !pair.every((x) => Number.isFinite(x))) return null;
    const [down, up] = pair as [number, number];
    if (down < last || down >= up) return null;
    last = up;
  }
  return pairs as Pedal;
}

// No file: no pedal, quietly. A file that doesn't parse: no pedal, and one warning.
export async function loadPedal(song: string): Promise<Pedal | null> {
  const res = await fetch(`/songs/${song}/pedal.json`).catch(() => null);
  if (!res?.ok) return null;
  const pedal = parsePedal(await res.json().catch(() => null));
  if (!pedal) console.warn(`pedal: songs/${song}/pedal.json isn't { "pedal": [[down, up], …] } in beats, in order: no pedal`);
  return pedal;
}

// The CC64 values to send, in chart ms, from `fromMs` on: a pair already over sends nothing, and a pair `fromMs` falls
// inside sends its down at `fromMs`, so a resume mid-pair still sustains.
export function pedalEvents(pedal: Pedal, msPerBeat: number, fromMs = -Infinity): { atMs: number; value: 0 | 127 }[] {
  return pedal.flatMap(([down, up]) => {
    const [d, u] = [down * msPerBeat, up * msPerBeat];
    if (u < fromMs) return [];
    return [
      { atMs: Math.max(d, fromMs), value: 127 as const },
      { atMs: u, value: 0 as const },
    ];
  });
}
