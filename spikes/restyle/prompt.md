# Restyle brief (restyle-spike)

Every run starts from this page. You are a worker's own Claude Code session: no API key, no spend.

## The job
Rewrite one library chart as one style. Write it to `web/public/songs/local/<source id>-<style>/chart.json`. That
folder is never committed: a spike never ships by itself.

| Source | Style | Restyle id |
|---|---|---|
| `twinkle` | trap | `twinkle-trap` |
| `ode-to-joy` | waltz | `ode-to-joy-waltz` |
| `minuet-g` | ragtime | `minuet-g-ragtime` |
| `fur-elise` | lullaby | `fur-elise-lullaby` |

## Locked: the melody's pitches
- The melody is the source's right hand, its highest pitch at each onset, in beat order (`melody()` in
  `web/src/game/restyle/`).
- Your right hand has exactly one note per onset, and its pitches are that melody, in order.
- No note added, dropped, repeated, swapped or moved by an octave. No right-hand chords, octaves or fills.

## Free
- Each melody note's `beat`, `duration` and `velocity`, the chart's `bpm` and `beatsPerBar`, and swing (it's just
  beats).
- The whole left hand. Write it fresh over the source's harmony: never recall or copy a published arrangement of the
  piece in this style.
- Left-hand notes still pass chart-lint: one onset spans ≤ 16 semitones, and no two notes of the same pitch overlap,
  across both hands.

## The chart's label
- `id`: the restyle id. `title`: `<source title> (<Style>)`. `composer`: the source's. `catalog`: `restyled from
  <source title>`.
- `source`: `Restyled as <style> by a Claude Code session from library chart <source id>. Melody pitches locked to it
  (restyle-spike); rhythm, meter and left hand are the session's. Melody source: <the source chart's source>`.

## The checks (run both; fix and repeat until they pass)
```bash
pnpm -C web exec vitest run --passWithNoTests src/game/restyle
pnpm -C web exec vitest run --passWithNoTests src/game/songs/library.test.ts
```

## Play it
`/play?song=local/<id>&hands=R&beat=<style>`. `hands=R` judges only the locked melody, and the DGX plays your left
hand. Restyles are played with `hands=R` only until Eric rules on #506.

## Record, per run
Pass or fail, minutes, attempts until the lock passed, and the session's tokens if its usage shows them.
