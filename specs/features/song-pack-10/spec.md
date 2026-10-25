---
name: "Song pack 10: very hard songs, the Ballade No. 1 coda, the C-sharp minor Nocturne, Nocturne Op. 48 No. 1, and one or two more"
depends_on: ["song-pack-1", "level-review"]
owns: ["web/public/songs/chopin-ballade-1-coda/", "web/public/songs/chopin-nocturne-cs-posth/", "web/public/songs/chopin-nocturne-48-1/", "web/public/songs/chopin-ballade-4-coda/", "web/public/songs/chopin-etude-10-1/", "web/public/songs/chopin-black-key/", "specs/features/song-pack-10/", "changes/song-pack-10.md", "specs/decisions/song-pack-10-"]
assignee: "eric"
---

# Song pack 10

Issue #1378. Eric, 2026-10-25: "More songs, a few hard songs, and a lot of easy songs." And: "I would want 5, or maybe
4, very hard songs. ... The ending of Ballande no 1 ... if we don't have Opus nocturne number 20, that famous one, and
we have nocturne 48, let's also add those as my personal requests". "The ending of Ballade No. 1" is its coda (the
planner confirmed it with Eric).

This pack adds four or five very hard songs: Eric's three, plus one or two of your choice. Every rule in
`song-pack-1`'s Requirements applies here, with the changes below: read it first. Use its converter
(`game-tools/midi-to-chart/`) and rely on its library test. If either needs a change, that's a `fix(song-pack-1)` PR,
not this one.

None of these is in the library on 2026-10-25. `nocturne-op9-2` is a different nocturne, and the library has no
Ballade.

**Why it waits on `level-review`:** the levels come from that table, and this pack adds its own rows.

