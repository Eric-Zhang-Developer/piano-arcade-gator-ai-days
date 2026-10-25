---
name: "Lab gallery: the On trial experiments as an exhibition with posters, and Eric's verdict sheet"
depends_on: ["experiments", "lab", "lab-pages-a11y", "capture-mode", "duo-tokens"]
owns: ["specs/features/lab-gallery/", "changes/lab-gallery.md", "specs/decisions/lab-gallery-", "web/src/game/x/Gallery.tsx", "web/src/game/x/gallery", "web/public/lab/"]
assignee: "eric"
---

# Lab gallery

Issue #1249. It's a polish item (#856): one pass on the Lab's "On trial" gallery. The gallery is where Eric gives his
verdicts, so it's his review bottleneck, and it's a demo beat too ("the agents built these last night"). It's a
normal game-lane change with the design pass, and it has no flag.

**Today (origin/main):**
- **The gallery:** `web/src/game/x/Gallery.tsx` (~50 lines, `gallery.module.css`) renders a grid of text links, one
  per registry entry, under group headings in first-seen order (`groupsOf`). Each link has the title, the line and
  `#issue · x=<name> →`.
- **The mount:** `game/lab/Lab.tsx:61`, under `id="on-trial"`.
- **The registry:** 14 entries when this spec was written (`web/src/game/x/index.ts`), sample included.
- **The tests** in `x/x.test.tsx` pin that the gallery renders every href, and nothing for an empty registry.

