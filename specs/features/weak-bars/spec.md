---
name: "Weak bars: accuracy per phrase, one click to practice the worst one"
depends_on: ["play-slots"]
owns: ["web/src/game/weak-bars/"]
assignee: "eric"
---

# Weak bars

The results screen shows a strip of accuracy per phrase (catalog G06). Clicking the weakest phrase opens `bar-loop`
on those bars at 80% tempo. It's a deterministic practice loop with no AI, and the game lane's by Eric's call
(2026-10-24). It's a `resultsPanel` (play-slots).

## Requirements
- **Phrases:** a pure `phrases(chart)` makes groups of `weakBarsSettings.phraseBars` bars (default 2) from bar 1,
  numbered as bar-loop numbers bars (bar n holds beats `(n-1)×beatsPerBar` up to `n×beatsPerBar`). The last phrase
  may be shorter. A phrase with no notes is skipped.
- **Accuracy per phrase:** `Results`' formula over the notes that start in the phrase, plus the WRONG notes whose
  press time falls in it. Use bar-loop's `passAccuracy` (import it; don't copy it).
- **The strip:** one cell per phrase, labeled "Bars 5–6", with its accuracy as a whole percent. The weakest phrase
  (lowest accuracy, earliest on a tie) is marked, with a button "Practice bars 5–6 at 80%". The button opens
  `/play?song=<id>&from=5&to=6&tempo=80` and keeps the other params that select the song (`song`, `hands`).
- **All clean:** if every phrase is at 100%, the strip says "No weak bars" and offers no button.
- **Bar-loop takes:** when the take came from bar-loop (`from` or `to` in the params), the panel renders nothing.
  bar-loop's own passes panel covers it, and its chart is re-timed.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: Twinkle (12 bars of 4/4) gives 6 phrases. A take that misses notes only in bars 5–6 makes 5–6
  the weakest, and the URL is exactly `/play?song=twinkle&from=5&to=6&tempo=80`. A WRONG press during bar 3 lowers
  phrase 3–4. A perfect take gives "No weak bars". A tie picks the earlier phrase. Params with `from` render nothing.
- `verify.py --slug weak-bars` passes.
- In Chrome, with screenshots in the PR:
  1. `/play?bot=rank-c` -> the strip shows six cells with the weakest marked.
  2. Click Practice -> bar-loop plays those two bars at 80% tempo.
  3. `/play?bot=perfect` -> "No weak bars".
- On the piano (Eric; mark it in the done note): play Für Elise, and say whether the phrase it picks is the one you
  stumbled on.

## Defaults
- Two-bar phrases. A chart with phrase marks would need a contract change, which isn't planned.