| id | Piece | Source (the planner read each page; you confirm it) | Watch for |
|---|---|---|---|
| `chopin-ballade-1-coda` | Chopin, Ballade No. 1 in G minor, Op. 23: the coda (Presto con fuoco) | [Mutopia 1959](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959), "Première Ballade", Klindworth (Bote & Bock, n.d. [1880]), maintainer Javier Ruiz-Alma, CC BY-SA 4.0. MIDI, PDF and LilyPond files. | The page doesn't say the files include the coda: check the PDF before charting. It's an excerpt that starts at the Presto con fuoco, not at the opening; the title or `catalog` says "coda". |
| `chopin-nocturne-cs-posth` | Chopin, Nocturne in C-sharp minor, B. 49, Op. posth. ("No. 20") | **No notation file found.** [IMSLP's page](https://imslp.org/wiki/Nocturne_in_C-sharp_minor,_B.49_(Chopin,_Fr%C3%A9d%C3%A9ric)) lists 0 MIDI and 0 source files. It has typeset PDFs under open licenses (#01197, L. S., 2004, CC BY 3.0; #127864, Pierre Gouin, Éditions Outremontaises, 2006, CC BY-SA 4.0), and public-domain scans (the 1875 first edition, Benicke, #1005676). Mutopia has none. | See "The C-sharp minor Nocturne" below. The famous opening is Lento con gran espressione: the hard part is the right hand's fast runs later on. |
| `chopin-nocturne-48-1` | Chopin, Nocturne in C minor, Op. 48 No. 1 | [IMSLP's Op. 48 page](https://imslp.org/wiki/Nocturnes,_Op.48_(Chopin,_Fr%C3%A9d%C3%A9ric)), file #932677: Knute Snortum's LilyPond source (ZIP, both nocturnes), 2024, CC BY-SA 4.0. Its PDF is #932676. Not on Mutopia. | Eric said "nocturne 48"; No. 1 in C minor is the famous one, and nothing he said points to No. 2. Compile the LilyPond to MIDI (as `song-pack-7-sources.md` did), then convert. |
| one or two of: `chopin-ballade-4-coda`, `chopin-etude-10-1`, `chopin-black-key` | Chopin, Ballade No. 4, Op. 52, its coda · Étude Op. 10 No. 1 in C · Étude Op. 10 No. 5 ("Black Key") | [Mutopia 422](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=422) (Joseffy edition, Bruce J Keeler, Public Domain) · [Mutopia 914](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=914) (listed Public Domain on Mutopia's Chopin page; the planner didn't open its page) · [Mutopia 926](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=926) (Peters, Scholtz, Roland Goretzki, Public Domain) | Your pick. Any other very hard piece is fine if its source is one decision 003 allows. Op. 10 No. 1's right hand spans the keyboard: report the range. The Black Key's right hand is nearly all black keys. |

## The C-sharp minor Nocturne
No MIDI, MusicXML or LilyPond file of it was found under an allowed license on 2026-10-25. In order:
1. **Look again** for an openly licensed notation file: Mutopia, IMSLP's source files, Wikimedia Commons, and
   OpenScore. If you find one, use it, as for the others.
2. **Otherwise, enter the notes yourself** in LilyPond from one cited open PDF: L. S.'s CC BY 3.0 typeset edition
   first, as it reads cleanly. Notes come from that PDF only, bar by bar, never from memory. Then engrave your file and
   check it against the PDF bar by bar: the note count, the pitches and the rhythms. Write in
   `song-pack-10-sources.md` how you checked. The chart's `source` names the PDF (IMSLP file number, editor, license)
   and says it was entered by hand from it.
3. If neither works in three real attempts, file a `needs-human` issue for this song and ship the others.

## Plan
1. **Check each source first**, before charting it: open the page, confirm the piece, the edition and the license
   match the table, and download its files. **Measure the tempo from the source**: the score's printed marking (word
   and any metronome number) and the MIDI file's own tempo. Write both in the done note, never a tempo from memory.
   Log every file's sha256 in `specs/decisions/song-pack-10-sources.md`, as packs 5 and 7 do. A row that doesn't hold
   up is a `needs-human` issue for that song, and the others still ship.
2. **One `feat(song-pack-10)` PR**, with one commit per song, each from its own cited score.
3. **Levels:** add each song's row to `web/src/game/difficulty/reviewed.ts` by `level-review`'s rules: a Henle,
   RCM or ABRSM grade cited by a URL you read, or the formula with a `note`. The lane widening lets this PR change
   that file; check that no open PR holds it first.
4. **Credits:** each CC BY or CC BY-SA source gets a `CREDITS.md` line. A `feat(song-pack-<n>)` PR may append them
   itself (AGENTS.md; no removed lines).

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed. Notes come from the cited
  score only. Count the chosen bars' notes against the score and write the count in the done note.
- **Excerpts:** 30 to 90 seconds at the chart's `bpm`, as in pack 1, except:
  - **The codas** (Ballade No. 1, and Ballade No. 4 if picked) start at the coda's first bar and end at the piece's
    final bar, or at a cadence before it if the final bar is past 90 s. Say which bars.
  - **Every other song** starts at the piece's opening.
  - An excerpt that isn't the opening is labeled in the title or the `catalog`.
- **Tempo:** near the marking or a little under, as pack 8's Expert songs are: say how far under. The done note
  gives the marking, the MIDI's tempo and the chart's `bpm`. Eric does a piano pass for `bpm` afterward.
- **Level:** from the `level-review` table. The done note lists each song's level beside the library's hardest songs
  (`chopin-revolutionary`, `moonlight-3`, `chopin-fantaisie-impromptu`). The WARNING card shows from level 13; say
  which songs get it.
- **Ids:** as in the table, unless one clashes with a song already in the library; then pick the next clear id and
  say so in the done note.
- **Another pick** outside the table: add its folder to this spec's `owns` in the same PR, or `check_ownership.py`
  fails it. Drop the `owns` entries of the picks you didn't take.
- Ornaments, grace notes and cross-staff writing follow pack 1 and decision `song-pack-7-sources.md`: the main note
  only, and hands follow the staves and stems. The Ballade's and the nocturnes' fioriture won't fit the 1/12-beat grid
  either; log what you drop.
- Demo pedal and dynamics are not this pack's.
- No game code changes, so no design pass: adding charts changes no UI.

## Validation
- `pnpm -C web exec vitest run src/game/songs src/game/difficulty`: `song-pack-1`'s library test passes with every
  chart in the library. `level-review`'s table test passes with this pack's rows.
- `python3 game-tools/midi-to-chart/convert.py --self-test` passes.
- `/play?song=<id>` for each song: it loads and plays, and with `?input=test` the Perfect player finishes all
  PERFECT. No local browser run by default (AGENTS.md load rule): the done note says "not verified locally; covered by
  main's scheduled full run".
- On the piano (Eric; mark it in the done note): play each once with both hands. It should be the piece you know, with
  readable lanes. Say which `bpm` needs tuning.

## Defaults
- Prefer the smaller option: a shorter excerpt over a longer one, one extra pick over two.
- If an opening is too sparse to be fun or too hard to read on the highway, pick the next section that works and say
  why in the done note.
