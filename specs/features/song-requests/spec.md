---
name: "Song requests: an agent turns a requested piece into a playable song"
depends_on: ["song-pack-1"]
owns: ["web/public/songs/requests/"]
assignee: "eric"
---

# Song requests

Someone opens an issue naming a public-domain piece. An agent finds a source, charts it with song-pack-1's converter,
passes the library test and merges it. The operator board times each request from issue to merge, for a time-lapse
in the video: "the arcade that builds its own levels" (catalog G17; Eric on #10). The time-lapse is pre-recorded,
never live.

## Plan
1. **First:** the overnight `contract:` batch (#143) must be on `main`. If `AGENTS.md` has no "Song requests"
   section, this feature is blocked: take the next ready feature.
2. Create the `song-request` label if it's missing:
   `gh label create song-request --description "One piece to chart (AGENTS.md, Song requests)"`.
3. **A `fix(operator-board)` PR:** the board lists each merged PR that closed a `song-request` issue, with the
   minutes from the issue's creation to the merge. The board already collects PRs with `mergedAt`
   (`web/src/operator/collect.ts`). The issue's creation time needs one more call,
   `gh issue list --label song-request --state all --json number,createdAt`.
4. **The first real request, end to end:** this feature's own PR charts the oldest open `song-request` issue. If no
   such issue is open, file a `needs-human` issue asking Eric to open one, and park the feature. Later requests follow
   `AGENTS.md` as `chore(song-requests)` PRs.

## Requirements
- **What to chart:** every rule in `song-pack-1`'s Sources and What to chart applies. A cited notation source that
  decision 003 lets you commit, both hands as printed, an excerpt of 30–90 s, and the note count checked against the
  score. No notes come from memory.
- **Where it goes:** `web/public/songs/requests/<id>/chart.json`, with a lowercase-kebab `id` from the piece's name.
  It plays at `/play?song=requests/<id>`, and song select lists it automatically (any depth).
- **Checked automatically:** song-pack-1's library test covers every chart under `web/public/songs/`, so a request
  needs no new test code.
- **Only the issue names the piece.** An agent never picks one. A piece decision 003 won't let you commit, or a source
  that can't be found, gets a comment on the issue saying what was searched, plus the `needs-info` label.
- **The PR body records:** the issue, the source URL and license, how the note count was checked, and the issue's
  creation time. The board computes the minutes from those times.

## Validation
- `pnpm -C web test`: the library test passes with the new chart.
- `verify.py --slug song-requests` passes.
- In Chrome:
  1. `/play?song=requests/<id>&input=test` -> the Perfect player gets all PERFECT.
  2. Open `/` -> the piece is listed.
  3. Open `/operator` -> "song request #n: N min from issue to merge". Keep a screenshot in the PR.
- On the piano (Eric; mark it in the done note): play the requested piece. It's the piece the issue named.

## Defaults
- Prefer a shorter excerpt. Who records the time-lapse and how is Eric's call, not this feature's.
