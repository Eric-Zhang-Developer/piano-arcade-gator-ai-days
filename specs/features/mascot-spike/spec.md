---
name: "Mascot spike: one consistent gator for the Duo look, in stop-motion poses, staged for Eric's pick"
depends_on: []
owns: ["specs/features/mascot-spike/", "changes/mascot-spike.md", "spikes/mascot/", "specs/decisions/mascot-spike-"]
assignee: "eric"
---

# One gator (spike)

Issue #903. Eric, 2026-10-25, on today's two gators: "rn this gator looks like incredibly ass both of them are
incredibly chopped". On a new one in four play-screen spots: "I like those 4 alright lets do a spike" (relayed by
eric-asking-agent-1). This is a tech spike under decision 004. It reads from the game and edits nothing. Eric's part
is one pick on a local page.

Today's gators are `web/public/learning/companion-gator.svg`, a cartoon on duo-select's "Next for you" row, and
`web/public/learning/mentor-gator.png`, a painted one on duo-results' tutor panel. Both belong to the learning lane,
and both stay as they are in this spike.

## The question
Can Codex image generation (the `codex` CLI on this machine) give one gator that stays the same character across six
poses, in the Duo look, and that animates as stop motion from 2–3 frames per pose?
- **Yes:** at least one sheet candidate has a full pose set (6 poses, 2–3 frames each) that passes the code checks
  below and that the worker, viewing it side by side on the pick page, judges to be the same character: same head
  shape, eyes, snout, proportions and bow tie. Eric's pick confirms it.
- **No:** no sheet candidate has a pose set that passes the code checks, or the character drifts between poses (face,
  proportions or outfit change) after two rounds of prompt fixes.
- **Time box:** about 3 hours of agent time, and at most 120 generated images in all. Then FINDINGS.md, whatever the
  state. If Eric hasn't picked yet, it says "pick pending".

The thresholds below are the planner's, not measured ones.

## The direction (Eric approved it)
- **Inspiration:** CHUNITHM's avatar penguin, kept restrained. The gator is a calm, slightly dapper piano teacher. It
  encourages and never hypes.
- **Style:**
  - Flat vector with a monoline ink outline.
  - 3–4 flat colors: a muted green, a cream belly, ink, and one Duo blue accent (a small bow tie). The blue is
    `--pa-primary`, `#2b9bff` (`web/src/game/duo-tokens/`).
  - No gradients, no shine.
  - Transparent background.
  - The same framing in every pose: about two-thirds of the body, three-quarter view, same scale.
- **It must not look like UF's Albert:** no orange-and-blue Gators look, no jersey, no UF marks.
- **Poses:**
  - idle;
  - pointing ("this way");
  - happy;
  - oops (a wince, then a shrug, never mocking);
  - thinking;
  - celebrating at a tiny piano.

  Each has 2–3 frames, plus one blink frame for idle.

## Method
1. **Character sheet first.** Generate front, three-quarter and side views, as at least 6 sheet candidates. Vary the
   prompt within the direction, not outside it.
2. **Poses from a sheet.** The worker picks its top 2 sheets and logs the choice as its own. For each, generate every
   pose with the sheet as the reference image, with the palette, outline weight and framing fixed in the prompt. Make
   at least 3 candidates per pose, so Eric picks instead of reviewing. If Eric picks a sheet outside the top 2, its
   pose sets come next.
3. **Clean-up by code, not by hand.** Normalize to one canvas size and anchor point, then pack each pose's frames into
   a horizontal sprite sheet. Hand-drawn fixes would hide the answer.
4. **The prompt recipe** goes into `spikes/mascot/prompts.md`: each prompt as sent, the reference image used, and the
   candidate files it produced.

## Code checks (`spikes/mascot/check.mjs`)
Each frame:
- **Background:** the corner pixels are fully transparent.
- **Colors:** after dropping anti-aliasing (pixels under 2% of the opaque area), at most 5 distinct colors, each
  within ΔE 10 of the palette.
- **Framing:** across a pose set, the opaque bounding box's height stays within ±8% of the set's median, and its
  bottom edge within ±4% of the canvas height.

