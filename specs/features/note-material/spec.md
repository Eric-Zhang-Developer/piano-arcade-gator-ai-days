---
name: "Note material: the falling notes get an emissive core, a specular edge, beat-locked long notes and near-line bloom"
depends_on: ["core-loop", "note-pills", "key-polish", "hand-colors", "ui-tokens", "bar-lines", "perf-budget"]
owns: ["specs/features/note-material/", "changes/note-material.md", "specs/decisions/note-material-", "web/src/game/note-material/"]
assignee: "eric"
---

# Note material

Issue #1174. It's a hero-tier polish item (#856): one deep pass on the falling notes' material. It's a normal
game-lane change with the design pass, and it has no flag.

**Today (origin/main):**
- **The pill:** a pill sized to its key (`note-pills/index.ts` `pillRect`), 2 px rounded (`radiusPx`, #749 is
  tuning the corners). Black-key notes are 56% of a white note's width (`blackToWhite`).
- **Brightness:** 35% at the top of the lookahead, rising straight to 100% at the line (`brightness`,
  `farBrightness`), by alpha over a black underlay.
- **The finish** (`core/highway.ts` around 215–290, `notePolish`):
  - a hand-color body with a white lift toward the leading end (`lift` 0.18);
  - a 2 px glass rim (`rim`, 30% white, the clip keeping the inner half);
  - a white-hot head;
  - a glow from 400 ms out (`glowMs`, `glowPx` 18);
  - held notes feeding into the key, at `heldGlow` 0.35.
- **Earlier passes:** note-pills, pill-match and #749.

