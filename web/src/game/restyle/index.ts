// Restyle's melody lock (spec: restyle-spike): a restyled chart may change every beat, the tempo, the meter and the
// whole left hand, but its right hand must be the source's melody, one note per onset, pitch for pitch, in order.
// Pure; nothing imports it but its test, which checks every restyle under web/public/songs/.
import type { Chart } from "../../contracts";
import { melody } from "../simon";

export { melody }; // the same rule as Simon Says: the right hand's top note at each onset, in beat order

// Empty when locked; otherwise each problem, naming the first note that differs.
export function lockProblems(source: Chart, restyled: Chart): string[] {
  const p: string[] = [];
  const onsets = new Map<number, Chart["notes"]>();
  for (const n of restyled.notes) if (n.hand === "R") onsets.set(n.beat, [...(onsets.get(n.beat) ?? []), n]);
  for (const [beat, g] of onsets)
    if (g.length > 1) p.push(`right-hand chord at beat ${beat}: ${g.map((n) => `${n.id} (${n.pitch})`).join(", ")}`);

  const want = melody(source);
  const got = melody(restyled);
  const i = want.findIndex((n, k) => got[k]?.pitch !== n.pitch);
  if (i >= 0) {
    const g = got[i];
    p.push(`melody note ${i + 1}: source ${want[i].id} is ${want[i].pitch}, restyle ${g ? `${g.id} is ${g.pitch}` : "has none"}`);
  } else if (got.length > want.length) {
    p.push(`melody note ${want.length + 1}: restyle ${got[want.length].id} (${got[want.length].pitch}) is past the source's ${want.length} notes`);
  }
  return p;
}

// A restyle's id is `<source id>-<style>`: its source is the longest library id that prefixes it.
export function sourceIdFor(restyleId: string, ids: string[]): string | null {
  return ids.filter((id) => restyleId.startsWith(`${id}-`)).sort((a, b) => b.length - a.length)[0] ?? null;
}
