# song-pack-1: sources, editions and excerpts

**Context.** The spec asks for the opening section, 30–90 s, both hands as printed, repeats written out, and leaves
the edition and the exact bars to the charter.

**Choices** (each reversible by rerunning `game-tools/midi-to-chart/convert.py`; commands in `changes/song-pack-1.md`):
- **Ode to Joy:** Mutopia's only version (528) is an SATB hymn setting on two staves. The chart takes the soprano (the
  theme) as R and the bass as L (`--rh-voice top --lh-voice bottom`), all 16 bars, 80 BPM (marked 100). Default from
  needs-human #110; a real piano arrangement can replace it.
- **Chopin, Op. 28 No. 4:** Mutopia has two public-domain editions (468, 921) that differ in accidental spelling. Chose
  921, the one that names its source (Peters). Pickup and bars 1–12, to the half cadence and rest in bar 12; 44 BPM
  (MIDI marks 48). The bar-11 grace note is skipped.
- **Für Elise:** the first double bar comes after ~22 s even with the repeat, under the spec's 30 s. The chart runs
  to the next natural ending, the A-minor cadence before the F-major episode: A section twice (first, then second
  ending) and the B section twice (first ending, then the second ending's downbeat only; its last three chords lead
  into the next section). 66 BPM (marked 72), ~61 s.

**How to undo.** Change the `--bars`/`--spans`/`--bpm` in the commands and reconvert; the library test checks the
result.
