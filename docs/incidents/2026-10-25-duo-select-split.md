# Incident: duo-select split into twelve PRs, and the screen didn't change for over two hours (2026-10-25)

Severity: nothing lost; Eric saw no change on screen until the tenth of twelve PRs merged. Times are EDT. Blameless: each PR was the
right size for the rules it was opened under.

## What happened

- **00:43.** Issue [#646] proposes the Duo select. **00:57.** Plan [#659] gives `duo-select` to eric-agent-4.
- **01:02.** [#664] opens: `roll()` and `<PianoRoll/>`, "part 1 of 3". It merges at 02:31:47.
- **02:42 to 02:51.** Seven more open within 9 minutes:
  - Four only teach other features' verify checks to accept either select: [#695] (`learn-from-select`), [#696]
    (`records`), [#697] (`song-options`) and [#698] (`select-stage`). Those checks belong to other features, so
    `check_ownership.py` needs a `fix(<their slug>)` PR for each.
  - [#699] (`song-select`) gives each song its piano roll. [#700] adds the focused panel and song row, "part 2 of 4".
    [#705] (`song-preview`) trims the row.
  - They merge between 02:48:41 and 03:13:37.
- **03:05.** [#714] (`select-layout`) opens: the first PR that puts the new select on screen. It's the first file
  outside `web/src/game/duo-select/` to import `duo-select/Select`; before it, only `song-select/load.ts` imported
  `roll`.
  - **03:07:36, red:** typecheck can't find `../duo-select/Select` or `Song.roll`. #699 and #700 hadn't merged yet
    (03:11).
  - **03:17:05, red:** `verify-red.mjs` failed twice, a check unrelated to the select.
  - **03:24:46, green.** It merges at 03:24:59.
- **03:18 to 03:37.** Three more open: [#723] (`help-overlay`, one line, merged 03:21:52), [#734] (the select's chips) and [#736] (part 4:
  `verify-select`, the shots and the done note).

## Impact

- **Twelve PRs for one screen.** The nine from #664 to #714 add 667 lines and remove 236 (GitHub's counts). With #723,
  #734 and #736, it's 846 added and 250 removed.
- **Four PRs were only ownership work.** #695 to #698 add 63 lines and remove 18, all in other features' verify checks.
- **No visible change for 2 h 22 min,** from #664 opening (01:02:49) to #714 merging (03:24:59). The two red runs on
  #714 account for about 17 minutes of that. The first red came from the split itself: #714 needed parts that hadn't
  merged yet.
- **Nothing lost.**

## Failure points

1. **Ownership was per feature, even inside one person's lane.** `duo-select` couldn't edit the checks or the layout
   it changed, because `select-layout`, `records`, `song-options` and the others own them. So one screen became one
   PR for each owner.
2. **Small PRs had no reviewer to serve.** Splitting for review only pays off when someone reviews. Eric, relayed by
   the planner: "Look how tiny these pull requests are, bro. I'm not reviewing anything manually."
3. **The visible piece came last.** The parts merged in dependency order, and the one that changed the screen depended
   on all of them.

## Rules from now on

- **Pending: [#738]**, a `contract:` PR for Eric: one PR per screen, ownership open within a lane, and one-line mounts
  in a feature's own PR.

[#646]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/issues/646
[#659]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/659
[#664]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/664
[#695]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/695
[#696]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/696
[#697]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/697
[#698]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/698
[#699]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/699
[#700]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/700
[#705]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/705
[#714]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/714
[#723]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/723
[#734]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/734
[#736]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/736
[#738]: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days/pull/738
