// The end card's facts (spec: video-cards). Re-run it at the freeze and commit what it writes:
//   node web/src/game/video-shots/make-facts.mjs [ref]     (ref: origin/main by default)
// Reads git's first-parent log (subject and commit time only; never an author field) and writes facts.json here.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { parseSubject } from "../x/build-sonata/sonata.ts";
import { factsFrom } from "./facts.ts";

// The first-parent log of `ref` in `cwd`: each commit's committer time and subject.
export function firstParentLog(cwd, ref) {
  const out = execFileSync("git", ["log", "--first-parent", "--format=%cI%x09%s", ref], { cwd, encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((line) => {
    const tab = line.indexOf("\t");
    return { time: line.slice(0, tab), subject: line.slice(tab + 1) };
  });
}

export const isPr = (subject) => parseSubject(subject) !== null;

if (import.meta.url === `file://${process.argv[1]}`) {
  const here = new URL(".", import.meta.url).pathname;
  const ref = process.argv[2] ?? "origin/main";
  const facts = factsFrom(firstParentLog(here, ref), isPr);
  writeFileSync(new URL("./facts.json", import.meta.url), `${JSON.stringify({ ref, ...facts }, null, 2)}\n`);
  process.stdout.write(`make-facts: ${facts ? `${facts.merged} PRs merged, ${facts.first} to ${facts.last} (ET)` : "no merged PR found"} on ${ref}\n`);
}
