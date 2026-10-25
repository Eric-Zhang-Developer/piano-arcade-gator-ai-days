# Spot the wrong note: findings

**Question** (spec `wrong-note-spike`, #521): can a non-pianist hear which note of an 8-note phrase from a familiar
tune was wrong, often enough that the game is fair, and want another set? Yes means a non-pianist gets 6 or more of 10
at a 2-semitone change (chance is 1 in 7), and at least one asks for another set unprompted.

**Answer: playtest pending.** Nobody has played it yet: the question is about people, and the 10-minute DGX
playtest is Eric's (spec Validation 3).

## The build
- `/wrong-note?song=<id>&seed=<n>&shift=<1|2>`: Twinkle by default; Ode to Joy, Minuet in G and Für Elise linked.
  It's linked from nowhere.
- A round: 8 consecutive melody notes (Simon's `melody`) from a seeded random start. One of notes 2–8 moves `shift`
  semitones, never onto a neighbor's pitch. Eight pads light as the notes sound. Answer by clicking a pad or pressing
  2–8; R replays. The reveal plays the phrase as written, with the answer pad gold and a wrong pick red. After 10
  rounds it shows "n / 10" and Again (next seed).
- The page lists this session's sets, one line each: `song · shift · seed · n/10 · changed:answer(+replays)`. That's
  what to paste below.
- The piano gets the phrase 60 ms ahead at a time (decision `wrong-note-spike-send`), so a mid-phrase answer stops it
  cleanly.

## Checks
- Vitest `src/game/wrong-note`: 6 pass, on synthetic charts (rounds, the no-neighbor rule, seeds, messages, the
  reducer, the sender against a stand-in piano that honors timestamps).
- `verify-wrong-note.mjs`: written, **not run locally** (Eric's load rule); main's scheduled full run covers it.
- Looked at live on a dev server at 1280×720 and 1920×1080 (three design rounds, PR #867). A set played through to
  "5 / 10" in the page, sent to laptop sound's virtual Portable Grand (not listened to), never the DGX.

## Playtest (Eric, about 10 minutes)
1. DGX plugged in, `/wrong-note` (shift 2). Two or more non-pianists, one set each. Don't explain beyond the page.
2. If one asks to go again, offer `/wrong-note?shift=1` (a half step, harder).
3. Paste the page's set list here, and write who asked to go again, unprompted.

| Player | Set line (from the page) | Asked again? |
|---|---|---|
| | | |

## What worked / didn't / keep
Not known until the playtest.

## Recommendation
**Iterate: run the playtest.** Nothing to promote or kill before someone plays it.
