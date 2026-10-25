# Incident: a "before Monday" gate passed from agent to agent (2026-10-25)

Severity: nothing lost; Eric was asked to rule on a gate that no enforced file sets. Times are EDT. Blameless: each
agent repeated what the agent before it said.

## What happened

- **Sat 00:05.** `specs/milestones.toml` sets no deadlines: "No deadlines on purpose", `start` and every `ship` empty
  ([`000-defaults.md`](../../specs/decisions/000-defaults.md), row 15). This is what CI enforces.
- **Sat ~04:00.** In chat, the planner recommends "rank for the video first, freeze `main` at 5 PM, and continue after
  Monday". Eric answers "alright I agree with the recs" (04:01). Plan [#144] (merged 04:30) writes it into
  `specs/roadmap.md`: "`main` freezes Sun Oct 25 5:00 PM ET; whatever hasn't landed by then lands after the awards".
  `milestones.toml` isn't changed, so two files now disagree, and only one is enforced.
- **Sun 01:46.** The planner tells eric-asking-agent-3 its scope guard: anything that doesn't serve the video or the
  judging demo gets parked, "So flag whether Eric wants it before Monday." The asking agent saves this to its memory
  and tells Eric that every idea needs a "before Monday" answer (01:47).
- **02:53.** The asking agent asks Eric: "Do you want the nav bar before Monday?" Its comment on [#706] at 02:54:56
  records the answer: "wanted **before Monday**".
- **03:04.** Plan [#709] writes the gate into the nav-bar spec. [#735] later removes the same wording from the
  song-pack-3, song-pack-4 and duo-start specs too: "before Monday" and "cut it if it isn't merged by the final
  milestone's freeze". `milestones.toml` sets no freeze.
- **03:30.** [#733] (duo-start) opens. The planner's account says Eric was asked about Monday again here; the issue
  text on GitHub doesn't contain the word.
- **03:31.** Eric: "everything we're trying to do is before the shipping deadline. Why does this even exist?"
- **03:33.** [#735] drops the gate from four specs. The planner removes it from the asking agent's memory.

## Impact

- **Eric ruled on a gate no enforced file sets:** at least once on GitHub ([#706]), twice by the planner's account.
- **Four specs carried a cut rule tied to a freeze** that `milestones.toml` doesn't set.
- **Nothing lost.**

## Failure points

1. **A chat decision went into the roadmap, not into the enforced file.** Saturday's "freeze at 5 PM, continue after
   Monday" landed in `roadmap.md`, while `milestones.toml` still says no deadlines. Agents could cite either one.
2. **An offhand phrase became a rule.** "flag whether Eric wants it before Monday" was the planner's wording in a
   message. The asking agent stored it in memory as a process step, and the planner wrote it into four specs.
3. **Parking is the planner's decision, but it was asked of Eric.** Every idea he approves aims at the submission
   (`specs/context/event.md`: Devpost submission deadline, Sun Oct 25, 5:00 PM ET, a submission deadline, not a merge
   freeze).
4. **Same root as the merge rule ([ci-gridlock](2026-10-25-ci-gridlock.md), "A sensible rule that became the
   bottleneck"):** agent memory binds the next agent, and nobody reviews it.

## Rules from now on

- **Adopted:** the gate is gone from the asking agent's memory, and from four specs ([#735]).
- **Adopted:** every idea Eric approves aims at the submission. If the planner would park something, it decides and
  tells him; it doesn't ask him.
- **Pending: [#744]**, a `contract:` PR for Eric: "the submission deadline is Eric's, and feat merges freeze at 4 PM
  ET Sunday".
- **Open:** `specs/roadmap.md` still says "`main` freezes Sun Oct 25 5:00 PM ET". It needs a `plan:` PR to match
  whatever #744 settles.

[#144]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/144
[#706]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/706
[#709]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/709
[#733]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/733
[#735]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/735
[#744]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/744
