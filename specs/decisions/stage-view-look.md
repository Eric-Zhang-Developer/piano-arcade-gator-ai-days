# stage-view: the effects and the look, measured and chosen

**Context:** sizes and times are from `specs/context/nostalgia-stage-findings.md` (`stageFx` in
`web/src/game/stage-view/draw.ts`). Where the findings stop, these choices hold.

**Measured, used as is:**
- **Hits:** the pillar's size and 250 ms fade; the starburst's ring growth, spike span and 150/330 ms timing; the
  judgment text's height, its y and its 415 ms.
- **Combo:** its place and size; the milestone ghost's 1.65× swell over 500 ms.
- **Full combo:** the wash's band, its 250 ms peak and 1.0 s length; the banner's place, width and its
  in/hold/out times.

**Choices:**

| choice | options | taken | how to undo |
|---|---|---|---|
| Colors | The reference's warm cream, pink and gold, or the Duo kit's. | The Duo kit (`ui-tokens`): hands `handR`/`handL`, judgments as the HUD colours them (PERFECT gold, GREAT blue, GOOD light blue, MISS grey), the bar and glows in primary blue. `/stage` sits beside `/play`, so it shares the look. | Swap the tokens in `draw.ts`. |
| Tier names | The reference shows only "JUST"; how its tiers differ wasn't found. | Our judge's names: PERFECT, GREAT, GOOD and MISS. A MISS gets its name and no pillar or burst. | Edit `hits()`. |
| The crest | The reference's crest reads from its backdrop art. | A primary-blue light behind the crest and a lit horizon along it, so the hill reads in a still frame. | Remove that block in `hill()`. |
| The pillar | The reference's three-color tint. | The judgment's color plus a white core a third as wide, so it reads as light from across a room. | Edit `hits()`. |
| Milestones | The reference ghosts every 100. | The ghost plays on the judge's own `comboMilestone` (25, 50, then every 100), so `/stage` agrees with `/play`. | Filter in `combo()`. |
| End without a full combo | The reference shows only a full combo. | The take ends quietly: the field dims and the full-screen button comes back. | Add a branch in `drawStage`. |
| The field at the end | The reference's field fades out about 1.7 s after the last hit. | The combo hides when the banner starts writing in. | Edit `combo()`. |
| Full screen | A key, a button, or both (the spec takes either). | The button alone, shown between takes. A key needs a line on help-overlay's card (its drift test), and #965 has `keys.ts` open. | Add the key and its line in a `fix(help-overlay)` PR once #965 lands. Without a mouse meanwhile: Tab to the button and press Enter, or use the browser's own full screen (F11; Ctrl+Cmd+F in Chrome and Safari on a Mac). |
| Audio | The reference has no detectable milestone sound, and a jingle at a full combo. | `/stage` is silent: `/play`'s sound is what the room hears. | A follow-up spec. |
