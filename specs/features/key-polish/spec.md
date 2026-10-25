---
name: "Key polish: the drawn keyboard and the falling notes, a concentrated pass to hit-particles' level"
depends_on: ["hit-particles", "key-skin", "key-preview", "note-pills", "pill-match", "hit-line", "hand-colors", "black-key-lanes"]
owns: ["specs/features/key-polish/", "changes/key-polish.md", "specs/decisions/key-polish-"]
assignee: "eric-agent-1"
---

# Key polish

Issue #848. Eric, 2026-10-25, after hit-particles landed: "I really would like the keys (like the keyboard itself, as
well as the keys that are following the Synthesia keys) to really get as much polish as the effects did", "a really
concentrated pass", "I want the final product to be very polished." The two things a player watches all song, the
drawn **keyboard** and the **falling notes**, get one pass to the level `changes/hit-particles.md` reached.

Assignee eric-agent-1: it built key-skin, note-pills and hit-line, and holds the open duo-hud PRs on the same files.

**Today (done notes on main):** key-skin (white-key sheen, black-key bevel, pressed keys filled in the hand color with a
glow onto neighbours), key-preview (a 500 ms glow before a note arrives), hit-line (a moving white stroke, a white-hot
blob over pressed keys), note-pills (rounded pills sized to the key, 35%→100% brightness towards the line), pill-match,
hand-colors, black-key-lanes, and hit-particles' bloom, dust and wisps over the notes.

## Plan
**One PR: `feat(key-polish)`**, under AGENTS.md's "Ownership is open within a lane". All of these are `eric`'s lane:

| Files | Owner | What changes |
|---|---|---|
| `web/src/game/key-skin/` | key-skin (eric-agent-1) | the key painters |
| `web/src/game/note-pills/` | note-pills (eric-agent-1) | pill geometry and brightness |
| `web/src/game/core/highway.ts` | core-loop, judging-tiers (eric) | the calls into the painters, draw order |
| `web/src/game/key-preview/` | key-preview (eric) | only if the preview glow must change to match the new keys |
| `web/src/game/hit-line/` | hit-line (eric-agent-1) | only if the line must change to sit on the new keys |

No other folder changes. Juice and hit-particles (`web/src/game/juice/`, `web/src/game/hit-particles/`) stay as they
are; open PR #761 is working in juice. Split only at a real seam if the PR passes about 1000 changed lines, and say why.

**Coordinate with the open duo-hud PRs.** #747 (`fix(core-loop)`, the hit line and judgment word, branch
`duo-hitline`, changes `highway.ts`) and #749 (`fix(note-pills)`, 2 px note corners, changes `note-pills/index.ts`)
are open and wait for Eric's go. The lane rule closes those files while they're open, and they set the look this pass
builds on (the Duo hit line, square-ish notes). So: check both before starting (`gh pr view 747 749`). If they've
merged, branch from origin/main. If not, build on them (stack on `duo-hitline` with #749 merged in, or rebase onto main
after they merge) and keep the PR a draft until both have merged or closed; then rebase on origin/main and mark it
ready. If Eric closes either, the look it carried (the 2 px corners, the purple-to-blue line) is still the visual
direction's, so keep it.

## Research first
Before any code, invoke both `frontend-design` and `design-taste-frontend`, then study:
- **Synthesia:** `specs/context/references/synthesia-brahms/` (frames and README) and
  `specs/context/reference-notes/synthesia-brahms.md`: the wide-bar look.
- **PianiCast** (the slim-bar look, and the reference hit-particles matched): the local video
  `video-references/플라워 댄스(Flower Dance) - DJ Okawari(캇파캇파 ver.) ｜ 피아노 커버 [rA_2B7Yj4QE].mp4` in the main
  checkout `/Users/ericzhang/code/hackathons/gator-ai-days-2026`, the path #750 used.
- **Nostalgia:** `specs/context/references/nostalgia-flower/` and `specs/context/reference-notes/nostalgia-flower.md`
  (the lit key strip under each held note, long-note ribbons).
- `specs/context/visual-direction.md` (Duo) and `specs/decisions/key-skin-look.md`, `note-pills-dimming.md`,
  `hit-line-look.md`, `hit-particles-*.md`.