The checker prints one line per frame and a pass count per set. FINDINGS.md quotes those lines.

## The pick page (`spikes/mascot/pick.html`)
A static page, opened from disk (`file://`), that reads images from `spikes/mascot/out/` by relative path. It has
no server and no build.
- **The sheets:** every sheet candidate side by side, with its file name.
- **The pose sets:**
  - each pose plays as stop motion, by CSS `steps()` on its sprite sheet, each frame held about 200 ms;
  - idle blinks about every 4 s;
  - under `prefers-reduced-motion: reduce`, each pose shows frame 1, still;
  - each set's check result shows beside it.
- **Context:** the gator at real size on a mock of the duo-select row and the pause card, made from a screenshot of
  each. This page is a look, not the game.
- **Eric's pick:** he says it in chat, or edits one line in `spikes/mascot/PICK.md` (`sheet: <file>`). The page
  saves nothing.

## Content
Per decision 004, generated images are outputs.
- They stay in `spikes/mascot/out/`, ignored by its own `.gitignore` (`*`, `!.gitignore`).
- The scripts, `check.mjs`, `pick.html`, `prompts.md` and FINDINGS.md are committed.
- Promotion commits the chosen frames under a game-lane path, such as `web/public/mascot/`.

## Plan
1. Draft PR `feat(mascot-spike): gator character sheet and pose candidates`, with `Closes #903`.
2. Generate the sheet candidates, then commit `prompts.md` as it grows.
3. Write `check.mjs` and `pick.html`, then generate the pose sets for the top 2 sheets.
4. Write `spikes/mascot/FINDINGS.md`, then `changes/mascot-spike.md` last. Tell the planner the pick page's path, so it
   goes on Eric's morning page.

## Validation
1. `node spikes/mascot/check.mjs spikes/mascot/out` exits 0 and prints a pass count for every pose set. Its own
   self-test runs against two synthetic PNGs that the script writes: a passing frame, and a failing frame with an
   opaque corner and a sixth color.
2. `pick.html`, opened from disk at 1280×720, shows every sheet candidate and every pose set, plays the frames, and
   logs no console error. Take one screenshot for the PR, plus one with reduced motion.
3. **Eric (about 2 minutes, the question):** he picks a sheet, or says none.

## FINDINGS.md (`spikes/mascot/FINDINGS.md`)
Per decision 004, it covers:
- the question, and the measured answer (the check lines, and how many images it took);
- whether consistency held across poses, with the worst drift named;
- the prompt recipe that worked;
- what to keep;
- **promote**, **iterate** or **kill**.

With no pick yet: "pick pending", the candidates and check results, and the worker's recommended sheet.

## Promotion (a later spec, not this one)
- Wire the chosen poses into the four play-screen spots Eric approved:
  1. beside the highway during the 4-beat count-in, gone at the first note;
  2. a one-second happy pop in the HUD band at combo 50, combo 100 and a full combo, never in the lanes;
  3. the pause card, in the thinking pose;
  4. beside Flow's "Take your time".
- Wire them into its homes off the play screen: the select's "Next for you", the results tutor, first run and the
  help card.
- At most one gator per screen, and never in the note lanes.
- That spec swaps only duo-select's and duo-results' gator images, and gets the design pass.
- After Eric's pick, file a `needs-human` issue for the learning lane that offers the gator to /learn
  (TheoryWorkspace, GraphCompanion, GuidedEntry, BrandPreview). /learn's own images are its call.

## Gaps (accepted)
- Generated frames, not hand-drawn ones. If the result is "close but off", the answer is iterate, not touch-ups.
- No game code, no wiring, no sound.
- Consistency is checked by code for palette, background and framing only. Likeness is the worker's eye, and then
  Eric's.

## Defaults
- The smaller option. Log choices the spec doesn't make in `specs/decisions/mascot-spike-*.md`.
- If `codex` can't generate images here (no image tool, or no access), say so in FINDINGS.md with the command and its
  output, recommend **kill** or another generator for Eric to name, and stop. Don't switch generators on your own.
- Never send Eric's email or any key in a prompt, header or URL.
