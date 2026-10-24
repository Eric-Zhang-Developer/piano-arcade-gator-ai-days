---
name: "Records: best grades and a local top 5 with arcade initials"
depends_on: ["play-slots"]
owns: ["web/src/game/records/"]
assignee: "eric"
---

# Records

Song select shows your best grade for each song (catalog G07). Each song keeps a local top 5 with 3-letter arcade
initials (catalog G14), and a new best flashes NEW RECORD. Everything is local: an online leaderboard stays on
`mission.md`'s Not doing list.

## Plan
1. The pure record store in `web/src/game/records/`, with its tests.
2. The plugin in `layers.ts`. It keeps the take's HUD state from its events, and its `resultsPanel` shows NEW RECORD,
   the initials entry and the top 5.
3. **A `fix(song-select)` PR:** each row shows its best grade from the store.

## Requirements
- **Storage:** one key, `localStorage["pianoArcade.records"]`, holding JSON keyed by chart id. Each chart keeps its
  best (rank, accuracy, score, date) and a top 5 (initials, score, accuracy, rank, max combo, date). Reads and writes
  sit in try/catch. If storage is blocked, the panel says records can't be saved in this browser. If the JSON is
  corrupt, it counts as empty and one console line says so.
- **Score:** the HUD's score, rebuilt from the take's `GameEvent`s with hud's `reduceHud` (import it; don't copy it),
  so a record shows the number the player saw. Ties break on accuracy, then the earlier date.
- **Best grade:** the best rank, with ties broken on accuracy.
- **Practice takes aren't recorded:** a take with `from`, `to`, `tempo`, `mode`, `bot`, `versus`, or `hands` other
  than `both` in its params. The panel says why in one line.
- **NEW RECORD:** when a take beats the stored best score, the panel flashes "NEW RECORD". It plays no new sound,
  because `mission.md`'s list of event sounds doesn't include one.
- **Initials:** when the score makes the top 5, the panel asks for 3 letters. Typing A–Z fills them, ↑ and ↓
  cycle the current letter, Backspace goes back, and Enter saves. Leaving the screen without Enter keeps the entry
  with the initials "---".
- **The top 5** shows under the entry, with the new one marked.
- **Song select:** each row shows the best rank and accuracy, and nothing for a song never played. The best grade is
  never guessed.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: inserting six scores keeps the top 5 in order and drops the lowest. A tie breaks on accuracy.
  Each practice param keeps a take out. Corrupt JSON reads as empty. The best grade updates only on a better rank,
  or the same rank with better accuracy. Initials default to "---".
- `verify.py --slug records` passes. Its fresh browser profile starts with no records.
- In Chrome:
  1. Play Twinkle on laptop keys -> NEW RECORD shows, type initials, then Enter. Open `/` -> Twinkle's row shows the
     grade.
  2. Play worse -> no NEW RECORD, and the take lands in the top 5 if it qualifies.
  3. `/play?bot=perfect` -> "Practice takes aren't recorded".
- On the piano (Eric; mark it in the done note): two takes of Twinkle, with initials on the better one.

## Defaults
- Clearing records is DevTools' job. There's no reset button.
