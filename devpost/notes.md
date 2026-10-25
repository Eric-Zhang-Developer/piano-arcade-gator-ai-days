# Devpost notes (local, not for the page)

What sits behind [submission.md](submission.md): the coach's scores, the tagline candidates, the prize and challenge
recommendations, every fact's source, the assets, and the two asks. Local only: not committed.

## The two asks

### To Eric (one word each)

1. **Tagline:** #1 below ("Lost at the piano? …")? Yes, or the number you want.
2. **Challenge (#10):** Andres writes it (your call; the Opus 5.5 draft is dropped). Nothing to answer here.
3. (dropped: was the Opus 5.5 build question)
4. **Prizes:** main awards + Vobile? Yes / no. (Best Open Source: not entering, no license; Eric, 2026-10-25.)
5. **Team:** Andres's and Sharan's full names, and is everyone registered on Devpost? Names, yes / no.
6. **Video link** (3 minutes at most). Your form screenshot already has a YouTube link in that field: is it the final video? Yes / no.
7. **Live URL:** the repo's homepage is `web-kohl-three-51.vercel.app`, serving an old build (`bb95f63`, not main;
   #1096), with no Anthropic key (#1095). Redeploy and list it? Yes / no.
8. **Thumbnail:** use the ready 3:2 highway frame, or record a frame or GIF at the piano with `?capture=1`? Ready / record.

### To Andres (seeko-codes)

> Is the Impact section ("The problem" and "What Étude does") and every sentence about `/learn` in devpost/submission.md
> true and fair to your half? Strike or fix anything that isn't.

Send him [for-andres.md](for-andres.md): his five passages, quoted exactly, each with what it rests on.

## Tagline candidates

The form allows 200 characters (from Eric's screenshot of the live form: "199 characters left" after one letter).
The project name allows 60, Built with 25 tags. All five fit easily.

| # | Tagline | Chars |
|---|---|---|
| 1 (picked) | Lost at the piano? Étude hears every note you play and tells you exactly which bars to practice next. | 101 |
| 2 | A piano tutor that hears every note to the millisecond, names the one thing to fix, and gives you a reason to play again. | 121 |
| 3 | Notes fall onto a real piano. Étude hears every one to the millisecond and tells a beginner what to fix next. | 109 |
| 4 | For the beginner who doesn't know what to practice: a real-piano game that finds your weakest bars and loops them. | 114 |
| 5 | Learn piano without feeling lost: every note judged to the millisecond, your weak bars named, then practiced. | 109 |

Why 1: it opens on the problem a non-pianist recognizes, and its promise ("which bars") is exactly what the results
screen does today. 2 is the strongest on the promise but long for a grid card.

## Coach scores

### Before (the draft on `main` at `73d6930f`)

| Criterion | Score | Why |
|---|---|---|
| Impact | 2 | No person, no beginner numbers; the problem was "lonely and quiet" and the pitch "a rhythm game" |
| Technical Execution | 3 | Good evidence (`/veritas`, 53 → 3 canvases) buried in link-dense bullets; no build numbers |
| Design & Usability | 2 | No images; nothing about the Duo look, accessibility or `/learn` |
| Presentation & Demo | 2 | Read as internal notes (a link on nearly every line); 14 Lab items; video and live URL open |
| Novelty | 1 | Claimed no "past 12 months" technology |

Top fixes it named: lead with the lost beginner and the real playtest numbers; make the tutor promise the headline;
give each effect its job; cut the Lab to three; put numbers on the build; answer #10; one image per criterion.

### After (devpost.md as written now)

| Criterion | Score | Best proof, and where it sits | What still caps it |
|---|---|---|---|
| Impact | 4 | "The problem" opens on the person, then the real 15% / 10% playtest | No second take: the post can't show a beginner improving, and won't until one exists |
| Technical Execution | 4 | "How we built it": 824 commits, 795 PRs in ~42 hours; `/veritas` 2 of 2, 0 false alarms; 53 → 3 canvases | Only CI proves most of it; little has been tried by a player |
| Design & Usability | 3 (4 with images) | Image 2, the results screen; the Duo paragraph; mouse-first and `?` | Depends on the four images being uploaded |
| Presentation & Demo | 3 (4 with the video) | "Limitations, and what's next": six plain limits, each with its next step | The video and live URL are open |
| Novelty | 2 until Andres's answer lands | Waits on Andres's challenge answer | No technology claimed yet |

Top fixes now, ranked: (1) the video; (2) the hero GIF, which is also the grid thumbnail; (3) a live URL that serves
main; (4) only if it really happens, the roommate's second take and its real number in "The problem".

About the project is ~1,270 words with headings. The coach would not cut further: every section answers a
criterion.

## Recommendations

### Prize tracks (#1091)

Recommend **main awards + Vobile**.
- **Vobile:** judged on the same challenge statement as the main awards, so it costs nothing. Its business is music
  and video rights (it bought Pex, a music-identification company); our cited-score charts are a small fit, not a pitch.
- **Best Open Source (MLH):** not entering. Eric, 2026-10-25: no repo license (#958 closed as not planned).
- **Skip Gemini** (no Gemini call in the code) and **Twinly** (none of its APIs used). Claiming either would be false.

### The "past 12 months" technology (#10)

**To change: Andres owns it.** Eric rejected the Claude Opus 5.5 answer ("an awful answer"). The brief Andres gets
is section 5 of [for-andres.md](for-andres.md). The field stays blank until he writes it.

## Assets

| Slot | What | Source | State |
|---|---|---|---|
| 1, hero and grid thumbnail | ~6 s GIF: notes falling on the real piano, the strip lit, the combo climbing | **Eric must record** (capture mode: `?capture=1`, recording guide `specs/features/capture-mode/recording.md`). Still fallback: `specs/features/highway-field/shots/after-maple-fever-1920.jpg` or `specs/features/combo-hud/swell-100-1920.jpg` (PERFECT +2 ms, 100 combo) | No GIF in the repo |
| 2, results | Bar strip with the weak bars bracketed, TIMING histogram, the gator's line, PRACTICE BARS | `specs/features/duo-results/shots/sweep4-after-1920.jpg` (800×450; "Bars 5–8 were your weakest: 55%"). Higher-res: capture `/play?song=twinkle&bot=rank-a&capture=1` at 1920×1080 | Exists, low-res |
| 3, the tutor | `/learn` map with the gator and the prepared session | `specs/features/learning-ui/shots/entry-map-1920.jpg` (800×450) | Exists, low-res |
| 4, Lab | The Round's four voices | `specs/features/experiments/shots/round/round3-1920-voice4.jpg`; alt Real Keys `…/real-keys/r3-1920-after.jpg` | Exists |

Never generated: every image above is a real screenshot already in the repo, or Eric's recording.

## Sources, claim by claim

All from `origin/main` at `5290c818` unless noted.

| Claim on the page | Source |
|---|---|
| Roommate ~15%, Eric ~10%, "100 or 200 ms off", "We don't know when to press the key" | `specs/context/findings.md`, 2026-10-24 first playtest |
| Four apps grade which notes, not how | `specs/mission.md` Why; `specs/context/raw/competitors.md` |
| DGX-660, Chrome, laptop keys | `specs/mission.md`; README |
| 40 / 80 / 120 ms windows, WRONG | `specs/mission.md` Non-negotiables; `web/src/game/core/settings.ts` |
| Bar strip, weak bars bracketed, AVG +N MS LATE, PRACTICE BARS at 70%, template line | `changes/duo-results.md`; `changes/weak-bars.md`; `changes/timing-feedback.md` |
| Wait, flow, adaptive practice | `changes/wait-mode.md`, `flow-mode.md`, `adaptive-chunks.md` |
| Evenness, dynamics | `changes/evenness.md`, `changes/dynamics.md` |
| Duo palette, gold/red only for judgments | dialogue "What is still open"; `changes/duo-tokens.md` |
| Mouse-first, `?` lists controls | `changes/mouse-first.md`, `changes/help-overlay.md` |
| 48 songs, each from a cited score | `find web/public/songs -mindepth 2 -maxdepth 2 -name chart.json` (48 top level, after song-pack-9 and 10; 4 more are Lab-only); README |
| `/learn`: map, gator, prepared session, four activities | `changes/learning-ui.md`; README routes table |
| 207 skills, colored by the learner's answers | `web/src/learn/frontend/mastery/curriculum/*.json` (207 nodes); `MasteryGraphHome.tsx` |
| Claude picks the next session, checked, fallback | `web/src/learn/frontend/mastery/decide/index.ts:13-15, 95-107`; `web/src/app/learn/api/next/route.ts`; PR #1079 |
| Theory chat answered by Claude | `web/src/app/learn/api/chat/route.ts` (needs `ANTHROPIC_API_KEY`; off on the live site, #1095) |
| The tutor hears its passages, not game takes | `useTake.ts`, `piano/score.ts` (#802), `/learn/practice` and `/learn/check` pages; #874 |
| First commit Fri 8:39 PM; 861 commits, 832 merged PRs at 15:32 | `git log --reverse` (`2ca2c03d`, 2026-10-23 20:39 EDT); `git rev-list --count origin/main`; `gh pr list --state merged --limit 2000` |
| 206 finished features, 204 test files, 84 browser checks | `git ls-tree origin/main changes/` (197); `*.test.*` (197) and `verify-*.mjs` (82) |
| Done = CI green + done note | `AGENTS.md` The loop |
| One pure judge in game, tests, server | README How it works; `docs/judges.md` Technicality |
| `/veritas` 2 planted, 2 found, 0 false alarms; all 48 songs (ci green on `e9e967ee`); rushing fails | `docs/judges.md` Presentation; `web/src/veritas/players.test.ts`; #545 |
| 53 canvases / 436 MP → 3 / 9.4 MP | `docs/story.md` chapter 11; #678, #684 |
| Real Keys, Conductor, The Round; none tried with players | `changes/real-keys.md`, `conductor.md`, `round.md` (Gaps) |
| "Completely undemoable", 10–20%, flow mode an hour later | `docs/story.md` chapter 7; #618, #620, #625 (the piece was Flower Dance, local only, so the page says "a hard piece") |
| Playtest on a 9-hour-old build; build stamp | `docs/incidents/2026-10-24-stale-playtest-build.md`; `changes/build-stamp.md` |
| CI jam, PR smoke + full suite on main | `docs/incidents/2026-10-25-ci-gridlock.md` |
| `nextStep(results)` not built | #642; `changes/duo-results.md` Gaps |
| Flow and adaptive not tried on the piano | `changes/flow-mode.md`, `changes/adaptive-chunks.md` Gaps |
| LED: piano lights the strip; game hints 42/42 on a simulated board only | `firmware/RESULTS.md`; #639; `changes/led-game.md`; #1089 |
| Flow take saves as all MISS | #869 (open) |

Kept off the page on purpose: Golden and Flower Dance (local only); the 6-minute finals slot (unconfirmed); the
134-node "illustrative" figure (stale: the live map is 207 nodes; `PRODUCT_AND_DESIGN.md:64` still says 134).

## Not done: README.md and docs/judges.md

Left alone, since this work stays local. Both are on main, and a judge who opens the repo will see these mismatches:
- `docs/judges.md` Novelty says "this page claims none" (fine until Andres's answer lands; then it contradicts it).
- `docs/judges.md` Technicality has Saturday's numbers (108 features, 379 PRs); the page now says 197 and 795.
- `docs/judges.md` Design has no `/learn` and no accessibility; Impact still leads with "a rhythm game".
- `README.md`'s first line is "An arcade rhythm game…"; the post leads with the tutor.
- `PRODUCT_AND_DESIGN.md:64` still says the map is a 134-node illustrative slice (Andres's file).

## Update at 15:36: what merged since the draft

- **Andres merged his own Devpost draft to main** (#1415, `docs/devpost.md`, plus `README.md` and `docs/judges.md`). It
  tells the story tutor-first and adds a detailed tutor architecture. Our local post now takes its facts for `/learn`.
- **Conflict 1, the challenge:** his draft names Claude Opus 5.5 ("Andres chose it in the Devpost review"). You've
  called that answer weak. You two need to settle it; [for-andres.md](for-andres.md) says so.
- **Conflict 2, prizes:** his draft says main judging only (his call). Ours recommended adding Vobile, which costs
  nothing. Your pick.
- **His tagline:** "A piano tutor for everyone: it finds what you know, picks what to practice next, and listens to
  every note you play on a real piano. The arcade is the method." (161 characters, fits the 200 limit). A sixth
  candidate.
- **Facts that moved:** the tutor now hears the piano in practice and the cold check (#802), so "/learn doesn't
  listen" was wrong and is fixed. Songs went from 40 to 48 (song-pack-9, five very easy; song-pack-10, three very hard
  Chopin). Counts: 861 commits, 832 merged PRs, 206 done notes.
- **New since then, maybe worth a line or a gallery shot:** Crowd Mode (the laptop mic hears the room clapping, a Lab
  experiment), one chibi gator on every screen (mascot), the Duo HUD, and screen-reader work on the select
  (select-a11y). The screenshots in the post predate the new gator.
- **The "Not done: README and judges.md" list below is partly stale:** Andres updated the README's `/learn` row and
  added a tutor bullet to judges.md's Impact. judges.md's Novelty line and Saturday's numbers are still as before.
