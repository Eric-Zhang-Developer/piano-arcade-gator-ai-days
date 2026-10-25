// The HUD's `BAR n / N` (spec: duo-hud), from bar-lines' own lines, so the readout and the highway never disagree.
// n is the bar at the hit line now (the first bar during the count-in; a loop's empty bar keeps the bar before it), and
// N is the highest bar number: the song's last bar, or a loop's `to`.
import type { BarLine } from "../bar-lines";

export function barReadout(lines: BarLine[], nowMs: number): { n: number; N: number } {
  let n = 0;
  let N = 0;
  for (const b of lines) {
    if (b.label === null) continue;
    N = Math.max(N, b.label);
    if (n === 0 || b.atMs <= nowMs) n = b.label;
  }
  return { n, N };
}
