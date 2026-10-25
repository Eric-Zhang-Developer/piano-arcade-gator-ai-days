---
name: "Speak polish: /speak lets go of the mic on leaving, reads at 12 px, and announces its notes"
depends_on: ["speaking-piano", "experiments", "duo-tokens"]
owns: ["specs/features/speak-polish/", "changes/speak-polish.md", "specs/decisions/speak-polish-"]
assignee: "eric"
---

# Speak polish

Issues #1201, #1202 and #1203, from a sweep of the experiments merged tonight. /speak, the piano that speaks a phrase,
can keep the mic open and play on the DGX after the page is left, sets some type under the kit's floor, and doesn't
announce its notes. One PR, since they're one thing a person sees: the /speak page. It's a normal game-lane change
with the design pass, and it has no flag.

## The changes
1. **Leaving mid-hold (#1201),** in `Speak.tsx`: unmount clears the mic timer (`:238`), stops the mic's tracks and
   closes its AudioContext, and plays nothing. Today the cleanup (`:178`) only stops the player, so after a client
   navigation the timer still fires `micUp()` (`:244-266`), which plays the take on the DGX.
2. **Type under 12 px (#1202),** at the page's base size (`speak.module.css:11`, 16 px at 1280):
   - the stand's mono labels (`LABEL`, `Speak.tsx:44`, `0.7em`);
   - the caps' `dt` (`speak.module.css:137-138`, `0.72em`);
   - the canvas's octave names (`Speak.tsx:111`, a 9 px floor).
   Each resolves to 12 px or more at 1280×720, the kit's floor (`duo-tokens/Kit.tsx:107`).
3. **Notes and the way back (#1203):**
   - the stand's note (`:325`: no piano output, no mic, hold longer) sits in a polite status region, or `role="alert"`
     for the two errors;
   - the way back (`:275-277`, `<a href="/lab">← Lab</a>`) is a `next/link` `Link` reading "Back to the Lab", as on
     /sonata (`build-sonata/SonataPage.tsx:123-125`) and /composers-hands.

## Files
Edits to other features' files come through the lane rule (AGENTS.md, "Ownership is open within a lane"). Check
again before each edit (`gh pr list --state open`, then each PR's files). When this spec was written, no open PR held
any of these:

| File | Owning feature |
|---|---|
| `web/src/game/x/speaking-piano/Speak.tsx`, `speak.module.css`, `speaking-piano.test.ts` | speaking-piano |

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`), before and
  after, at 1280×720 and 1920×1080: /speak at rest (a preset's voiceprint) and the "No piano output" note. The mic
  needs a person: shoot the states the page reaches without one, and say so.
- Score each round against `references/critique.md` and fix the top three problems; at most three rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and before and after shots.

## Validation
The test setup has no DOM library and `web/package.json` is frozen: render with `renderToStaticMarkup` and keep the
mic's teardown in a small function a test can drive with fake timers and a stubbed mic.

- **(a) #1201:** a test opens a stubbed mic, tears down mid-hold, advances the timers past 3 s, and finds the tracks
  stopped and no playback started.
- **(b) #1202:** a grep of `speak.module.css` and `Speak.tsx` finds no size that resolves under 12 px at 1280×720,
  including the canvas floor. Report the grep.
- **(c) #1203:**
  - a `renderToStaticMarkup` test finds the note inside a status region (or `role="alert"`);
  - the markup has a link to `/lab` reading "Back to the Lab".
- **Unit tests:** `pnpm -C web exec vitest run src/game/x/speaking-piano`.
- **(d) Shots and taste v2 scores** in the PR (Design pass above).
- Browser checks run in CI's suite; the done note says "not verified locally; covered by main's scheduled full run".

## Defaults
- In `extras`. Log anything this spec doesn't settle in `specs/decisions/speak-polish-*.md`.
- No new dependency and no new token. The analysis, the presets and the playback stay as they are.
