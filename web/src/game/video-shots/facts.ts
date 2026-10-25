// The end card's facts line (spec: video-cards): how many pull requests main has merged, and the first and last merge
// dates in Eastern time. Counted by build-sonata's rule: the first-parent log, a commit counted when its subject ends in
// a PR number (or is GitHub's "Merge pull request #n"), author fields never read. git can't tell who or what wrote a
// PR, so the line never says "by agents". make-facts.mjs writes facts.json from it; re-run it at the freeze.
export interface Facts {
  merged: number;
  first: string; // ISO date of the first merge, in ET
  last: string;
}

const etDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso)); // YYYY-MM-DD

export function factsFrom(log: readonly { time: string; subject: string }[], isPr: (subject: string) => boolean): Facts | null {
  const merged = log.filter((c) => isPr(c.subject)).sort((a, b) => a.time.localeCompare(b.time));
  if (!merged.length) return null;
  return { merged: merged.length, first: etDay(merged[0].time), last: etDay(merged.at(-1)!.time) };
}

// "1,204 pull requests merged, Oct 23–25, 2026", or with a month change "Sep 30–Oct 2, 2026". null when unknown.
export function factsLine(f: Facts | null): string | null {
  if (!f || f.merged < 1) return null;
  const day = (d: string) => new Date(`${d}T12:00:00Z`);
  const md = (d: string) => day(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const [a, b] = [day(f.first), day(f.last)];
  const year = b.getUTCFullYear();
  const range =
    f.first === f.last
      ? md(f.first)
      : a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === year
        ? `${md(f.first)}–${b.getUTCDate()}`
        : `${md(f.first)}–${md(f.last)}`;
  return `${f.merged.toLocaleString("en-US")} pull request${f.merged === 1 ? "" : "s"} merged, ${range}, ${year}`;
}
