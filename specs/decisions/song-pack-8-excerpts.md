# song-pack-8: excerpts, tempos, ids and one hand edit

**Context.** The spec leaves each excerpt (30–90 s, from the opening) and `bpm` to the charter. Sources are Mutopia
1647, 2033, 296, 743 and 1693, each checked against its Mutopia page (piece, edition, license) before charting. Notes
were counted from each piece's LilyPond source: chord notes one by one, a tied-to note not again, rests, spacers and
grace notes not at all, `\repeat unfold` unfolded. Bar numbers are the score's (LilyPond's; a pickup is bar 0).

**Choices** (each reversible by rerunning `game-tools/midi-to-chart/convert.py` with other `--bars`/`--bpm`):
- **Consolation No. 3:** bars 1–18, to the first cadence on D-flat; bar 11 would end on the next phrase's upbeat.
  Lento placido with no number; the MIDI is 60, and so is the chart. 72 s. `--rh 1 --lh 2 --bars 1-18`.
- **Prelude in C-sharp minor:** the pickup and bars 1–13, the Lento up to Agitato (where the MIDI jumps to 192). Lento
  with no number; the MIDI is 60, the chart too. 56 s. `--rh 1 --lh 3 --pickup 2 --bars 1-14`. No three-staff writing
  in the excerpt; bars 12–13's right hand moves to the bass clef on its own staff, so it stays R. Each staff's second
  MIDI track (upB, downB) has no notes before bar 45.
- **Pathétique, Rondo:** the pickup and bars 1–43, to the E-flat theme's cadence. The first theme's close at bar 17
  is 22 s even at the MIDI's tempo. 2/2, so `beatsPerBar` 4. Allegro with no number; the MIDI is quarter = 216. The
  chart is 192, 89%: a little under, for Hard. 55 s. `--pickup 1.5 --bars 1-44`. The edition matches pack 7's
  Adagio (Mutopia 295, Berners 1908, ed. Winterberger).
- **Revolutionary Étude:** bars 1–18, the introduction and the theme's first statement to the half cadence on G.
  Allegro con fuoco, ♩ = 160 printed and in the MIDI. The chart is 120, 25% under. 36 s. `--bars 1-18`.
- **Fantaisie-Impromptu:** bars 1–24, to the rit. on the dominant before the theme returns a tempo. This edition
  prints no tempo word or number for the opening; the MIDI is 168. The chart is 120, 71% of it. 48 s. `--bars 1-24`.
  Four against three survives conversion: every left-hand onset is on twelfths 0, 4 or 8 of a beat, every right-hand
  one on 0, 3, 6 or 9.

**Hand edit.** In the Étude's bars 6–8 the score moves the right hand's run onto the lower staff (`\unten
\voiceOne`, stems up), and LilyPond writes it into that staff's MIDI track, on the same channel. The hands play
that run in octaves, so at each of those 41 two-note onsets (to bar 9's first C) the upper note goes back to R. The
reassigned notes match the score's right-hand voice note for note.

**Ids.** Two of the spec's ids hash to a jacket (angle and first color) already taken, which song-jacket's test
forbids: `rach-prelude-cs` looked like `moonlight-1` and `revolutionary-etude` like `ode-to-joy`. They're
`rachmaninoff-prelude-cs` and `chopin-revolutionary`, both clear of the library and of the ten songs packs 6 and 7 add.

**How to undo.** Reconvert with other bars or `bpm`. For the Étude, redo the hand edit. To restore an id, rename its
folder and its `id`, and the jacket test will name the clash.
