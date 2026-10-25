# The Composer's Hands: findings (decision 004)

eric-agent-5, 2026-10-25. Issue #1069, PR #1101.

## The question
Can a composer's own roll, from an open archive, become a performance the DGX plays, one that matches our chart's
notes, keeps his timing to the millisecond, and lets a player duet with it?

## The measured answer, so far
- **(a) Sources:** yes, for two pieces (`sources.md`):
  - Rachmaninoff's Ampico 57504, an emulated MIDI;
  - Joplin's Connorized 10265, 1916.
  
  No archive searched has The Entertainer played by Joplin. Neither roll states an open license, so both stay local
  (`specs/decisions/composers-hands-rolls-local.md`).
- **(b) Pitch match on a real roll: not measured.** The rolls weren't downloaded in this PR: a download waits for
  Eric's OK, and the files are local-only anyway. What is measured:
  - `match.mjs` runs end to end on a synthetic roll;
  - the vitest's alignment labels a planted repeat and reaches 90%+ on its matched sections, with insertions and
    deletions planted.
  
  To measure: put the file at `web/public/rolls/local/rachmaninoff-prelude-cs.mid`, then run
  `node spikes/composers-hands/match.mjs web/public/rolls/local/rachmaninoff-prelude-cs.mid web/public/songs/rachmaninoff-prelude-cs/chart.json`.
- **(c) Timing:** Listen ran on `/sim`'s fake piano (`?midi=sim`), with the test roll (our chart, 466 notes), at
  1920×1080 on this worktree's dev server.
  - Each sent note-on's timestamp, minus the page's zero, against the roll's note time: **median 0 ms, p90 0 ms,
    max 0 ms, 466 of 466**.
  - None was handed to the piano after its own time (lateness median, p90 and max 0 ms).
  - The sends are timestamped 150 ms ahead, so this measures the scheduler, not the DGX's own latency. On the real
    roll the figure would only differ by the parse's rounding.
- **The spool:** the correction is built and tested: a planted 2e-6/ms speed-up is found within 5%, and gaps come
  back to 250 ± 2 ms. It isn't run on a real roll yet, because it needs one. Ampico's emulated MIDI may already
  correct it; the archive page doesn't say (`sources.md`).
- **The duet:** it runs. A bot played the right hand through the sim, and the piano played the left hand from the
  roll. A clean bot (every 11th note left out, ±25 ms drift) scored 91.0%, rank A. A sloppier one scored 66.7%, rank
  D, with 34 missed. Compare draws the three tempo lines.

## What worked
- Core's Judge reads a `bpm: 60` chart unchanged: a beat is a second, so the judge runs on the roll's own time.
- Hand-mode's split and echo guard, hud and tempo-curve are reused, unedited.
- The edit-distance alignment (DTW with gap steps) labels a repeat, which plain DTW can't.

## What didn't, or isn't known
- No openly licensed composer roll exists for these pieces, so a fresh clone and CI can only show the test roll.
- The hand split is a guess from pitch. On the test roll it put the left hand up to D3 or E3. A real roll needs
  Eric's nudges.
- Whether it "sounds like a person" is Eric's 1-minute listen, not done.

## Verdict
**Iterate.** Download the Rachmaninoff roll locally and run `match.mjs` with `--spool` on a steady passage (b). Then
Eric listens on the DGX (e). If (b) passes 90% and he hears a person, promote it to the Lab's Wow group as it stands.
