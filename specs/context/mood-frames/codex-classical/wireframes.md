# Classical paper: intent, style, wireframes

## What Eric is after (my read)
A classical-inspired, papery look for the whole app, with Codex making the visual pieces (buttons, cards, ornaments).
It still has to be an arcade game: the falling notes, the judgments and the score have to read at a glance in a
video. So the paper is the world, and the arcade lives in the moments (stamps, gold, the combo).

## Shared style (every prompt carries this)
- Paper: warm cream `#f4ecdc`, a faint laid-paper texture, soft deckled edges on cards. Never pure white.
- Ink: `#1b1712` for text and staff lines.
- Gold leaf `#b8892b`: rank, PERFECT, records, the focus ring, the hit line. The one "shiny" thing.
- Right hand: viridian `#1f6f5c`. Left hand: Prussian blue `#2b4c7e`. Notes are never red.
- Vermilion `#c0392b`: WRONG only (the game's "only red" rule carries over).
- MISS: faded rose-grey `#a88a8f`. GOOD: Prussian blue. GREAT: ink.
- Type: a high-contrast engraving serif (Didot/Bodoni) for titles; small caps with wide spacing for labels; old-style
  numerals for body; big lining serif numerals for the combo and score.
- Ornament: thin double rules, a small fleuron, wax-seal and embossed-stamp shapes for badges. Restraint: one ornament
  per panel, not filigree everywhere.
- Buttons: primary = ink fill with gold-leaf text and a hairline gold inner border; secondary = cream with an ink
  hairline border; both slightly embossed, like letterpress.

## Wireframes (1920×1080)

### 1. Music select
```
+--------------------------------------------------------------------------------+
| Piano Arcade (title-page serif)                         ↑↓ choose · Enter play |
|--------------------------------+-----------------------------------------------|
|  [ focused cover:              |  [cover] Twinkle, Twinkle   TRADITIONAL   1   |
|    engraved first bars,        | >[cover] Minuet in G        PETZOLD       3 < |
|    framed like a plate ]       |  [cover] Für Elise          BEETHOVEN     5   |
|  Minuet in G                   |  [cover] Clair de lune      DEBUSSY       7   |
|  PETZOLD                       |  [cover] Gymnopédie No. 1   SATIE         4   |
|  LEVEL 3 | 128 NOTES           |  [cover] Prelude in E minor CHOPIN        6   |
|  [ PLAY ]  [ LEARN ]           |                                               |
+--------------------------------+-----------------------------------------------+
```

### 2. Playfield
```
+--------------------------------------------------------------------------------+
| Minuet in G   [ one-line score strip: current bar ]        87 COMBO  412,550 x4|
|--------------------------------------------------------------------------------|
|   faint pencil lanes, one per key, on cream paper                              |
|   ink-wash note bars fall: viridian = right hand, Prussian blue = left hand    |
|                                                          PERFECT  −8 ms        |
|================== gold-leaf hit line =========================================|
| [ 88-key keyboard, ivory and ebony, pressed keys tinted by hand ]             |
+--------------------------------------------------------------------------------+
```

### 3. Results
```
+--------------------------------------------------------------------------------+
|  [ wax-seal rank "A" ]          |  PERFECT   96                                |
|  Minuet in G                    |  GREAT     22                                |
|  PETZOLD                        |  GOOD       6                                |
|                                 |  MISS       4                                |
|                                 |  ACCURACY 91.2%   MAX COMBO 87               |
|--------------------------------------------------------------------------------|
| [ four bars of the score, noteheads colored by judgment, bars 9–10 boxed      ]|
|   "Practice bars 9–10"                     [ timing histogram ] [RETRY][SONGS] |
+--------------------------------------------------------------------------------+
```

### 4. Learn (the learning side, same world)
```
+--------------------------------------------------------------------------------+
| Learn · Minuet in G                                   chunk 3 of 8  ●●●○○○○○   |
|--------------------------------------------------------------------------------|
|  [ two bars of the score, large, the next note to play circled in gold ]      |
|  margin note (handwritten-style): "Left hand enters on beat 2"                 |
|--------------------------------------------------------------------------------|
|  [ keyboard, the next key softly lit ]                                         |
|  [ WAIT MODE ]  [ SLOWER ]  [ HANDS: R | L | BOTH ]           [ NEXT CHUNK → ] |
+--------------------------------------------------------------------------------+
```

### 5. Component sheet (the kit Codex is making the buttons for)
```
+--------------------------------------------------------------------------------+
| COMPONENTS                                                                     |
| buttons: PLAY (primary) · LEARN (secondary) · RETRY · SONGS · disabled · focus |
| song card (normal + focused) · level badge · NEW RECORD seal                   |
| judgment labels: PERFECT GREAT GOOD MISS WRONG · combo numeral · x2 x3 x4      |
| tabs / toggle: R | L | BOTH · speed 50% 70% 100% · progress dots              |
| ornaments: double rule, fleuron, frame corner · color swatches with names     |
+--------------------------------------------------------------------------------+
```
