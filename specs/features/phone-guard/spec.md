---
name: "Phone guard: a phone or tablet gets a 'made for a laptop or a piano' card instead of a broken highway"
depends_on: ["core-loop", "song-select", "ui-tokens"]
owns: ["web/src/game/phone-guard/"]
assignee: "eric"
---

# Phone guard

Judges may open the game's link on a phone, where there are no laptop keys or MIDI and 88 lanes don't fit. A clear
card that says what the game is for, with the repo (and the video once it has a URL), beats a broken screen. Hosting
is local only today (`specs/tech-stack.md`); this matters from the first deploy on, and costs nothing before it.

Issue: #373

## Plan
Two small PRs:
1. `feat(phone-guard)`, no done note: `<PhoneGuard />` and its CSS module in `web/src/game/phone-guard/`, and
   `verify-phone.mjs`.
2. `fix(core-loop)`: `web/src/app/layout.tsx` mounts `<PhoneGuard />` beside `<CaptureMode />`. Then a last
   `feat(phone-guard)` with the done note and the screenshots.

## Requirements
- **When:** the card shows on `/` and `/play` (any query) under `(hover: none) and (pointer: coarse), (max-width:
  480px)`, decided by CSS alone. It's in the server HTML with `display: none` outside that query, so a phone sees it
  from the first paint and a laptop never flashes it. Other routes never show it. (480 px: a phone in portrait; a
  laptop window that narrow is unlikely, and Play anyway covers it.)
- **What:** a fixed full-screen card above everything (`--pa-sky` behind, `--pa-panel` card): the wordmark, "Piano
  Arcade is made for a laptop keyboard or a real piano.", "Open it in Chrome on a laptop.", a "See the code" link to
  `https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days` (public, checked), a "Watch the video" link when
  `phoneGuardSettings.videoUrl` isn't empty, and a "Play anyway" button.
- **Play anyway:** hides the card for this tab (sessionStorage `pianoArcade.phoneOk`, `"1"`), so a misread laptop is
  never stuck. Storage blocked: it hides for this page only.
- **Accessible:** `role="dialog"`, `aria-modal="true"` and a label while shown; the first link focused; text at least
  16 px; links in `--pa-cyan`, not hand colors.
- **Laptops unchanged:** at a laptop viewport the DOM gains one hidden element and nothing moves.

## Validation
- Headless, from a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/phone-guard/verify-phone.mjs --out <dir>`. It starts its own dev server, prints
  `verify-phone: pass`, or names each failed step and exits 1:
  1. Playwright's `iPhone 13`, `Pixel 7` and `iPad Pro 11 landscape` devices, each on `/` and `/play?song=twinkle` ->
     the card is visible and covers the viewport; "See the code" has the repo URL; no video link while it's empty.
  2. On the iPhone, "Play anyway" -> the card is gone; reload -> still gone; a new context -> back.
  3. A laptop context (no touch) at 1280×720 and 1920×1080, on `/` and `/play` -> the card's computed `display` is
     `none`, and the song list's first card is focused.
  4. `/calibrate` on the iPhone -> no card.
  Screenshots of the card on each device go in `<dir>`.
- `verify.py --slug phone-guard` passes (a laptop viewport).
- Eric (mark it in the done note): open the deployed link (or `http://<laptop-ip>:3000`) on his phone, and on his Mac.

## How it's built and checked
Follow `specs/context/visual-direction.md`. Build with the `frontend-design` skill. Review with
design-taste-frontend's step 8, "Look": 1280×720 and 1920×1080 (where it must not show), the three devices above,
plus reduced motion. Before and after screenshots in the PR.

## Defaults
- Measured: Playwright's `hasTouch` alone makes a 1280×720 context match `(pointer: coarse)`, so a touch laptop
  can't be emulated faithfully headless. Real touch laptops report a fine primary pointer with hover; "Play anyway"
  covers any that don't.
- The video's URL is unknown: `videoUrl` stays `""` (no link) until Eric gives it. Don't invent one.
- No user-agent sniffing and no redirect. Log choices in `specs/decisions/phone-guard-*.md`.
