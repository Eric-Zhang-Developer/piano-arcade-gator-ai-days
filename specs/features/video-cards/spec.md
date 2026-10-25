---
name: "Video cards: the title played onto the DGX letter by letter, and an end card with a true facts line"
depends_on: ["video-shots", "capture-mode", "duo-tokens", "hit-particles", "name-theme", "laptop-sound", "piano-out"]
owns: ["specs/features/video-cards/", "changes/video-cards.md", "specs/decisions/video-cards-", "web/src/game/video-shots/", "web/src/app/shots/"]
assignee: "eric"
---

# Video cards

Issue #1306. It's a hero-tier polish item (#856), because the cards are the video's opening and closing frames. It's a
normal game-lane change with the design pass, and it has no flag.

**Why a new spec, not a `fix(video-shots)` revision:**
- video-shots is done (`changes/video-shots.md`), and its spec is the shot list, the capture rules and a brief.
- This pass adds new behavior: a played motif, timing marks and a facts generator. Its Validation (frame strips,
  note-to-letter timing, a git count) doesn't belong in a shipped spec.
- AGENTS.md: "new behavior gets a spec".
- It owns `video-shots/` and `app/shots/` explicitly, which a done feature's owner allows. Its own done note gives
  the release follower one entry for the cards.

**Today (origin/main):**
- **The cards:** `/shots?card=title|end` (`web/src/app/shots/page.tsx` over `web/src/game/video-shots/Cards.tsx`,
  `index.ts`, `cards.module.css`). They're still from 1.5 s.
- **The motion:** `MOTION` in `index.ts` is the only timing: a hard cut in, one move, then dead still (decision
  `video-shots-brief`).
- **The title card:** `APP_NAME` and `TAGLINE`, quoted from the dialogue's Book I.
- **The end card:** the repo URL (`GITHUB_URL`), plus `LIVE_URL` from `NEXT_PUBLIC_LIVE_URL` when it's set at build.
  It's unset today, so the end card shows the repo alone.
- **Capture mode's flag** is set in `<head>` before the first paint.

**The model:** film title design (the pitch names Saul Bass and Kyle Cooper; any claim about them in the PR is cited
or left out): the title is the film's first idea, cut to music.

## The pass
1. **A played title:**
   - **the letters:** ÉTUDE's letters land one per note of a short motif, on the DGX (MIDI out, as piano-out
     schedules) or on the laptop voice (`laptopKey`) in capture;
   - **the motif:** "Étude" spelled by name-theme's cited 1909 French cipher (name-theme is done:
     `x/name-theme/cipher.ts` `FRENCH`, sources in `specs/decisions/name-theme-cipher.md`), through name-theme's own
     `fold` and the table.
     - From the decision file's table, E is mi, T is fa, U is sol and D is ré, so the five letters give E–F–G–D–E.
       The test computes it from `cipher.ts` rather than a hand-written list.
     - The register, rhythm and tempo are the worker's, logged.
     - No invented notes: the motif is exactly the cipher's.
     - If name-theme is pruned before this lands, the motif is a library chart's opening notes, cited by song.
   - **the accent:** the É's acute lands last, with a `hitParticles()` burst (`hit-particles/gl.ts`, imported, not
     copied). It has no note of its own. It lands on the motif's last note or the beat after; logged;
   - **the tagline** arrives on the next downbeat;
   - **the length:** 4 s or less in all, ending on a clean cut point (a still frame from a logged time).