## The pass
1. **The material stack,** per pill:
   - **an emissive core** in the hand color, read from ui-tokens and hand-colors at draw time (`handColor`), so it
     follows whichever palette Eric picks in hand-palette (#1163);
   - **a specular top edge,** 1 device pixel (`1 / devicePixelRatio` CSS px), at about 30% white;
   - **a soft inner falloff** at the trailing end;
   - **emission** ramps over the last ~300 ms before the line, on the game clock (`nowMs`). The 35% → 100%
     approach brightness stays; the ramp is the emission on top. The worker logs how it meets `glowMs`.
2. **Long notes:**
   - a 2–3% luminance energy texture scrolls along the body, locked to the beat (`msPerBeat` from the chart clock);
   - **while held,** a bright burn line sits at the hit line, handing off to key-polish's feed (`heldGlow`, the key's
     light), so it reads as one light;
   - **the hit line itself is untouched** (#747 is restyling it).
3. **Chords:** a faint shared hairline joins the leading ends of notes that start together. It passes bar-lines'
   calm rule (no brighter than the dimmest note). If it clutters in a look round, cut it, and say so in the PR.
4. **Black-key notes:** a slightly deeper body, with the same rim and edge.
5. **Bloom:** pre-blurred glow sprites, cached per pill size (an offscreen canvas per width × height bucket), drawn
   only near the line. No full-screen blur, and no `shadowBlur` per note per frame.
6. **Level of detail:** on dense passages (notes on screen past a threshold, logged), the texture and then the bloom
   step down.
7. **Reduced motion:** no scrolling texture and no emission ramp. The material is still drawn.

**With highway-field (#1122):** notes stay the brightest thing in the field. highway-field's calm rule holds the field
under the dimmest note. This pass keeps the dimmest note at 3:1 or more against the field (Validation c).

## How it's built
- **The module:** `web/src/game/note-material/` has:
  - pure functions for each layer's colors, alphas and the emission ramp;
  - the sprite cache;
  - `drawNote(ctx, L, pill, state, nowMs, cache)`, which draws one note's material.
- **No plugin route reaches the notes.** They're drawn on the highway canvas inside `drawHighway`'s loop, and the
  overlay that plugins paint sits above everything. So the module is wired in with **one call swap in `highway.ts`**:
  the body, lift, rim and head drawing becomes one `drawNote(...)` call, once the file frees.
- **Held files (re-check each before any edit):**

  | File | Held by | What waits |
  |---|---|---|
  | `web/src/game/core/highway.ts` | #747 (`fix(core-loop)`, the hit line and judgment word in the Duo look) and #600 (abbasi2010, read as stale) | the `drawNote` call swap |
  | `web/src/game/note-pills/index.ts` | #749 (`fix(note-pills)`, 2 px corners) | nothing: `pillRect` and `brightness` are imported, never edited |
  | `web/src/game/highway-field/` | #1122 (open) | nothing: read only, for its calm rule if it has landed |

  miss-moment's and highway-field's own one-line swaps also wait on `highway.ts`. Rebase on whichever lands first.
- **Until #747 merges:**
  - build and test the module;
  - do the look loop on a local branch stacked on #747's head, and don't push that stack;
  - keep the PR a draft;
  - if #747 is still open when the rest is done, tell the planner instead of waiting.

## Design pass (AGENTS.md, Visible changes; hero tier)
- Invoke `frontend-design` before writing the UI, and `design-taste-frontend` (taste v2) for the look loop.
- Take shots from your own dev server in the in-app browser, with one dev-server slot (`devserver.1` to `.4`).
- Score each round against `references/critique.md` and fix the top three problems. A hero item gets up to 5 rounds.
- The PR's Design section has the skills invoked, each round's score, the fixes, and the before and after shots.

## Validation
The bars are the planner's, not measured thresholds.

**(a) Shots:** before and after at 1280×720 and 1920×1080, with `bot=perfect`, in `specs/features/note-material/shots/`:
- fur-elise;
- maple-leaf-rag (dense);
- moonlight-1 (held notes);
- 400% crops of a single pill: a white-key note, a black-key note, a held long note at the line;
- the same set under reduced motion.

**(b) Taste v2:** the score for each round in the PR, up to 5.

**(c) Measured:**
- **Contrast, as a test** (`pnpm -C web exec vitest run --passWithNoTests src/game/note-material src/game/note-pills`):
  - a pill at its dimmest (`farBrightness`, before emission) is 3:1 or more against the field (WCAG 1.4.11);
  - checked for today's hand tokens and for each hand-palette candidate (`x/hand-palette/candidates.ts`), against
    `bg` and, if highway-field has landed, its brightest field pixel.

  Also tested:
  - the emission ramp: it starts about 300 ms out, and is absent under reduced motion;
  - the texture's phase is locked to the beat;
  - the specular edge is 1 device pixel at dpr 1 and 2;
  - the chord hairline passes the calm rule;
  - the sprite cache is built once per size bucket, not per frame (a counter);
  - LOD steps down past the threshold;
  - note-pills' tests stay green.
- **Perf:** maple-leaf-rag at 1920×1080 with `bot=fever`, measured on your dev server through the in-app browser
  with perf-budget's `probe.js` (`__perfProbe.report()`), 3 runs before (origin/main) and after. Report p95 and
  spread. The bar is no regression past the before runs' spread and p95 ≤ 6 ms. `perf.mjs` itself runs locally only
  under `verify.lock`; otherwise "not run locally; main's scheduled run covers it".
- **A 5-second read test:**
  - three after frames, one each from fur-elise, maple-leaf-rag and moonlight-1, at chart times where chords and long
    notes are on screen;
  - the truth (how many chords, how many long notes) is computed from the chart at that time and written down first;
  - a fresh subagent sees each frame alone, told to look for 5 seconds, and says how many chords and how many long
    notes it sees;
  - an answer is right when both counts are within ±1 of the truth;
  - **pass:** 3 of 3. Never show the subagent the truth or the spec. The before frames get the same test, with fresh
    subagents, and both scores go in the PR.

**Eric** (the morning page): `localhost:3001/play?song=moonlight-1&bot=perfect`, `&song=maple-leaf-rag` and
`&song=fur-elise`. The done note says `not seen by Eric` until he does.

## Gaps (accepted)
- The material ships only once #747 frees `highway.ts`. Until then it's a tested module.
- Bloom is sprites near the line, not a real glow pass.

## Defaults
- **In `extras`,** after pinned.
- Log any choice this spec doesn't make in `specs/decisions/note-material-*.md`: the falloff, the texture's
  amplitude and scale, the burn line, the black-key depth, the sprite buckets and the LOD threshold.
- The smaller option; no new dependency.
