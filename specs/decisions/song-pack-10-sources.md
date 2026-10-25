# song-pack-10: sources, excerpts, ids and edits

eric-agent-14, 2026-10-25. Each Mutopia page was read for piece, edition and license before charting.

| id | Mutopia | Edition (typesetter) | License | Printed tempo | MIDI tempo | Chart |
|---|---|---|---|---|---|---|
| `chopin-ballade-coda` | [1959](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1959) | Klindworth, Bote & Bock n.d. [1880] (Javier Ruiz-Alma) | CC BY-SA 4.0 | "Presto con fuoco.", no number | ♩ = 210 (bar 208), 180 (bar 242) | bars 208–264, 168 |
| `chopin-etude-10-5` | [926](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=926) | Peters, Herrmann Scholtz 1900 (Roland Goretzki) | Public Domain | "Vivace (♩ = 116)" | 116 | bars 1–64, 96 |
| `chopin-op10-1` | [914](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=914) | Peters, Herrmann Scholtz 1900 (Roland Goretzki) | Public Domain | "Allegro (♩ = 176)" | 176 | bars 1–16, 120 |

The PDF (`chopin-op23-ballade-1-let.pdf`) prints the coda: "Presto con fuoco." at bar 208, `\time 4/4`, to the
final bar 264.

**sha256:** `chopin-op23-ballade-1.mid` b8f93fa0fb1c3a61a4ba13fdc287282d8efe3d3ec76b575ac8f186016e55007f,
`-lys.zip` 12ea065f8ff94ca362909d613cda7cd2fc2a253c81babcc005a22caf0447ec8a, `-let.pdf`
e9ecbdfc7d035983da6fcaf18d6742efc590a4408ab9c1cf3c30e2ffd4e28033 · `chp-10-05.mid`
3b7c267dc6047e881b7404e47259de23dce3cfe8fe74966a1cc28adacf5e3336, `-lys.zip`
3645e170b7d5bea0d0f1ed0274f5f23464ca3fa67747a8e0781a928c16e1fc22 · `chp-10-01.mid`
42c52ece86795168636b3bbd387393fba9759214498a20b39308c848f8e49f03, `-lys.zip`
63fbf21984a6d0d59b5f71d3c573ebff226af7e02dc192e90f103d5635515145.

## Edits after conversion
- **Ballade coda, free runs:** bars 246, 248, 249, 251 and 255 are `\scaleDurations` runs (16/13 to 16/28) that no
  1/12-beat grid holds. A pre-pass drops every off-grid onset in those bars (130 notes, both tracks) and keeps the
  on-grid ones, as pack 7 kept the Raindrop's fioritura main notes.
- **Ballade coda, bar 246:** the left hand's rolled chord D3–A3–C4–G4 (`\arpeggio`) spans 17 semitones, over the
  library's 16. Its top G4 is dropped (one note).
- **Black Key, bars 32–33:** 9 right-hand triplet notes printed on the lower staff go back to R (the left hand holds
  octaves there), as pack 8 did for the Revolutionary. Bar 64's last left-hand note is a grace note before bar 65,
  outside the excerpt; dropped.
- **Rounding:** one Black Key note's 6-decimal duration ran 1e-6 into the next same-pitch onset; it now ends there.
- Grace notes skipped by the converter; `velocity` removed (dynamics are demo-performance's).

## Ids
The spec's ids hash to taken jackets: `chopin-ballade-1-coda` looks like `pathetique-2`, `chopin-black-key` like
`entertainer`, `chopin-etude-10-1` like `brahms-waltz-15`. Shipped as `chopin-ballade-coda`, `chopin-etude-10-5`,
`chopin-op10-1`.

## Not charted
Ballade No. 4's coda (Mutopia 422) converts, but 14 same-pitch overlaps fail the library test; not fixed in this
window. The two nocturnes are #1399.

**Rebuild** (from `game-tools/midi-to-chart/`, the pre-pass drops off-grid onsets in the named bars):
`convert.py b1-runs-main.mid --rh 1 --lh 2 --bars 208-264 --bpm 168`, `convert.py bk-no-grace-64.mid --rh 1 --lh 2
--bars 1-64 --bpm 96`, `convert.py chp-10-01.mid --rh 1 --lh 2 --bars 1-16 --bpm 120`.
