---
name: "Song preview: the highlighted song plays its opening in song select"
depends_on: ["difficulty", "records"]
owns: ["web/src/game/song-preview/"]
assignee: "eric"
---

# Song preview

Highlighting a song in song select plays its opening bars on the piano, or through Web Audio without one. A panel
beside the list shows its level, notes per second, best grade and a PRACTICE 70% button (catalog G08).

## Plan
1. The preview panel and the opening player in `web/src/game/song-preview/`.
2. **A `fix(song-select)` PR:** the list renders the panel for the highlighted row, whether reached by focus (↑ and
   ↓) or by hover.

## Requirements
- **When it plays:** 400 ms after a row is highlighted and stays highlighted. The page fetches that chart
  (`/songs/<id>/chart.json`) and caches it for the page.
- **The panel:** title, composer, level and notes per second (both from `difficulty`, imported), and the best grade
  from `records`, blank if the song was never played. Plus a **PRACTICE 70%** button that opens bar-loop on the whole
  song: `/play?song=<id>&from=1&to=<last bar>&tempo=70&passes=1`.
- **The opening:** the chart's first 2 bars at its own tempo, capped at 8 s. It plays on the piano when connected:
  find the output by `name` "Portable Grand", channel 1, with the chart's velocities when present and 80 otherwise.
  Without a piano, it plays as quiet Web Audio tones.
- **Stopping:** when the highlight moves, on Enter, on `pagehide` and when the opening ends, the preview cancels its
  queue and sends All Notes Off on channel 1, so no note hangs.
- **Silent until a gesture:** nothing plays before the first key press or click on the page (Chrome's autoplay
  rule). Until then the panel says "Press any key for previews". Nothing ever plays on page load.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: the opening holds exactly the notes that start in bars 1–2, cut at 8 s. The PRACTICE URL for
  Twinkle is `/play?song=twinkle&from=1&to=12&tempo=70&passes=1`. Stopping cancels the queue and sends All Notes Off.
  A song never played shows a blank best grade.
- `verify.py --slug song-preview` passes. Its first step still opens Twinkle from `/`.
- In Chrome:
  1. Open `/` and press ↓ -> after a moment the panel shows level, notes per second and best grade, and the opening
     plays as tones.
  2. Press ↓ again mid-preview -> the first stops and the next starts.
  3. Click PRACTICE 70% -> bar-loop at 70%.
- On the piano (Eric; mark it in the done note): scroll through the list. The DGX plays each opening, and nothing
  hangs when you move on.

## Defaults
- No preview volume control. The piano's own volume knob covers it.
