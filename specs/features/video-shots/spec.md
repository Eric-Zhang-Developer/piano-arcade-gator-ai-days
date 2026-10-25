---
name: "Video shots: a shot list for the ~90 s of game footage, a title and an end card, and capture mode clean from the first frame"
depends_on: ["capture-mode", "duo-tokens", "scenes", "golden-demo", "nav-bar", "build-stamp"]
owns: ["web/src/game/video-shots/", "web/src/app/shots/", "specs/features/video-shots/", "changes/video-shots.md", "specs/decisions/video-shots-"]
assignee: "eric"
---

# Video shots

Issue #852. Eric, 2026-10-25: "We should also start thinking about adding specific visuals for the hackathon video
and whatnot". The issue: "Title cards, a capture-mode polish pass, the Golden demo moment, the Duo look's
before/after. Each one tied to a shot the video needs."

Eric fears agent scope creep, and the game gets about 90 seconds of the 3-minute video. So this feature builds
nothing the video doesn't show: every piece of it answers one row of a shot list, and a row with no gap gets no code.

## End state
Eric records the game footage from one list: each shot has a URL that renders it clean under `?capture=1` at
1920×1080, from the first frame. The two cards the video's plan names (a title card and an end card) are pages in the
Duo look, so the edit adds no designed text of its own.

## What exists (origin/main, 2026-10-25)
- **The video's plan** (both tentative): the table in `specs/context/raw/piano-arcade-writeup.md`, "The Devpost
  video" (0:00 the opening wow then a title card, 0:12 the select, 0:16 a Für Elise take to results, 0:40 a
  montage, 1:00 the WARNING card and Var. XII, 1:25 any song, 1:35 "Golden", 1:50 an end card and QR code); and "The
  screens (the video's shot list, tentative)" in `specs/context/visual-direction.md` (cold open, select, stage card,
  play, results). The dialogue (`specs/context/dialogues/2026-10-25-what-are-we-building.md`) proposes a 30-second
  cold open and decides that every number in the video is real.
