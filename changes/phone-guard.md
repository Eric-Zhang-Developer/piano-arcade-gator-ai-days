## What shipped
On a phone or tablet (`(hover: none) and (pointer: coarse)`, or a window 480 px wide or less), `/` and `/play` show a full-screen card instead of the highway: the wordmark, "Piano Arcade is made for a laptop keyboard or a real piano.", "Open it in Chrome on a laptop.", a "See the code" link to the repo and a "Play anyway" button that hides it for the tab. It's decided by CSS alone and is in the server HTML, so a laptop never flashes it; there it's one hidden element. No video link until its URL is known.
## Where it lives
`web/src/game/phone-guard/` (#529; `verify-phone.mjs` with #535), `<PhoneGuard />` in `web/src/app/layout.tsx` (#535), screenshots in `specs/features/phone-guard/screens/`.
## How to check it
`node web/src/game/phone-guard/verify-phone.mjs --out <dir>`: pass locally (iPhone 13, Pixel 7, iPad Pro 11 landscape on `/` and `/play`; Play anyway, reload, new context; `/calibrate`; laptops 1280×720 and 1920×1080 with `display: none` and the first song focused). verify: pending.
## Gaps
- Not verified by Eric on his phone and Mac (the spec's last step).
- `videoUrl` is empty: no "Watch the video" link until Eric gives the URL.
- A touch laptop can't be emulated faithfully headless (`hasTouch` makes `pointer: coarse` match); Play anyway covers a misread one.