**The prune rule this feeds** (the experiments spec, `specs/features/experiments/spec.md`, item 7, "Pruning after
Eric's verdict"):
- delete the folder and its registry line;
- log the verdict (kept, cut, or kept with changes) in `specs/decisions/experiments-log.md`;
- a kept one gets a real spec before it leaves the Lab;
- nothing is deleted before Eric's verdict.

This feature never deletes or prunes anything. It only collects the verdicts and hands them over.

## The pass
1. **Optional registry fields** on `Experiment` (`x/index.ts`):
   - `kind`: `"wow" | "polish" | "spike"`;
   - `needs`: `("dgx" | "camera" | "mic")[]`, with an empty list meaning none;
   - `poster`: a path under `/lab/`;
   - `preview`: a clip path under `/lab/`, or absent.

   An entry without them renders as today, as a text card. The values for each entry come from its own spec and code
   (its issue's labels for `kind`; for `needs`, whether the code asks for MIDI, `getUserMedia` video or audio). None
   is guessed, and each is logged.
2. **Posters first, clips second:**
   - **Required:** one poster still per experiment, WebP or PNG at 60 KB or less, in `web/public/lab/<name>.webp`.
     - It's captured from the experiment's own `href` with `?capture=1` (capture mode), in the in-app browser on the
       worker's dev server.
     - Where hardware is needed, the bot, a demo take or the sim stands in.
     - Encoding uses what's already here (the browser's `canvas.toBlob("image/webp")`, or `sips`). No download.
   - **A stretch:** clips of about 3 s, muted and looping WebM, 640 px wide, 300 KB or less each, 5 MB or less in all
     committed media.
     - A clip plays on hover or focus, one at a time (a new one pauses the last).
     - Below the fold it loads lazily: `preload="none"` until it's near the viewport.
     - Under reduced motion, only the poster shows.
     - If clean clips can't be captured for every entry, ship the posters, and the Gaps say which entries lack a clip.
3. **The label card,** in the Duo kit (zero radius, hairlines):
   - the poster;
   - the title in the kit's display type (`--pa-font-display`);
   - the one line;
   - `kind` and `needs` chips (`kitChip`);
   - the issue number.

   The card's link is still the experiment's `href`.
4. **The verdict sheet:**
   - **Per card:** Keep, Cut, or Keep with a note (a short text field).
   - **Storage:** localStorage only, one key, logged. It never writes files, the database or a request. Reads and
     writes are wrapped, so the page works without storage.
   - **Stamps** show on the cards: KEPT, CUT, or KEPT* with the note.
   - **"Copy verdicts"** puts one plain text block on the clipboard (`navigator.clipboard.writeText`, with a
     select-the-text fallback):
     - a header line with the date;
     - one line per experiment with a verdict, in registry order: `<name> (#<issue>): keep | cut | keep — <note>`;
     - experiments without a verdict listed last as `no verdict`.
   - **Eric pastes the block to the planner,** who prunes through PRs under the rule above.
5. **The order:** the groups stay in first-seen order. Within a group, entries needing nothing come first, then the
   rest, stable otherwise.
6. **Accessibility:**
   - clips and posters are `aria-hidden` (the card's text is its name);
   - verdict buttons are real buttons, keyboard-operable, with `aria-pressed`;
   - the note field has a label;
   - "Copy verdicts" announces success through the existing polite pattern (lab-pages-a11y, done in #1188).

## How it's built
- **Files and holders** (re-check each before any edit; "free" means no open PR touched it when this spec was written):

  | File | Owner (done) | Holder | This pass |
  |---|---|---|---|
  | `web/src/game/x/Gallery.tsx`, `gallery.module.css` | experiments | free (lab-pages-a11y merged in #1188) | the cards, the order, the verdicts; owned here |
  | `web/src/game/x/gallery/` (new) | this feature | | verdict store, copy text, clip player |
  | `web/src/game/x/index.ts` | experiments | free | the optional fields on `Experiment` only |
  | `web/src/game/x/<name>/index.ts(x)`, each | that experiment's feature | re-check per folder | the four fields on that entry, one line or so each |
  | `web/src/game/x/x.test.tsx` | experiments | free | its gallery tests stay green; new ones go in `x/gallery/` |
  | `web/src/game/lab/Lab.tsx` | lab | free | nothing |
  | `web/public/lab/` (new) | this feature | | posters and clips |

- **`x/index.ts` isn't frozen:** `.agents/config.toml` freezes only `web/src/contracts/`, the root files,
  `web/package.json` and the lockfile.
- **The lane:** every row is the eric lane. A folder held by an open PR keeps its entry without the fields, and it
  renders as a text card until a follow-up; logged.
- **Other appenders:** polish bundle 3 may be appending to `extras` at the same time, so whichever plan PR goes second
  rebases.

## Design pass (AGENTS.md, Visible changes)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot.
- Score against `references/critique.md`, at most three rounds, and fix the top three problems each round.
- The PR's Design section has the skills invoked, the scores, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots**, before and after, at 1280×720 and 1920×1080, in `specs/features/lab-gallery/shots/`:
- the full gallery;
- a hovered card;
- the verdict sheet partly filled;
- the same set under reduced motion.

**(b) Taste v2:** the score for each round in the PR, up to 3.

**(c) Measured:**
- **Media weight,** in a unit test that reads `web/public/lab/`:
  - each poster is 60 KB or less;
  - if clips ship, each is 300 KB or less, and everything in the folder totals 5 MB or less.
- **One clip at a time:** a unit test of the player; and in the in-app browser, hovering two cards in turn leaves one
  `video` playing.
- **First load at 1920×1080** fetches no below-the-fold clip, from the in-app browser's network log.
- **"Copy verdicts"** matches a fixture text exactly (unit test), including the note, the order and `no verdict`.
- **Unit tests also cover:**
  - an entry without the new fields renders as today, so `x.test.tsx` stays green;
  - needs-none comes first within a group;
  - storage that throws still renders;
  - nothing in the verdict path calls `fetch`.

  Command: `pnpm -C web exec vitest run src/game/x`.

**(d) A 5-second scan test:**
- the truth (the experiments whose `needs` includes `dgx`) is written down first from the registry;
- three fresh subagents each see the after shot of the full gallery at 1920 alone, told to look for 5 seconds, and
  name which experiments need the DGX;
- **pass:** 3 of 3, each naming exactly the truth set. Never show them the truth or the spec.

**Eric** (the morning page, **ranked high**, since his keep or cut pass here makes the rest of his review fast): at
`localhost:3001/lab` → On trial, a verdict on each card, then Copy verdicts pasted to the planner. The done note says
`not seen by Eric` until he does.

Browser checks: not verified locally; covered by main's scheduled full run.

## Gaps (accepted)
- Verdicts live in one browser's localStorage. Copy verdicts is the hand-off; nothing syncs.
- Posters are stills taken at one moment. A clip, where one ships, is the only motion.

## Defaults
- **In `extras`,** at the end, after inside.
- Log any choice this spec doesn't make in `specs/decisions/lab-gallery-*.md`: each entry's `kind` and `needs` with its
  evidence, the capture moment per poster, the storage key, the copy format's date line and the clip trigger.
- The smaller option; no new dependency.
