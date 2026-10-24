---
name: "Sheet XML: a chart as MusicXML on a grand staff, for the sheet music window"
depends_on: []
owns: ["web/src/game/sheet-xml/"]
assignee: "eric"
---

# Sheet XML

The score behind `sheet-view`: a pure `chartToMusicXml(chart)`, built from strings with no new dependency. A chart has
`beat` and `duration` in quarter notes, a hand per note, and `beatsPerBar` in quarter notes ("3/8 is 1.5"), but no
key or meter denominator: an estimate fills them, and a small table read from each song's source corrects it.
Sheet music is the game lane's by Eric's call (2026-10-24).

Issue: #270

## Plan
1. `web/src/game/sheet-xml/`: `chartToMusicXml(chart): string`; `placeNotes(chart)`, each note's staff, quantized
   onset and pitch, which sheet-view uses to find a judged note's notehead; `overrides.ts`, the table below. Tests
   beside them. No other files change. One PR; past about 400 changed lines, split: key and spelling, then the writer.

## Requirements
- **Shape:** MusicXML 4.0 `score-partwise`, one part, two staves: treble (staff 1) holds `hand: "R"`, bass (staff 2)
  `hand: "L"`. A one-hand chart keeps both staves, the empty one in whole-bar rests. Title and composer from the
  chart, XML-escaped (`&`, `<`, `>`): a ripped song's title can hold them.
- **Bars:** `<divisions>4</divisions>`, so a 16th is 1. A bar is `4 × beatsPerBar` divisions; a chart whose bar isn't
  a whole number of 16ths throws. Bar 1 starts at beat 0 (a pickup is a full bar of rests first); bars run to the
  last note's end. **Meter:** unless the table has the song, whole `beatsPerBar` -> n/4, else whole eighths -> n/8,
  else n/16 (1.5 is 3/8, 4.5 is 9/8).
- **Quantize:** onset and end each round to the nearest 16th; a note keeps at least a 16th. At 2e1c3fd, 3 notes of
  chopin-prelude-4 and 2 of nocturne-op9-2 (tuplets) are off that grid.
- **Values:** 16th to whole, plain or dotted (1, 2, 3, 4, 6, 8, 12, 16 divisions). Any other length, and any note
  crossing a barline, splits into tied notes, largest value first.
- **Chords and voices:** in one hand, notes with the same quantized onset and duration are one chord (`<chord/>`, low
  to high). A note or chord that starts while another is sounding goes to the first free voice: right hand 1–4, left
  hand 5–8. A fifth voice in one hand throws, naming the note. Voice 1 of each staff fills every bar, with rests in
  its gaps; other voices fill theirs with `<forward>`. A planning check at 2e1c3fd: no chart needs more than 2 voices
  in a hand, and no two notes share a (staff, quantized onset, pitch).
- **Key:** Krumhansl–Schmuckler. Correlate the duration-weighted pitch-class totals with the 24 rotations of the
  Krumhansl–Kessler profiles; the best match is the key, written in bar 1 as `<fifths>` and `<mode>`. Cite where the
  profile values came from in a code comment. The tonic takes the spelling with fewer accidentals (ties: sharps).
- **Overrides:** `overrides.ts` maps a chart id to any of `{ fifths, mode, beats, beatType }`, which win. Read each
  library chart's `source` (its LilyPond `\key` and `\time`, the MIDI's key and time signature events, or the PDF's
  first system); add an entry only where it disagrees with the estimate or the meter rule, with a comment citing the
  file and what it says. Expected, to confirm there and never to copy from here: chopin-prelude-4's key (its title
  says E minor; a planning run of the estimate gave A minor) and nocturne-op9-2's meter (the coach says 12/8; the
  rule gives 6/4). Für Elise's estimate was a near tie in that run (A minor 0.703, E major 0.700). A source that
  can't be read gets no entry and a line in Gaps. An entry's meter must equal `beatsPerBar` (`4 × beats / beatType`).
- **Spelling:** scale notes from the key (natural minor for a minor key); a minor key's raised 6th and 7th as raised
  degrees (A minor: F♯, G♯); any other note sharp when `fifths >= 0`, flat when it's negative. The octave follows the
  letter (B♯3 is MIDI 60).
- **Pure:** the same chart gives the same string, with no DOM.

## Validation
- `pnpm -C web test`, over every chart under `web/public/songs/` except `local/`, reading the XML with a small tag
  reader in the test (no new dependency):
  - it's well formed: one root, every tag closed;
  - read back (pitch from step, alter and octave; onsets from durations, `<chord/>`, `<backup>` and `<forward>`;
    tied pieces joined), each staff holds exactly its hand's notes: pitch, quantized onset and duration;
  - in every bar, each voice's durations sum to the bar's divisions;
  - no chart throws, and `placeNotes` gives every note a different (staff, onset, pitch).
- Fixed cases: Twinkle is C major in 4/4; Für Elise is 3/8 and spells MIDI 75 as D♯5; moonlight-3, in C♯ minor,
  spells MIDI 72 as B♯4; every table entry is what its chart writes; an entry whose meter isn't `beatsPerBar`
  throws; a synthetic 5-16th note across a barline comes back as tied pieces of the right total; a synthetic chart
  titled `A & B <C>` is well formed. That OSMD reads it is sheet-view's check (its first PR renders every chart).
- The done note lists each chart's key and meter as written, and where each came from: a table entry and its source
  line, or the estimate.

## Defaults
- A wrong key costs a key signature, not a wrong pitch: a chart with no entry keeps the estimate.
- Pickups (chopin-prelude-4, fur-elise, maple-leaf-rag, nocturne-op9-2 start after beat 0) print as a full bar of
  rests and the pickup, so bar numbers run one ahead of the printed score; an implicit bar 0 is a later fix.
- Beams come from sheet-beams' `shouldBeam`: `<beam number="1">` begin, continue and end on each beamed chord's
  first note (VexFlow draws the 16th lines itself). OSMD's own autoBeam splits runs at every eighth in n/8.
- No clef changes, tuplets, dynamics or pedal: sheet-view asks through `fix(sheet-xml)`. Ornaments charted as main
  notes (minuet-g, nocturne-op9-2) print as those notes; moonlight-3's right hand reaches G♯2 on the treble staff.
  A key or meter on the chart is a `contract:` PR; the table is the stopgap. Log other choices in
  `specs/decisions/sheet-xml-*.md`.
