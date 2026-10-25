# sheet-engraving: clef changes and 8va

**Context.** Each hand stayed on a fixed clef, so a climbing left hand stacked 6–8 ledger lines over the bass staff.
The spec asks for a clef change past about 3 ledger lines, an 8va or 8vb past that, and no flip-flop.

**Choice.** Decided bar by bar from the **median pitch of the notes that start in the bar**, per staff. Each switch
has a gap between its on and off pitch, so a bar near the edge, or one stray note, doesn't flip it back. A bar with
no notes keeps the last bar's clef and shift.

| Staff | Switch | On at median | Off at median |
|---|---|---|---|
| Left (bass) | to treble | ≥ G4 (67), 3 ledger lines over the bass | ≤ B3 (59) |
| Right (treble) | to bass | ≤ F3 (53), 3 ledger lines under the treble | ≥ C4 (60) |
| Treble clef | 8va | ≥ E6 (88), 3 ledger lines over | ≤ C6 (84) |
| Bass clef | 8vb | ≤ A1 (33), 3 ledger lines under | ≥ C2 (36) |

- A clef changes only at a barline, and a hand never moves to the other staff (the spec has no cross-staff notes).
- Notes under an 8va keep their real pitch in the XML. That's MusicXML's own meaning: the octave shift tells the
  renderer to print the notes an octave nearer the staff. So `placeNotes` and the notehead match are unchanged.
- On the library: Clair de Lune, the Entertainer and Mozart 545 open with the left hand in treble (the first two as
  their editions print them). Für Elise's left hand goes up for the E–D♯ bridge, maple-leaf-rag has two 8va bars, and
  mountain-king's low opening has the right hand in bass and the left under an 8vb.

**How to undo.** `CLEF` and `SHIFT` in `sheet-xml/index.ts`. Pitches no median can reach (128, -1) turn a switch off.
