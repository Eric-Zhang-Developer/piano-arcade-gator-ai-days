---
name: "Offline ready: a script proves the game runs from the laptop with the venue's wifi off"
depends_on: ["core-loop", "song-select", "ui-tokens", "sheet-view"]
owns: ["web/src/game/offline-ready/"]
assignee: "eric"
---

# Offline ready

Judging runs on venue wifi. Read on main at the time of writing: every runtime `fetch` is same-origin
(`/songs/<id>/chart.json`, `/api/operator`), no source names an `http(s)://` URL at runtime, three.js and
OpenSheetMusicDisplay are bundled, and Saira comes through `next/font/google`, which self-hosts it under
`/_next/static/media`. So the smallest route is no service worker: `next build` (online) then `next start` on the
laptop, and a script that proves it and fails the day something reaches off the machine.

Issue: #368

## Plan
One PR: `web/src/game/offline-ready/verify-offline.mjs` and the done note. Anything the script finds is its owner's
`fix(<owner>)` PR (file an issue), not a change here.

## Requirements
- **Build and serve:** the script runs `next build`, then `next start` on a free port (perf-budget's `perf.mjs` does
  the same), and drives Chromium at 1280×720.
- **Wifi off:** the context routes every request whose host isn't `localhost`, `127.0.0.1` or `[::1]` to `abort()`
  and records its URL. That's wifi off: loopback still works. (Playwright's `context.setOffline(true)` blocks
  localhost too: measured, `page.goto` fails with `net::ERR_INTERNET_DISCONNECTED`. So it's used only after load.)
- **Canary first:** the page fetches `https://example.com/`; the script must see it blocked and recorded, or it exits
  1 with `canary not blocked`. A broken route can't pass silently. The canary is then cleared from the record.
- **The walk:** `/` -> the song list shows -> Enter on the first card -> `/play?song=twinkle` -> its start screen ->
  `/play?song=twinkle&bot=perfect`, Start -> results with 42 PERFECT. Then `/sheet?song=twinkle` -> the score renders
  (OSMD's chunk loads from localhost).
- **Fully offline take:** on a fresh `/play?song=twinkle&bot=perfect` that has loaded, `context.setOffline(true)`,
  then Start -> results with 42 PERFECT (tech-stack: nothing in the playing loop touches the network).
- **Font:** on `/` and `/play`, `document.fonts` has a Saira face with status `loaded`.
- **Output:** one line, `verify-offline: pass, 0 off-machine requests` and exit 0; else every blocked URL and failed
  step, and exit 1. Screenshots of `/` and the results in `--out`.
- **Done note's statement:** with wifi off, `pnpm -C web start` on a build made online serves the whole game from
  localhost. `next build` needs the network (next/font downloads Saira then, and a failed download fails the build);
  `pnpm dev` offline falls back to system fonts (next/font's dev path in `loader.js`). So build before leaving.

## Validation
- From a clone: `pnpm -C web install && pnpm -C web exec playwright install chromium`, then
  `node web/src/game/offline-ready/verify-offline.mjs --out <dir>` -> `verify-offline: pass`, exit 0.
- It can fail: add `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira">` to a scratch
  copy of `layout.tsx` (not committed) -> the script names that URL and exits 1. Note the run in the PR.
- `verify.py --slug offline-ready` passes.
- Eric (mark it in the done note): at home, `pnpm -C web build`; wifi off; `pnpm -C web start`; open
  `http://localhost:3000` in Chrome and play Twinkle on the DGX. Title in Saira, MIDI connects, the take ends.

## Defaults
- No service worker and no PWA: the laptop serves the game itself. A service worker would only matter for the
  deployed URL, and with the wifi down a phone can't reach that anyway.
- `/operator` and `/attract` (live board, `gh`) are tools, not the game: not walked.
- Unknown, not guessed: whether `pnpm dev` with a warm `.next/cache` keeps Saira offline. Eric's check if he runs
  dev at the venue.
- Log choices the spec doesn't make in `specs/decisions/offline-ready-*.md`.
