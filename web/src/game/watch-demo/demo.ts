// Watch demo's pure parts (spec: watch-demo): the URL W opens, which keys are W, and when the demo returns to /.

export const watchSettings = { returnMs: 8000 }; // on the results, then back to the select

export const watchUrl = (id: string) => `/play?${new URLSearchParams({ song: id, bot: "perfect", audible: "1", demo: "1" })}`;

// Plain w or W, as learn-from-select's L: Ctrl/Meta+W close the tab and a held key repeats.
export const isWatchKey = (e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "repeat">) =>
  (e.key === "w" || e.key === "W") && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;

// When the demo goes back to /, as a performance.now() time: armed at songEnd, cleared by a Retry or a quit.
export function returnAt(at: number | null, e: { type: string }, now: number): number | null {
  if (e.type === "songEnd") return now + watchSettings.returnMs;
  if (e.type === "songStart" || e.type === "quit") return null;
  return at;
}
