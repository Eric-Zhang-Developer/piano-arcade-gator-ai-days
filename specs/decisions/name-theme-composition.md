# name-theme: how a motif becomes the theme and its variation

Rule-based, no randomness: `compose.ts`, every value in `composeSettings`.

- **Key:** the first major key, from fewest accidentals, whose scale holds every motif note. The French system gives
  only naturals plus B♭ (for the letter B), so it lands in C or F. The German system can add E♭ (B♭ major).
- **Register:** the melody in the right hand, D4–C6. Each note is the nearest to the last inside that range, rising on
  a tie. The left hand is a bass in C2–B2 and two chord tones above it, under B3.
- **Rhythm:** one note per letter. A half note per letter for names of 6 letters or fewer, a quarter beyond that.
  Names under 3 letters repeat until the motif has 3 notes.
- **Harmony:**
  - Diatonic triads I ii iii IV V vi (no vii°), each containing its melody note.
  - Chosen by the cheapest path through a progression table: I→IV/V/vi/ii, ii→V, IV→V/I, V→I/vi and so on.
  - The theme ends on V held to the bar's end, a half cadence. The variation ends V then I, an authentic cadence.
- **Voice leading:**
  - The left hand is the whole triad.
  - The bass is the root, or the third when that moves by step and the root doesn't.
  - The two upper voices move to the nearest chord tones, so a common tone stays put and is held as one note.
- **The variation:** the motif's diatonic inversion about its first note, moved by octaves into the register, in the
  same rhythm. An inversion over a waltz rhythm, because it keeps the name audible as a shape.
- **Length:** the theme and the variation each fill whole 4/4 bars. The bpm is set so the two together last 20 s,
  clamped to 60–132; every name from 1 to 12 letters lands on 20 s.
- **Dynamics,** on golden-demo's ladder:
  - the theme: melody mf (80), chords p (49);
  - the variation: melody f (96), chords mp (64).
- **The pedal,** golden-demo's per-harmony rule: down 0.1 beat after each new harmony, up 0.05 beat before the next.
  It is held in memory (`holdPedal`), not a file.
- **Parallel fifths and octaves:** between melody and bass, counted, not prevented. Over the test's 20-name batch in
  both systems: 77 in 748 melody moves (10.3%) over 40 themes. Logged as the spec asks. Fixing them would mean a
  search over bass inversions, which the smaller option skips.
- **Metadata:** title "Your Name, in Music", composer "Étude's name-theme generator". The typed name is in neither.
  The page shows it from memory.
