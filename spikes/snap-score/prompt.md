<!-- snap-score-spike: the reader's prompt. snap.mjs sends the "Read" part with the image, and the "Recall" part with
no image (the control). Everything below each heading, up to the next, is sent as written; {title}, {composer} and
{source} are filled in. -->

## Read

This image is one page of printed piano music: a grand staff, treble on top and bass below. Transcribe every note
printed on this page into JSON.

- `beatsPerBar`: the time signature as quarter-note beats per bar (3/4 is 3, 4/4 is 4, 3/8 is 1.5, 6/8 is 3).
- `notes`: one entry per printed notehead, in any order.
  - `pitch`: MIDI number (middle C is 60). Apply the clef, the key signature, accidentals (they last to the end of
    the bar) and ties as printed. An 8va line raises the notes under it by 12.
  - `beat`: where the note starts, in quarter-note beats from beat 0 of bar 1. A pickup (an incomplete first bar)
    comes before bar 1, so its notes have negative beats.
  - `duration`: in quarter notes, as printed (a dotted half is 3, an eighth 0.5, a triplet eighth 1/3). Tied notes
    are one note with the summed duration.
  - `hand`: `R` for notes on the treble staff, `L` for the bass staff.
- Repeats are not expanded: each printed note appears once. An ornament (trill, mordent, grace note) is its main
  note only.
- Read only what is printed on this page. Do not add notes you cannot see, and do not continue the piece past the
  page. If something is unreadable, leave it out.

## Recall

There is no image. Write page 1 of {title} by {composer}, as printed in this edition: {source}. Use what you know of
the piece.

- `beatsPerBar`: the time signature as quarter-note beats per bar (3/4 is 3, 4/4 is 4, 3/8 is 1.5, 6/8 is 3).
- `notes`: one entry per notehead on that page, with `pitch` (MIDI, middle C is 60), `beat` (quarter-note beats from
  beat 0 of bar 1; a pickup's notes are negative), `duration` (quarter notes) and `hand` (`R` treble, `L` bass).
- Repeats are not expanded. An ornament is its main note only.
