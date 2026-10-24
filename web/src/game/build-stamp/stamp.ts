// The build stamp's text (spec: build-stamp). Pure, so the thresholds test without a page or a clock.

export const STALE_AFTER_MIN = 120; // a starting value: main gets a commit every few minutes on a busy night

const MIN = 60_000;

export function stampText(sha: string | null, committedAt: string | null, now: number): { text: string; stale: boolean } {
  const at = committedAt === null ? NaN : Date.parse(committedAt);
  if (!sha || Number.isNaN(at)) return { text: "unknown build", stale: false };
  const ms = Math.max(0, now - at); // a commit in the future (clock skew) counts as 0
  const min = Math.floor(ms / MIN);
  const age = min < 60 ? `${min} min old` : min < 48 * 60 ? `${Math.floor(min / 60)} h old` : `${Math.floor(min / (24 * 60))} d old`;
  const stale = ms > STALE_AFTER_MIN * MIN;
  return { text: `${sha} · ${age}${stale ? " · behind main?" : ""}`, stale };
}
