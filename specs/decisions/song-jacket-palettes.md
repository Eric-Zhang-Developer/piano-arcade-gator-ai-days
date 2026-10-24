# song-jacket: hand-picked palettes, not random colors

**Context:** the spec asks for an angle and two or three gradient stops from the cabinet colors, chosen by id. Mixing
any two of the ten colors at random gives muddy pairs (cyan into green into violet) and many near-twins.

**Options:** A) a hand-picked list of ten palettes, one dominant hue each, each with its own text color (sky on light
gradients, ink on dark); the id's hash picks a palette and one of eight angles 45° apart. B) random stops per id.

**Choice:** A. Every jacket the hash can produce was seen in a screenshot. With ten palettes, two songs can share a
palette (today Twinkle and Nocturne both get yellow to green); they still differ in angle and word. More palettes
fix that when the library grows.

**How to undo:** edit `palettes` and `angles` in `web/src/game/song-jacket/index.ts`; the test checks the colors.
