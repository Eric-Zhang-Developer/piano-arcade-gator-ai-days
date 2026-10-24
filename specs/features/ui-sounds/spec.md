---
name: "UI sounds: cursor, confirm, back and a stage-card sting"
depends_on: ["juice-sound", "select-layout", "stage-card"]
owns: ["web/src/game/ui-sounds/"]
assignee: "eric"
---

# UI sounds

Arcade menus answer every move. Moving through songs, picking one, backing out and the stage card each get a short
synthesized sound. All of them sit under the music: song-preview's opening on `/`, and the piano on `/play`.

Issue: #266

## Plan
A feat and three few-line fix PRs, about an hour.
1. A `fix(juice-sound)` PR: export `tone` and `noise` from `web/src/game/sound/index.ts`. Nothing else changes, and
   juice-sound's tests pass unchanged.
2. `web/src/game/ui-sounds/`: `uiSound(name, delayMs = 0)` for `move`, `confirm`, `back`, `sting`, `tick` and
   `tickAccent`, built from `tone` and `noise`, on the module's own AudioContext and gain.
3. A `fix(select-layout)` PR: `move` when ↑/↓ moves the focus (not at the list's ends, not on hover), and `confirm`
   when a card is chosen (Enter or click).
4. A `fix(stage-card)` PR: `sting` once each time the stage card mounts.
`back`, `tick` and `tickAccent` have no caller here: pause-skin uses them (Esc, and its resume countdown).

## Requirements
- **Synthesized:** Web Audio oscillators and noise only: no sample files, no new dependency.
- **Mixer:** the gain follows juice-sound's prefs (`getPrefs`, `subscribePrefs`). The effects volume scales every
  UI sound, and mute silences them at once, sounds already scheduled included. The miss-sound setting doesn't apply.
- **Under the music:** each UI node's peak gain, before the effects volume, is at most song-preview's laptop-tone
  peak (`previewSettings.toneVolume` × `velocity` / 127, about 0.05), so also under juice-sound's quietest event
  sound (`soundSettings.levels.miss`, 0.15). A 0.15 cap would sit above the preview it must stay under.
- **After a gesture:** Chrome starts audio only after a key press or click. A sound asked for before the page's
  first one (`navigator.userActivation.hasBeenActive`) is dropped, never queued to play late, so a direct load of
  `/play` gets no sting. Don't gate on the context's `state`: a context made in the first key handler can still read
  `suspended`, which would drop the first `move`.
- **Tick:** the pitches and length of beat-track's laptop click (`beatSettings.clickHz`, `clickAccentHz` and
  `clickLengthS`), so pause-skin's countdown sounds like the count-in's laptop fallback.
- Every node it starts has a stop time: no held tones. Nothing else changes: ↑/↓, Enter, song-preview's opening
  and the stage card behave as before.

## Validation
- `pnpm -C web test`, with a fake AudioContext: each sound starts nodes and stops them, every peak is at most the
  preview-tone peak, the gain goes to 0 at once on mute, and nothing starts before a user activation.
  `verify.py --slug ui-sounds` passes.
- Headless Chrome (Playwright) on `/`, with a page-side spy logging `OscillatorNode.start` calls. song-preview's
  tones start 400 ms after a row settles (`previewSettings.delayMs`), so steps 2 and 4 count only starts within
  100 ms of a press:
  1. Load and press nothing -> no starts.
  2. Press ↓ three times, 150 ms apart -> three `move` sounds. On the last song, press ↓ -> none.
  3. Press Enter -> a confirm, then one sting when the stage card shows on `/play` (Enter stops the preview).
  4. Tick Mute on the start screen, then go back to `/` and press ↓ -> no starts.
- Eric's ear (mark it in the done note): on the laptop with song-preview playing, and on `/play` with the DGX, do
  the sounds sit under the music, and are they still fine after 20 moves? `not verified by Eric` until he does.

## How it's built and checked
Build with the `frontend-design` skill (its feedback and motion guidance). There's nothing new to see, so
design-taste-frontend's step 8, "Look", is a regression check: `/` and the stage card at 1280×720, 1920×1080 and
reduced motion, before and after, should match. Put both sets of screenshots in the PR.

## Defaults
- Shapes, to tune by ear: `move` a ~30 ms triangle blip, `confirm` two rising notes, `back` two falling notes,
  `sting` a rising arpeggio under 1 s. Levels start at the cap (the default effects volume, 0.5, halves them) and
  only go down by ear. Reduced motion doesn't silence them.
- One AudioContext, made on the first sound after a gesture and kept for the page's life (client-side navigation
  keeps it from `/` to `/play`). `/play`'s Start makes no UI sound: the count-in starts right away.
- select-to-stage's `fix(select-layout)` also changes the card's click and Enter. Whichever merges second keeps both.
- Log choices in `specs/decisions/ui-sounds-*.md`. Prefer the smaller option.
