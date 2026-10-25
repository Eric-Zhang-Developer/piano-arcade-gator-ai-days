---
name: "Song pack 9: five very easy songs, Hot Cross Buns, Mary Had a Little Lamb, London Bridge, the Jingle Bells refrain and Frère Jacques"
depends_on: ["song-pack-1", "level-review"]
owns: ["web/public/songs/hot-cross-buns/", "web/public/songs/mary-lamb/", "web/public/songs/london-bridge/", "web/public/songs/jingle-bells/", "web/public/songs/frere-jacques-solo/", "specs/features/song-pack-9/", "changes/song-pack-9.md", "specs/decisions/song-pack-9-"]
assignee: "eric"
---

# Song pack 9

Issue #1377. Eric, 2026-10-25: "More songs, a few hard songs, and a lot of easy songs." And: "Maybe 5 very easy songs
and stuff like Hot Cross Buns and Mary Had a Little Lamb." This pack is five tunes for the very bottom of the select,
at or under Twinkle. Every rule in `song-pack-1`'s Requirements applies here, with the changes below: read it first.
Use its converter (`game-tools/midi-to-chart/`) and rely on its library test. If either needs a change, that's a
`fix(song-pack-1)` PR, not this one.

**Why it waits on `level-review`:** a tune at level 1 ties Twinkle, and today's "puts Twinkle lowest" test fails on a
tie. `level-review` changes that test and adds the table these songs' levels go in.

| id | Tune | Source (the planner read each; you confirm it) | Tempo in the source | Watch for |
|---|---|---|---|---|
| `hot-cross-buns` | Hot Cross Buns | Wikipedia, ["Hot Cross Buns (song)"](https://en.wikipedia.org/w/index.php?title=Hot_Cross_Buns_(song)&oldid=1380991341), the article's LilyPond `<score>`, CC BY-SA 4.0 | `\tempo 4 = 120` | The score prints two tunes. Chart the 4 bars marked "Alternative" (B A G), the three-note tune beginners learn, not the octave-wide first one. Log the choice. |
| `mary-lamb` | Mary Had a Little Lamb | Italian Wikipedia, ["Mary had a little lamb"](https://it.wikipedia.org/w/index.php?title=Mary_had_a_little_lamb&oldid=150827858), the article's LilyPond `<score>`, CC BY-SA 4.0 | `\tempo 4 = 220` | The English article has no score. The source uses `\language "deutsch"` (`h` is B), in G major. The tempo is far too fast to play: set `bpm` for playing. |
| `london-bridge` | London Bridge Is Falling Down | Wikipedia, ["London Bridge Is Falling Down"](https://en.wikipedia.org/w/index.php?title=London_Bridge_Is_Falling_Down&oldid=1381574731), the article's LilyPond `<score>`, CC BY-SA 4.0 | `\tempo 4=102` (its `\midi` block) | A volta repeat with two endings: its MIDI `\unfoldRepeats`, so chart the unfolded order. |
| `jingle-bells` | Jingle Bells (refrain), James Lord Pierpont | Wikimedia Commons, [File:Jingle Bells refrain vector.svg](https://commons.wikimedia.org/wiki/File:Jingle_Bells_refrain_vector.svg), whose page carries the LilyPond source; Public Domain (PD-self, the 1857 tune PD-old). Its MIDI is [File:Jingle Bells refrain vector.mid](https://commons.wikimedia.org/wiki/File:Jingle_Bells_refrain_vector.mid). | `\tempo 4 = 100` | A four-part choir setting. Chart the melody (the top voice) only, right hand, as Twinkle is; log it. The title says "(refrain)": it's an excerpt. |
| `frere-jacques-solo` | Frère Jacques, promoted from the Lab's rounds | The source the round's chart cites: Wikipedia, ["Frère Jacques"](https://en.wikipedia.org/w/index.php?title=Fr%C3%A8re_Jacques&oldid=1366602658), the article's LilyPond score, CC BY-SA 4.0 | `4=102` | `web/public/songs/rounds/frere-jacques/` is the melody already, and it's the `round` feature's: don't move or edit it. Copy its notes into the new folder with a new id (ids are unique across the library) and the same `source`, and say it's copied. |

## Plan
1. **Check each source first:** open the URL at the revision given, confirm the tune and the license, and copy the
   LilyPond text from that revision. Compile it to MIDI with `lilypond`, as decision `song-pack-7-sources.md` did,
   then convert with `convert.py`. For Jingle Bells, use the Commons MIDI or a MIDI compiled from the page's
   LilyPond, and say which. Log the files' sha256 in `specs/decisions/song-pack-9-sources.md`, as packs 5 and 7 do.
   A row that doesn't hold up is a `needs-human` issue for that song, and the others still ship.
2. **One `feat(song-pack-9)` PR**, with one commit per song, each from its own cited source.
3. **Levels:** add the five rows to `web/src/game/difficulty/reviewed.ts` from `level-review`. No published grade
   rates these tunes, so each row keeps the formula's level, with `note: "no published grade: a nursery tune"`. The
   lane widening lets this PR change that file; check that no open PR holds it first.
4. **Credits:** the four CC BY-SA sources (the three Wikipedia articles and the Frère Jacques copy) get a
   `CREDITS.md` line each. A `feat(song-pack-<n>)` PR may append them itself (AGENTS.md; no removed lines).

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**, except:
  - **One hand:** each source prints a single melody line, so each chart is right hand only, as Twinkle is.
  - **Length:** the whole printed tune once, as Twinkle's first verse is. The 30-second floor doesn't apply. No
    repeats beyond what the source prints or its MIDI unfolds.
- Notes come from the cited revision only, never from memory, though everyone knows these tunes. Count the notes
  against the LilyPond source and write the count in the done note.
- **Tempo:** slower than the source where the source is fast, as in pack 1. The done note gives the source tempo and
  the chart's `bpm`. Eric does a piano pass for `bpm` afterward.
- **Level:** target 1 to 2. Twinkle is 1 on 2026-10-25. The done note lists each song's level beside Twinkle's. A
  song above 2 is reported, not fixed here.
- **Ids:** as in the table, unless one clashes with a song in the library; then pick the next clear id and say so.
- `composer` is "Traditional" except Jingle Bells (James Lord Pierpont). `catalog` says what the chart covers ("the
  'Alternative' tune", "refrain", "melody").
- Demo pedal and dynamics are not this pack's.
- No game code changes, so no design pass: adding charts changes no UI.

## Validation
- `pnpm -C web exec vitest run src/game/songs src/game/difficulty`: `song-pack-1`'s library test passes with every
  chart in the library. `level-review`'s table test passes with this pack's five rows.
- `python3 game-tools/midi-to-chart/convert.py --self-test` passes.
- `/play?song=<id>` for each of the five: it loads and plays, and with `?input=test` the Perfect player finishes all
  PERFECT. No local browser run by default (AGENTS.md load rule): the done note says "not verified locally; covered by
  main's scheduled full run".
- On the piano (Eric; mark it in the done note): play each once. It should be the tune you know. Say which `bpm`
  needs tuning.

## Defaults
- If a source revision has changed its score since, chart the cited revision, not the current page.
- If Hot Cross Buns' "Alternative" line turns out not to be the B A G tune, chart the one that is, if the source
  prints it, and log the choice; else file a `needs-info` comment on the issue and ship the other four.