2. **Typography:**
   - the Duo display face (`--pa-font-display`) at a cinematic size;
   - hand-tuned kerning for É-T and T-U, the values recorded in `specs/decisions/video-cards-kerning.md`;
   - it sits on the field's black;
   - if highway-field (#1122, open) lands first, its horizon goes behind the title, with a one-line switch;
     `highway-field/` is read only.
3. **The end card's hierarchy:**
   - Étude, then the tagline;
   - **the live URL:** an x-height of 24 px or more at 1920×1080, and a contrast of 7:1 or more against the card. If
     `NEXT_PUBLIC_LIVE_URL` is still unset, the repo URL takes that slot at that size; logged;
   - the repo URL, smaller;
   - **the facts line, literally true:**
     - "N pull requests merged" and a real date range;
     - counted by the same git rule as build-sonata's `make-sonata.mjs`: the first-parent log, a commit counted when
       its subject ends in a PR number, author fields never read;
     - a small generator in `video-shots/` writes `facts.json` (N, the first and last merge dates in ET), and is
       re-run at the freeze like build-sonata's snapshot;
     - **never "by agents":** git can count merged PRs but can't tell who or what wrote them, and the night includes
       human PRs (Sharan's, abbasi2010's, seeko-codes'). A count of agent PRs only ships if the worker finds a
       verifiable per-PR marker (for example a worker-name line in each PR body, which AGENTS.md's loop asks for),
       counts only those, and says how on the PR;
     - if N can't be computed, the line is left out;
   - **the hold** is 4 s or more;
   - **a Build Sonata sound bed** under the end card is optional. It's flagged to Eric on the morning page, not
     decided here.
4. **Capture:** both cards are clean from the first frame under capture mode, at 1920×1080 and 1280×720.
5. **Reduced motion:** both cards are stills, and the title's motif still plays.

**Files and holders** (no open PR touched any of them when this spec was written; re-check):
- `web/src/game/video-shots/` (`Cards.tsx`, `index.ts`, `cards.module.css`, `verify-shots.mjs`,
  `video-shots.test.ts`) and `web/src/app/shots/page.tsx`: video-shots' (done), owned here;
- read only:
  - `web/src/game/capture-mode/` and `web/src/app/layout.tsx` (capture-mode);
  - `web/src/game/hit-particles/`;
  - `web/src/game/x/name-theme/`;
  - `web/src/game/duo-tokens/`;
- `web/src/game/highway-field/`: #1122 (draft), read only.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked, each round's score with the kerning values, the fixes, and the
  before and after strips.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Frame strips** of the title at 0, 0.5, 1, 2, 3 and 4 s, plus the end card, before and after, at 1920×1080 and
1280×720, plus reduced motion, under capture mode. They go in `specs/features/video-cards/shots/`.

**(b) Taste v2:** the score for each round in the PR, up to 5, with the kerning values.

**(c) Measured:**
- **each letter lands within 1 frame of its note:**
  - in the in-app browser, a `performance.mark` per letter's first painted frame against the note's scheduled time
    on the clock that plays it: the `MIDIOutput.send` timestamp for the DGX, or the AudioContext time mapped to
    `performance.now()` for the laptop voice;
  - 3 runs, each letter, both outputs where a DGX is attached (the sim otherwise, said so).
- **the URL's x-height and contrast:**
  - x-height from canvas `measureText("x")` in the URL's computed font and size at 1920×1080, 24 px or more;
  - contrast from its computed color against the card's, 7:1 or more;
  - a unit test pins the token pair's contrast.
- **the facts:** N and the dates equal the generator's count on a fixture log (a unit test with a few commits, some
  without a PR number, and a non-first-parent commit).

Unit tests (`pnpm -C web exec vitest run src/game/video-shots src/game/capture-mode src/game/x/name-theme`):
- the motif equals the cipher's spelling of "Étude";
- the title's timing table ends by 4 s;
- reduced motion gives stills with the motif's schedule unchanged;
- video-shots' existing tests stay green, or change with the reason given.

**(d) WebMs with sound** of both cards, for Eric's review page, ranked mid. They stay local if they hold anything but
our own work. `verify-shots.mjs`: not verified locally; covered by main's scheduled full run.

**Eric:** `localhost:3001/shots?card=title` and `?card=end`, each with `&capture=1`. The done note says `not seen by
Eric` until he does.

## Gaps (accepted)
- The end card's live URL waits on `NEXT_PUBLIC_LIVE_URL` being set at build.
- The facts line is a snapshot until it's re-run at the freeze.

## Defaults
- **In `extras`,** at the end, after harmony-map.
- Log any choice this spec doesn't make in `specs/decisions/video-cards-*.md`: the motif's rhythm and register, the
  accent's beat, the cut point, the sizes, the kerning, and the facts line's wording and range format.
- The smaller option; no new dependency.
