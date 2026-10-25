# duo-hud's merge gate held finished work for 9.5 hours

2026-10-25, 00:57–13:42 EDT. Eric: "This is a big mistake and should go in the incident log because this has stopped a
lot of frontend progress... Why did it need your permission? I thought we fucking set this up."

## What happened
- **00:57.** Plan #659 merged. On Eric's "agreed do that" (via eric-asking-agent-2), it made duo-hud interactive. In
  the spec's words, eric-agent-1 "**does not merge on its own**: Eric gives each merge go, which is an exception to
  AGENTS.md's loop step 6" (`specs/features/duo-hud/spec.md`, lines 14–16). Eric then went to sleep.
- **03:04–04:03.** The steps opened: #707 (step 5, draft), #713 (step 1), #747 and #749 (step 2), #761 (step 3), and
  #777–#781 (step 4). #777, #779 and #780 were ready and clean from 04:03.
- **04:13.** The planner's log reads "duo-hud #713 #747 #749 #777-781 wait Eric go". eric-agent-1 went idle. Its last
  heartbeat is from 09:30. Nothing expired the gate or moved the work to another worker.
- **06:54–08:07.** Other features had to work around the held files: count-in shipped as a draw plugin "since
  highway.ts is held by #747", and miss-moment's switch-offs "wait #747 #761". At 07:25 the planner moved the duo-hud
  go to the top of the morning-page decisions, and at 08:04 it relayed the go as the top item of needs-Eric batch 2.
  The morning page itself was never built, and from mid-morning the app paused the planner's peer messages.
- **10:54.** eric-agent-7 parked highway-field #1122: "still a draft on #747 ... waiting for Eric's go"
  (comment 14:54Z). note-material #1181 parked the same way behind #747.
- **~13:30.** Eric looked at a local preview of #713 + #747 + #707 and said "good on all lets merge". The planner tried
  to act on the relayed go. Its session's permission check refused the outside write, and it did not work around that.
- **13:41–13:42.** Eric merged #713 and #747 himself. #713 turned `main` red: miss-moment (#1058, merged while #713
  was held) still read the old `l.slots.combo` (#1366, fixed by #1368).

## Impact
- Finished duo-hud steps sat unmerged for about 9.5 h (04:03 to 13:42). #778 and #781 went into merge conflict.
- Two built drafts waited on #747: highway-field #1122 and note-material #1181. Count-in and miss-moment shipped
  workarounds around held files.
- When the gate finally lifted, the gap became a red `main`: a PR held since 03:04 met code written against the old
  shape.
- At the time of writing, #707, #749 and #777–#781 are still open.

## Failure points
1. **A spec held merges for one person's go, with no expiry and no owner check.** The gate outlived its driver
   (eric-agent-1 quiet from 09:30) and the person it waited on (asleep).
2. **The go was queued as a morning-page item, not flagged as a blocker.** The planner listed it, then raised it to
   the top. eric-asking-agent-3 carried "awaiting Eric's go on #713/#747" as a pending item. Neither said it was
   holding the frontend queue, and the morning page that would have shown it was never built.
3. **Long-held PRs drift.** Every hour #713 sat, other PRs built on the shape it replaced.
4. **A relayed go met a second gate.** This session's permission check, a harness setting the spec doesn't control,
   would not act on Eric's go relayed through another agent. Eric merged the two PRs himself minutes later.

## A second instance: the mascot
- **06:30.** mascot-spike #908 merged with sheet-06 recommended (15 of 18 sets pass, per the planner's log at 06:27).
  The generated frames live only in the `mascot-spike` worktree's gitignored `spikes/mascot/out/`.
- **07:24.** The planner parked #1048 (the results tutor and the select / `/learn` companion are two different gators)
  "until Eric picks the new mascot", and no follow-up spec was written. The pick was on the morning page.
- **About 13:50.** Eric, on the results tutor panel: "why didn't it get redesigned? I thought there was an issue on it."
- **Impact:** about 6.5 h with a recommended, measured choice in hand and no work moving. Same failure point as
  above: a person's pick held work that a default and a revert would have covered.

## Rules from now on
- **No feature spec holds merges, or a start, for a person's go or pick.** Take the recommended option as the
  default and ship it. Taste checks go on Eric's morning page *after* the merge
  (memory: humans are the bottleneck); a revert is the undo. duo-hud's gate was lifted by #1369.
- **A blocker that waits on a person is said as a blocker** ("this holds N PRs and M features"), the first time it's
  seen, not as a queue item.
- **When a feature's assigned worker goes quiet,** its open steps are reassigned within the lane. An assignee by
  worker name is a soft hint, not a lock.