Then write a short look brief in **`specs/decisions/key-polish-brief.md`** (what each reference does that we don't,
the directions taken and dropped, and why) and commit it before the first code commit. **Never commit reference video
or frames from it**, in the repo, the PR body or an issue: frames you extract stay in a scratch directory outside the
repo. The committed Synthesia and Nostalgia frames may be referred to by path.

## Requirements
- **The bar:** the keyboard and the notes are as finished as hit-particles' effects. That's the design pass's call
  (below), not a checklist.
- **Directions to explore, none required** (from #848; the worker picks and logs them in the brief):
  - *Keyboard:* key travel when pressed (the key dips, its shadow shortens, its front edge shows); materials (an ivory
    gradient, a fine highlight, shading where keys meet, a felt strip at the back, the keybed's shadow under the hit
    line); the pressed light as a gradient that pours in from the hit line, scaled by velocity, fading on release
    instead of cutting; a gloss reflection on black keys.
  - *Falling notes:* a gradient body with an inner highlight edge and a soft glow that grows near the line; a held note
    visibly feeding into its key (consumed at the line while the key glows); long notes that read as sustained; chords
    that read as one shape; velocity in brightness. Look at both Synthesia's wide bar and PianiCast's slim bar, and
    pick per the visual direction.
- **Sits with what's there:** with hit-particles' bloom and dust over the notes, and #747's hit line. Nothing doubles
  the bloom (no second glow at the contact point competing with it).
- **Readable first:** upcoming notes always legible, on Maple Leaf Rag's densest passage too; hue still says the hand,
  brightness still says time to hit; a previewed key never reads as pressed; a pressed key is never red.
- **The Duo kit** (`visual-direction.md`): blue right hand, purple left, white-hot flare. No synthwave sun or grid, no
  hype pink (`--pa-hype` is for moments, never notes, keys or the hit line). Colors from `ui-tokens` / `hand-colors`.
- **Geometry stays:** `Frame.keyX` gives the same numbers, and judging is untouched. No contract change: `Frame` is
  frozen, so velocity comes from what already reaches the draw code (`ChartNote.velocity`, or the press if it's there);
  if neither, drop that direction and log it.
- **Reduced motion** gets a calm version: no key travel animation or pulsing, fades become instant or short; the
  static look (materials, gradients) stays.
- **No new dependency.** Canvas 2D in the existing painters; nothing allocated per note per frame where a cached
  gradient or path will do.
- Log any choice this spec doesn't make in `specs/decisions/key-polish-*.md`.

## Design
AGENTS.md's "Visible changes" pass, with these settings:
- **Skills:** `frontend-design` and `design-taste-frontend`, invoked before the research (above).
- **Shots** from your own running dev server through the in-app browser (take a slot `devserver.1`–`.4` first, write
  your pid in it, stop it and remove the slot when idle): 1280×720 and 1920×1080, on **Maple Leaf Rag** (dense) and
  **Clair de Lune** (slow, long notes), plus **reduced motion**. A keyboard crop with both hands pressing, and a
  mid-song frame with hit-particles on.
- **Rounds:** score each round on taste v2's `references/critique.md` and fix the top three problems. **Up to 5
  rounds** (the planner's call on Eric's "concentrated pass"; he named no cap), **stopping early when a round's score
  doesn't improve on the last.** This overrides AGENTS.md's three-round default for this feature only.
- **The PR body's Design section:** the skills, each round's score, the fixes, and before/after shots (ours only).

## Validation
1. `pnpm -C web exec vitest run --passWithNoTests src/game/key-skin src/game/note-pills src/game/core
   src/game/key-preview src/game/hit-line`: new tests for any new draw math (key travel over time, the press fade, a
   pill's glow or gradient stops), and the existing ones (`keyX` across 88 keys, pill ratio and brightness ends) pass.
2. The existing highway and key browser checks (verify-key-preview, verify-labels, verify-ghost, `web/e2e/verify.mjs`) stay
   green. Per the interim load rule they're covered by main's scheduled full run, not run locally: the done note says
   "not verified locally; covered by main's scheduled full run".
3. The design pass above, with the Design section in the PR.
4. **Perf gate:** `node web/src/game/perf-budget/perf.mjs` (maple-leaf-rag, fever, 1920×1080), p95 frame work
   **≤ 6 ms**, before (origin/main) and after (the branch), numbers in the PR and the done note. Locally only under
   `verify.lock`, with a timeout on the run.
5. Eric looks at it once. The done note says `not seen by Eric` until he does; his look doesn't block the merge.
