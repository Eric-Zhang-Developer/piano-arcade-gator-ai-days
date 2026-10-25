# song-pack-4: Gnossienne No. 1 in 4/4

**Context.** Satie printed Gnossienne No. 1 with no bar lines. A chart has one `beatsPerBar`, and bar-lines and
bar-loop count bars from it. The spec: chart it in a steady meter if one fits the score's own phrase groups, else
take Chopin's Prelude Op. 28 No. 7 instead.

**Options.** A: 4/4. B: another meter. C: the backup piece.

**Choice: A, 4/4.** The source, Mutopia 2035 (`no_1.ly`, Éditions Salabert 1913), already groups the music in 4/4
(its MIDI's time signature is 4/4), and the grouping is the left hand's own pattern: a whole-note bass F, then an
A♭–C–F chord on beats 2 and 4. Every group in bars 1–9 is one of those, and the melody's two-bar phrases
(`r4 c8 ef d4 c | b2 b2`) fill two groups each. So `&from=1&to=4` plays two whole phrases, and each bar line falls
on a bass note. The scan prints no bar lines, so the chart's bars are the edition's groups, not Satie's.

**How to undo.** Rechart with another `beatsPerBar` (no other meter fits the bass pattern), or replace the chart
with `chopin-prelude-7` from Mutopia's Op. 28 No. 7.
