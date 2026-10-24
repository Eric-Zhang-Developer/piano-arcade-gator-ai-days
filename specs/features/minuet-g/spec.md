---
name: "Minuet in G: a second song, right hand, charted from a cited score"
depends_on: ["core-loop"]
owns: ["web/public/songs/minuet-g/", "web/src/game/songs/minuet-g.test.ts"]
assignee: "eric"
---

# Minuet in G

The library's second song: **Minuet in G major, BWV Anh. 114** (from the 1725 Notebook for Anna Magdalena Bach,
attributed to Christian Petzold), right hand. It's brisk and in 3/4, a clean single-note melody, and well known.
Eric has played it before, so he can tell by playing whether the chart is right. It's the second row in
`song-select`.

## Requirements
- **The chart file:** `web/public/songs/minuet-g/chart.json`, in the `Chart` format (`web/src/contracts/`). It must
  pass `validateChart`.
- **Chart fields:**
  - `id`: `minuet-g`;
  - `title`: "Minuet in G major";
  - `composer`: "Christian Petzold (attributed; formerly J. S. Bach)";
  - `catalog`: "BWV Anh. 114";
  - `beatsPerBar`: 3.
- **Which notes:** the right hand of the A section, as printed, with its repeat written out if the score repeats it.
  Every note gets `hand: "R"`. Note `beat` and `duration` are in quarter notes, counted from beat 0 of bar 1 (the
  chart contract's rule).
- **Where they come from:** a cited score, never memory (`mission.md`). Any source decision 003 allows for committed
  files: for example a public-domain scan on IMSLP, or a Mutopia or MuseScore file with an open license. Put the
  URL and license in `source`, and in `CREDITS.md` if the license asks for credit.

  If no usable source can be reached, file a `needs-human` issue and leave the chart for Eric, as core-loop did.
- **Tempo:** `bpm` 100 by default. That's a playability setting, not a fact from the score; say so in the done note.
  Eric tunes it by playing.
- **No game code changes.** Playing it needs `/play?song=minuet-g`, which is core-loop's requirement (#75). If that
  isn't on main yet, open the chart directly with that URL once it lands; don't edit `/play` from this feature.

## Validation
- `pnpm -C web test`, in `web/src/game/songs/minuet-g.test.ts`:
  - The chart passes `validateChart`.
  - Every note's beat falls inside its bar, and bar lengths add up to 3 beats.
  - The note count equals the count the agent took from the source. Write the count and how it was counted in the
    done note.
  - A Perfect player (every note at offset 0, through `web/src/game/core/judge.ts`) gives all PERFECT, accuracy
    100%, rank S.
- On the piano (Eric; mark it in the done note): open `/play?song=minuet-g`, play it -> it's the Minuet you know, and
  the judgments line up with your playing. Say whether `bpm` 100 needs tuning.

## Defaults
- Prefer the smaller option: the A section only. The B section can come in a later PR.
- If the score has ornaments (trills, mordents), chart the main note only, and say so in the done note.
