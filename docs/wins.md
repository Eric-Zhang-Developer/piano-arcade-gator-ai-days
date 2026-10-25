# Wins log

What worked, so it gets kept and repeated. It's the counterpart to [incidents](incidents/README.md). Newest first.
Times are EDT. Same rule as the incident log: every claim points to evidence.

| When | What worked | Why it mattered | Evidence |
|---|---|---|---|
| 2026-10-25 01:58–02:12 | **Shards balanced by measured seconds.** `shard()` puts the longest check first onto the shard with the fewest seconds so far, from a table of each check's seconds on a real `main` run | Round-robin had left one shard with 17.2 min of checks, so it hit the 20 min job limit and every full run went red. The table predicted 10.4–10.5 min a shard against round-robin's 6.0–17.2. `main`'s next full run passed with shards at 10.1–12.4 min | [#674], [the decision](../specs/decisions/ci-browser-shard-balance.md), main run 40168284871 at `def5bf8` |
| 2026-10-25 01:47 | **A second agent checked the citations before merge.** The planner checked 15 of the build story's claims against git and gh, and 14 held. The 15th quoted the relaying agent's words as Eric's, and it was fixed before merge | The story went out with every quote traceable to who said it | [#677]'s squash commit `5b6e78c` and fix commit `1634c20` |
| 2026-10-24 23:14 to 2026-10-25 00:14 | **From Eric's approval to a merged feature in an hour.** A grill round settled 10 decisions. Then came the issue (23:14), the plan PR (merged 23:21), and the feature, with a browser check passing 9 of 9 (merged 00:14) | A strict mode Eric called "completely undemoable" got its fix the same hour he played it | [#618], [#620], [#625] |
| 2026-10-24 13:31–20:43 | **Test players that plant mistakes.** Five scripted players plant known mistakes in real songs, and the game's own judge has to find exactly those | It proves the judge marks only real mistakes, with 0 false alarms on all 10 committed songs, and shows its one blind spot (rushing, [#545]) instead of hiding it | [#542], [veritas's done note](../changes/veritas.md) |
| 2026-10-24 from 05:11 | **Real-time agent-to-agent messaging.** The planner, the front desks (eric-asking-agent, -2 and -3) and the workers message each other session to session. Eric's words are relayed verbatim into the issue and the plan PR | A decision becomes a merged plan in minutes. From issue opened to plan merged: [#601] → [#602] 11 min, [#612] → [#614] 6 min, [#618] → [#620] 7 min, and [#675] → [#676] 18 min (with `main` red). KnightHacks coordinated through GitHub (claim comments on issues, PR comments) and a 10-minute planner loop. ShellHacks had agent rules, too. Neither's session records hold a session-to-session message, only subagent hand-backs | the PR bodies quoting Eric's relayed words; KnightHacks' `AGENTS.md` and [wins log](https://github.com/Eric-Zhang-Developer/knighthacks-2026/blob/main/docs/wins.md) |

## Adding a win

One row. Name the mechanism, not just the result, so it can be reused.

[#542]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/542
[#545]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/545
[#601]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/601
[#602]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/602
[#612]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/612
[#614]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/614
[#618]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/618
[#620]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/620
[#625]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/625
[#674]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/674
[#675]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/675
[#676]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/676
[#677]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/677