- **What already makes shots:** capture-mode (`?capture=1` hides the cursor and setup text; `recording.md` in its
  spec folder is the recording guide), scenes (`?bot=perfect`, `fever`, `rank-a`…), hero-replay (`bot=take`),
  watch-demo (W, the DEMO badge), the difficulty WARNING card (level 13 and up), golden-demo (the DGX autoplay URL in
  its done note; Golden's charts stay local).
- **Capture's known gap** (its done note): "The flag applies after hydration, so a page's first frames can show
  both."
- **The tagline** decided in the dialogue's Book I: "a machine that hears every note, and a reason to play one more
  time."
- **The live URL** isn't set yet (#792); the repo URL is.
- **Not this feature:** highlight-reel (the 15 s replay WebM, #913), results-landing (the 3 s to the rank, #959) and
  the music select's layout (main-page, #851).

## Plan
1. **The shot list first (the worker's research).** Before any code, invoke `frontend-design` and
   `design-taste-frontend`. From the two plans above and the done notes of the features they name, write
   **`specs/features/video-shots/shot-list.md`**: one row per game shot in the ~90 s, with its time in the plan, what
   the viewer sees, the URL and setup that produce it, and its state today (clean, or what shows that shouldn't).
   Open each URL with a committed song in your dev server under `?capture=1` to fill the state column. Then look at
   how two or three game trailers of the worker's choice open and close (title and end cards: what's on them, how
   long, how they move), from public videos, and write what you take and drop in
   **`specs/decisions/video-shots-brief.md`**. Notes only: never commit frames from other games or videos
   (decision 003). Commit both before the first code commit.
2. **`feat(video-shots)`, part 1, capture from the first frame:** set capture's flag before the page paints (a short
   inline script in the root layout, or the smallest way that works), so the first frames match the rest; then fix
   each leftover the shot list found. Golden's row is checked on a committed song with the same flags.
3. **Part 2, the cards:** `/shots?card=title` and `/shots?card=end`, in `web/src/app/shots/` and
   `web/src/game/video-shots/`, then `verify-shots.mjs`, the design pass and the done note.
4. **The Duo before/after** is built only if the shot list gives it a row in the ~90 s. The plans don't today, so the
   default is not built, logged in the brief.

**Lane rule.** Part 1 reaches other features' files. All are `eric`'s lane, so this feature may change them while no
open PR is working on them: check `gh pr list` and each open PR's files first. #600 (abbasi2010) is stale and doesn't
block, but keep the diffs narrow.

| Files | Owner | What changes |
|---|---|---|
| `web/src/game/capture-mode/` | capture-mode | the early flag |
| `web/src/app/layout.tsx` | core-loop | the early flag's script, within the mount rule (at most 4 added, 2 removed lines) |
| `web/src/game/scenes/`, `web/src/game/watch-demo/`, `web/src/game/audio-track/` | their features | only to hide, under capture, a leftover a shot-list row shows |

## Requirements
- **The shot list decides the scope.** Nothing gets built for a shot that isn't a row, and a clean row gets no code.
  A row needing anything beyond the cards, the early flag and hiding leftovers goes to the planner as a comment on
  #852, not into this PR.
- **The title card:** `APP_NAME` (`web/src/game/app-name/`) and the tagline, quoted as written. **The end card:** the
  repo URL, and the live URL only when it's set (one constant or env value in `web/src/game/video-shots/`); unset, it
  isn't shown, and nothing stands in its place. No QR code unless a QR library is already installed (none is today):
  then it's made in the edit, logged in the brief.
- **No made-up text or numbers** on a card: no song counts, scores, dates or quotes beyond the two above.
- **Moments are short** (`visual-direction.md`): each card's motion ends within 2 s and then holds still, so any cut
  of it is usable. Reduced motion shows the end state at once.
- **Readable on video:** every word on a card is at least 24 px at 1920×1080.
- **The Duo kit** (`web/src/game/duo-tokens/`): black, blue and purple, sharp corners, no synthwave sun or grid, no
  hype pink outside moments. The cards sit on the game's black, so a cut from a card to play doesn't jump.
- **`/shots` is for recording:** no nav-bar slot, not linked from any page, and without `card` it lists the cards as
  links.
- **The early flag:** with `?capture=1`, nothing capture hides shows in any frame, on `/` and `/play`. Without the
  flag, nothing changes.

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/video-shots src/game/capture-mode`: the end card shows the
   live URL only when it's set; each card's motion ends at or before 2000 ms; reduced motion gives the end state at
   t = 0; the existing capture tests pass.
2. `web/src/game/video-shots/verify-shots.mjs`, run by CI (AGENTS.md load rule: no local browser run; the done note
   says "not verified locally; covered by main's scheduled full run"):
   1. `/shots?card=title&capture=1` at 1920×1080 -> `Étude` and the tagline, no cursor, nav bar, build stamp or
      account chip; still at 2 s; every word at least 24 px.
   2. `/shots?card=end&capture=1` with no live URL -> the repo URL, no QR and no empty box.
   3. Reduced motion on either card -> the first frame equals the 2 s frame.
   4. With the app's scripts blocked (intercept `/_next/static/chunks/`), `/?capture=1` and
      `/play?song=twinkle&capture=1` -> none of capture's hidden list is visible: the first-frames gap is closed.
   5. Each shot-list row on a committed song -> its URL under `?capture=1` shows none of capture's hidden list.
      Golden's rows are skipped (local charts).
3. **Planner's bars, not measured:** each row needs at most one setup step besides `?capture=1`; each card's length
   fits its row's seconds in the shot list.
4. The design pass (AGENTS.md, Visible changes): both cards at 1280×720 and 1920×1080 plus reduced motion, scored on
   taste v2's `references/critique.md`, at most three rounds, in the PR's Design section.
5. Eric records from the shot list once, Golden included, on his Mac (mark it in the done note). It doesn't block the
   merge.

## Gaps and defaults
- **Open:** the live URL (#792) and whether the end card gets a QR code. Both stay empty until Eric sets them.
- **Open:** the plans are tentative. If Eric changes the cut, the shot list follows in a `fix(video-shots)` PR.
- The cold open (black room, the LED strip) is shot on camera; it needs no page.
- Prefer the smaller option: two cards and hidden leftovers over new scenes, overlays or an in-app editor.
- If the spec is silent, take the smaller, reversible option and log it in `specs/decisions/video-shots-<topic>.md`.
