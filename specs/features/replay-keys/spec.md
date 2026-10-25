---
name: "Replay keys: the replay shows the same keyboard as the take, for hands= and bar-loop takes too"
depends_on: ["replay-view", "static-keyboard", "hand-mode", "bar-loop"]
owns: ["specs/features/replay-keys/", "changes/replay-keys.md", "specs/decisions/replay-keys-"]
assignee: "eric"
---

# Replay keys

Issue #419, a bug from static-keyboard (#392) that was never reproduced. /play fixes its keyboard from the chart
as loaded, before any plugin's `transformChart` (`app/play/page.tsx:75`, `:102`: `keysRef.current =
staticRange(raw)`). replay-view's overlay calls `makeLayout(chart, innerWidth, innerHeight, settings.perspective)`
with no key range (`replay-view/overlay.tsx:62`), so `makeLayout` falls back to `staticRange(chart)` of whatever
chart the overlay is given (`core/highway.ts:87`). For a whole-song take they match. For a `hands=` or bar-loop take,
if the overlay gets the transformed chart, the replay shows a narrower keyboard than the take did.

## The change
1. **Reproduce first** (AGENTS.md, Bug reports): one `hands=R` take on fur-elise and one bar-loop take, then the
   replay. Compare the key count and range on /play during the take with the replay's. #419 expects fur-elise at
   C2–C7, 36 white keys; read the take's own count rather than trusting that number.
2. **If it reproduces:** the replay uses the take's key range. #419's options: pass the take's range into the
   overlay, or recompute it from the untransformed chart. Take the smaller one that doesn't touch
   `web/src/contracts/`; log the choice in `specs/decisions/replay-keys-range.md`.
3. **If it doesn't reproduce:** no code. Comment on #419 with what you ran and both counts, label it `needs-info`
   if anything is missing, or close it as not reproduced with the evidence. Write the done note with "no change" in
   What shipped.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files).

| File | Owning feature | Held when this was written |
|---|---|---|
| `web/src/game/replay-view/overlay.tsx`, `index.ts`, `replay-view.test.ts` | replay-view | free |
| `web/src/app/play/page.tsx` | core-loop | **#600** (`fix:`, open): avoid it; only if the range can't reach the overlay another way, and then switch once #600 frees it |

## Design pass (AGENTS.md, Visible changes)
Only if the replay's keyboard changes. Then:
- Invoke `frontend-design`, then `design-taste-frontend` (taste v2) for the look loop.
- Shots of the replay of a `hands=R` fur-elise take, before and after, at 1280×720 and 1920×1080, from your own
  dev server in the in-app browser (one dev-server slot, `devserver.1` to `.4`), next to a shot of the take itself.
- Score against `references/critique.md`, fix the top three problems, at most three rounds.

## Validation
- **(a) Reproduction:** the PR (or the #419 comment) lists the take's and the replay's key ranges for a `hands=R`
  fur-elise take and a bar-loop take, on origin/main.
- **(b) If fixed:** a unit test in `replay-view.test.ts` builds the layout for a transformed chart with the take's
  range and gets the take's keys; the same ranges listed again on the branch match.
- **Unit tests:** `pnpm -C web exec vitest run src/game/replay-view`.
- `verify-replay.mjs` runs in CI's browser suite; the done note says "not verified locally; covered by main's
  scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/replay-keys-*.md`.
- No new dependency. No change to the take's shape in `web/src/contracts/`.
