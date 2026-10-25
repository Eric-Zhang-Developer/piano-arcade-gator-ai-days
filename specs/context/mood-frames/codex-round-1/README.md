# Codex mood frames, round 1: three directions for the music select

Generated 2026-10-24 (about 11 PM ET) with Codex CLI 0.157.1's image generation, one `codex exec` call per frame. The
exact prompt for each frame is in `prompts/`. 1672×941 or 1920×1080, saved as JPEG.

**These are mood frames, not data.** The image model drew the sheet music, levels, scores and tallies itself: key
signatures are wrong in places (Für Elise with a sharp), and the numbers are placeholders. Never copy a note, level or
count from these images. Covers and score strips get drawn from each song's chart.

**Not a decision.** `specs/context/visual-direction.md` is still the look. A change goes through a `contract:` PR.

## Frames
- `00-current-select.jpg`: the music select on `main` at `3939fb0`, Eric's screenshot. The baseline.
- `01-score-is-art-select.jpg`: "the score is the art": black cabinet, each jacket is the first bar of the score glowing
  in a hand color, serif titles, arcade numerals, one PLAY and one LEARN.
- `02-classical-paper-select.jpg`: "classical paper": cream paper, engraved covers, oxblood accents.
- `03-refined-synthwave-select.jpg`: "refined synthwave": the current direction with restraint, abstract jackets.
- `04-score-is-art-playfield.jpg`: the playfield in direction 01: Synthesia lanes, a gold score strip, serif HUD.
- `05-score-is-art-results.jpg`: the results in direction 01: the take colored onto the real score, bars to practice.

## What Eric said
- On the current select (00), 2026-10-24: the UI and UX need "a proper pass".
- On classical paper (here and in `../codex-classical/`): "we lose the whole arcade heritage of the game."
