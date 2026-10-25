# Handoff to Andres (and Andres's agents): the Devpost submission

From Eric's writing agent, Sun Oct 25, about 16:00 ET. **Devpost closes at 5:00 PM ET and takes no late
submissions.** Eric is no longer writing the submission. Andres and his agents own it from here: the text, the
choices, and the final paste. This file is everything Eric's side learned and decided, so you don't repeat it.

**Next to this file in `devpost/`:**
- `about.md`: a paste-ready "About the project", Markdown with one LaTeX equation. Use it, cut it, or mine it.
- `submission.md`: every other form field, in the form's order.
- `notes.md`: coach scores, tagline candidates, and a claim-by-claim source table.
- `for-andres.md`: the passages about your half, each with the file it rests on.
- `media/` (not committed; Eric sends it separately): five 3:2 gallery crops of repo screenshots, whose source paths are in `notes.md` (now partly out of date; see section 7).

---

## 1. Do this first (the next 30 minutes)

1. **Submit a complete version by about 16:30, then improve it.** The form says every field can be changed later. A
   finished, honest submission at 16:30 beats a better one at 17:01, which counts for nothing.
2. **Paste one draft.** There are two: your `docs/devpost.md` on `main` (#1415) and Eric's local `about.md`. The facts
   now agree, since `about.md` took your tutor facts. Recommendation: paste `about.md` as the base. It's shorter, has
   few links, and is built for a skimming grader. Swap in your own wording wherever you like it better. Keep
   `docs/devpost.md` as the repo's sourced reference.
3. **Fill the person-only fields** (section 8): the roster, the video link, the live URL.
4. **Then, if there's time:** fresh screenshots, a cut to about 1,100 words, and the challenge answer (section 6).

---

## 2. Who reads this, and what they see

- **Round one is judged offline** by UF graduate students, after close (`specs/context/event.md`). They skim many
  entries. Most have never played piano. For them, the page plus a video of 3 minutes or less *is* the demo.
- **In the project grid they see only the title, the tagline and the thumbnail** (the first gallery image). Those
  three decide whether anyone clicks.
- **The criteria.** Devpost's overview lists four: Impact, Technical Execution, Design & Usability, and Presentation &
  Demo. Impact comes first. The event site adds Novelty, "how new your idea is, and how new the tools behind it are".
  No page gives weights.
- **Presentation & Demo literally asks for limitations:** how clearly the team explains "the problem, solution,
  technical approach, and limitations". Candor scores. Hiding gaps costs points.
- **The challenge, "Fresh off the frontier"**: "a technology, dataset, or discovery first made publicly available
  within the past 12 months", and "the new technology or resource should be central to what you build."

Read every sentence as the tired grad student who has never touched a piano. Every section opens with its point, and
the headings alone should tell the story.

---

## 3. The story (agreed by Eric and Andres in the dialogue)

Source: `specs/context/dialogues/2026-10-25-what-are-we-building.md`. Its "What was agreed" outranks anything else on
story. The post and the video follow the same order:

1. **The hook (the sensory wow):** a real piano, notes falling, the combo climbing. On the page that's the embedded
   video (Devpost puts the video at the very top) plus one line: *"A machine that hears every note, and a reason to
   play one more time."* That's the agreed line. Use it once, well.
2. **The turn: the problem as a person.** Someone who wants to learn piano and feels lost. They don't know what to
   practice, whether they're improving, or why they keep missing. Impact is won here. Use the real playtest, not a
   statistic.
3. **The promise (the conceptual wow):** Étude is a tutor that ends feeling lost. It hears every note to the
   millisecond, names one thing to fix with real numbers, and (as the next step) explains theory at the moment you
   stumble. This is what the judge should remember.
4. **The loop: the arcade as the method.** Why you keep practicing. Give each effect its job, so the flash reads as
   argument, not decoration. The ms readout says how late; adaptive practice narrows onto your weak bars; the combo
   makes you play again.
5. **Both halves as equals:** the game lane (Eric: the arcade, the judge, the practice engine, adaptive practice, wait
   and flow modes, timing, evenness and dynamics) and the learning lane (Andres: the tutor at `/learn`). Each is
   described by what it really does today.
6. **How we built it, short, for the technical judges:** a team of AI agents built most of it overnight through specs,
   PRs and CI. Numbers from git, not adjectives.
7. **The Lab: one paragraph.** Three experiments with the best footage (Real Keys, Conductor, The Round) and a link.
   Never list all fourteen.
8. **Limitations and what's next.** State each plainly and turn it into the next step.

Eric's draft maps these onto Devpost's own template headings, which the form pre-fills (Inspiration, What it does,
How we built it, Challenges we ran into, Accomplishments that we're proud of, What we learned, What's next for
Étude), numbered `01 ·` to `09 ·`, with two extra sections ("the arcade is the method" and "two halves"). Graders
skim for the template headings, so keep them.

---

## 4. Voice

- Plain "we". Short sentences. Concrete specifics. Numbers over adjectives.
- No hype words: no "revolutionary", "seamless", "AI-powered", "game-changing". Nothing is "10/10".
- Lead each section with its point, then the evidence.
- Few links on the page: the live site, the repo, the video, the Lab. Every fact's *source* goes in your notes, not on
  the page. Your #1415 draft links almost every line, which reads as internal notes to a grader.
- Andres's principle 5 is the tone rule: be confident about support and a path forward, but never promise outcomes or
  invent mastery.

---

## 5. Honesty rules (non-negotiable)

These come from `specs/mission.md`, `PRODUCT_PHILOSOPHY.md` (principle 5), `AGENTS.md`, and Eric's brief.

- **Every claim is checked against `origin/main`.** Never invent a number, date, name or quote. Unknown stays empty
  and visible, never guessed.
- **Keep the statuses apart:** "built", "merged", "verified by CI" and "tried by a person" are different claims. Most
  overnight work, including every Lab experiment, is built and tested, not tried with players.
- **The beginner gets real numbers only:** from `specs/context/findings.md`, first playtest, one-hand Twinkle: Eric's
  roommate about 15%, Eric about 10% on his first runs. Their words: "We don't know when to press the key." An
  improvement can be claimed only if a second take exists and shows it. None does yet.
- **The learning side exactly as it is.** Never write "an AI personalizes everything." What's real today and what's
  next is listed in section 9.
- **The LED strip (#1089, open):** proven that keys played on the DGX-660 light the strip (uncalibrated), and that the
  game's messages pass on a simulated board (42 of 42 hints). Not formally proven: the game driving the real strip
  during a song. Sharan's #1402 strongly suggests it works now, and Eric saw the strip on the piano. Ask Eric for a
  one-word yes before claiming it. If yes, it moves from Limitations to the hook.
- **Golden and Flower Dance are local only.** They were demoed locally and must never be implied to ship in the repo.
  The "completely undemoable" strict-mode story was on Flower Dance, so the post says "a hard piece".
- **The live URL and repo description wait on a person** (#1095, #1096, #792): use a marked placeholder, never a guess.
- **Every number in the video is real.** The beginner's improvement is shown as it happened, or not at all.

---

## 6. Decisions and open choices (now yours)

**Tagline.** The field allows 200 characters (counted from the live form). Recommended, 101 characters:

> Lost at the piano? Étude hears every note you play and tells you exactly which bars to practice next.

It opens on the problem a non-pianist recognizes, and its promise ("which bars") is exactly what the results screen
does today. Your #1415 tagline ("A piano tutor for everyone ... The arcade is the method.") is accurate but uses
phrases that mean nothing to a judge who hasn't read the dialogue. Four more candidates are in `notes.md`.

**The challenge answer.** Your #1415 draft names Claude Opus 5.5 (released 2026-09-22). Eric thinks it's a weak
answer: a judge may read it as tooling, and the game's playing loop has no AI by design. Eric handed the decision to
you. Two facts:
- **Eric's form screenshots show no challenge field** (General info, Project Story, Media). If the remaining form
  steps don't ask either, you may not need an answer at all. The About text claims no technology, and that's safe.
- **If you do answer:** it must be released between Oct 2025 and Oct 2026 and be central. #10 ruled out Web MIDI,
  Demucs, Basic Pitch (too old) and Claude Code (May 2025). If you keep Opus 5.5, frame it as the tutor's judgment
  (picking the next step from the graph's candidates, and the guiding-question chat). Say plainly that the live site
  has no key yet, so it falls back there (#1095), unless the key gets set.

**Prizes.** Your draft says main judging only. Eric's side recommended adding the **Vobile Prize**: it's judged on the
same challenge statement as the main awards, so entering costs nothing. **Best Open Source** needs a `LICENSE` file
(#958, a one-way door; the recommendation there is MIT). Skip Gemini and Twinly: no Gemini call and no Twinly API in
the code, so claiming either would be false.

---

## 7. The Devpost form, as it really is (from Eric's screenshots)

- **Project name:** 60 characters. "Étude".
- **Elevator pitch:** 200 characters.
- **About the project:** a plain textarea. "Format your story in Markdown, with LaTeX support for math." It's pre-filled with
  the template headings.
  - Devpost's help article (help.devpost.com/article/193-markdown-tips) documents display math as `$$ ... $$` and
    inline math as `\\( ... \\)`. Only math mode works: no document environments, macros or packages.
  - Tables, footnotes, highlight and the other "extended" syntax are listed without a promise that Devpost renders
    them. Check **Preview**. If tables come out as raw pipes, turn them into lists.
  - **Markdown runs before the math,** so inside math avoid underscores and carets (they trigger italics and
    superscript) and backslashes before punctuation (`\,`, `\;`, `\\`, `\{`). Eric's single equation avoids all of these:
    `$$\Delta t = \text{when you pressed} - \text{when it was due} - \text{your latency offset}$$`.
  - **Images need a hosted URL** (there's no upload button in the textarea). The repo is public, so
    `raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/<path>` works. Pin a commit SHA so images never break.
  - Write one paragraph per line. Some Markdown setups turn hard line breaks into visible breaks.
- **Built with:** up to 25 tags. The suggested 17: next.js, react, typescript, web-midi, web-audio, canvas, three.js,
  opensheetmusicdisplay, supabase, postgresql, vitest, playwright, github-actions, claude, anthropic-api, esp32,
  ws2812b.
- **"Try it out" links:** several allowed. The repo: https://github.com/Eric-Zhang-Developer/piano-arcade-gator-ai-days.
  The live site: the repo's homepage is `web-kohl-three-51.vercel.app`, but it serves an old build (`bb95f63`, not
  main) with no Supabase or Anthropic keys (#1096, #1095, #792). List it only after a redeploy.
- **Image gallery:** JPG, PNG or GIF, 5 MB max, 3:2 ratio works best, up to 15. **The first image is the grid
  thumbnail.**
- **Video demo link:** "embedded at the top of your project page". Eric's screenshot already had a YouTube link in
  the field; confirm with Eric that it's the final video.

**Screenshots are stale.** Since the `media/` crops were made:
- The song select was redesigned to one Play button and a Practice panel (#1414).
- Watch moved onto the results screen (#1419).
- One new chibi gator now appears everywhere (mascot).
- Fever was restyled into the Duo look (#1375).
- The `/learn` activities now cue the ink (#1418).

The results shot and the `/learn` shot are also only 800×450. If there's time, capture fresh 1920×1080 shots from
current main with `?capture=1` (capture mode hides the cursor and setup text; guide:
`specs/features/capture-mode/recording.md`):
- results: `/play?song=twinkle&bot=rank-a&capture=1`, played to the end;
- the `/learn` map;
- a highway frame for the thumbnail.

Crop them to 3:2. Never generate or fake a screenshot. Caption a bot take as a test run, never as a person.

**Avoid the old synthwave screenshots** (sun, magenta, the old combo HUD): the dialogue rejected that look.

---

## 8. Fields only a person can fill

| Field | Status |
|---|---|
| Team roster | Full names for Andres and Sharan, and every member registered on Devpost (2 to 5) |
| Video link | Eric is making it; a link is already in the form, so confirm it's final |
| Live URL | Needs the Vercel keys (Supabase and `ANTHROPIC_API_KEY`, server-only) and a redeploy |
| LED claim | Eric: has the game lit the real strip during a song? (section 5) |
| License | Only if entering Best Open Source (#958) |

---

## 9. Facts you can use (checked against `origin/main`, about 15:56 ET)

**Your half (from your #1415 draft and the code):**
- A new student names goal songs, then takes a diagnostic of up to 15 minutes (`diagnostic/model.ts`). Then
  `/learn` opens on a map of 207 skills and 481 prerequisite links, each skill citing a source (146 titles), with 433
  items. `audit.test.ts` fails the build on a skill with no source.
- The steps: understand (with a theory chat that asks guiding questions and never gives the answer, `api/chat/tutor.ts`),
  recall, practice with help that fades (help on for at most 30% of a take for it to count), and a cold check at tempo,
  both hands, no help.
- The tutor hears node practice and the play check over Web MIDI with its own scorer (`piano/score.ts`, #802).
  `/learn/play-through` and guided practice still show a sample learner's take (#946), so leave them out or say so.
- Knowledge tracing: mastery at a belief of 0.95; cold checks after 1, 3, 7, 21 and 60 days. These are standard
  values, **not calibrated on real students** (`engine/constants.ts`). Say so.
- Claude Opus 5.5 picks 3 to 5 next steps from up to 20 graph candidates and says why. A failed graph check, an error
  or a missing key falls back to the top candidates (`decide/index.ts`, #1079). #1079 says it wasn't tested against the
  live API.
- Not yet: the tutor doesn't read game takes (#874). `nextStep(results)`, theory at the moment you stumble, is
  proposed, not built (#642).

**Eric's half:**
- A real 88-key piano (Yamaha DGX-660) in Chrome over Web MIDI, or laptop keys with no piano.
- Judged against the chart's clock after the latency offset: PERFECT within 40 ms, GREAT within 80, GOOD within 120;
  MISS when no key of that pitch arrives in time; WRONG for an extra key away from any note of that pitch
  (`specs/mission.md`).
- The results screen shows accuracy by bar, brackets the weakest bars, gives the average timing ("AVG +7 MS LATE"),
  and offers one button: "PRACTICE BARS 5–8" at 70%. The gator's line is a fixed template (`changes/duo-results.md`).
- Wait mode, flow mode, adaptive practice, bar loop; timing, evenness and dynamics panels (`changes/*.md`). Flow mode
  and adaptive practice are **not tried on the piano yet**.
- 48 songs, each charted from a cited score (song-pack-9 added five very easy songs, song-pack-10 three very hard
  Chopin pieces).
- `/veritas`: test players plant known mistakes; on Für Elise, 2 planted, 2 found, 0 false alarms. On every committed
  song it catches exactly what was planted, except rushing (#545, open).
- `/play` went from 53 canvases and 436 megapixels a frame to 3 canvases and 9.4 megapixels (`docs/story.md`,
  chapter 11).
- Accessibility: mouse-first (every key action has a button), `?` lists every control, screen-reader work on the
  select (`changes/mouse-first.md`, `help-overlay.md`, `select-a11y.md`).
- Known bug: a flow-mode take saves as all misses (#869, open).

**The build (git, `origin/main` at 15:32):**
- First commit Fri Oct 23, 8:39 PM ET.
- 861 commits, 832 merged PRs, 206 finished features (done notes in `changes/`).
- 204 test files and 84 browser checks.

Recount right before you paste: `git rev-list --count origin/main`, `gh pr list --state merged --limit 3000 --json number | jq length`, and `ls changes | wc -l`.

---

## 10. Where the draft stands (hackathon-coach scores, 1 to 5)

| Criterion | Old main draft | Eric's local draft | What would raise it |
|---|---|---|---|
| Impact | 2 | 4 | The beginner's second take, if it really happens |
| Technical Execution | 3 | 4 | More "tried by a person"; your tutor architecture helps |
| Design & Usability | 2 | 3, or 4 with images | Fresh screenshots of the current look |
| Presentation & Demo | 2 | 3, or 4 with the video | The video, and a live URL serving main |
| Novelty | 1 | 2 | A challenge answer a judge believes is central |

**Eric's agent's last feedback, ranked:**
1. Submit by about 16:30, then edit.
2. Don't block on the challenge answer.
3. Refresh the screenshots.
4. Cut to about 1,100 words (Eric's draft is about 1,500).
5. Get the LED yes from Eric.
6. Keep the problem-first tagline.
7. Paste the short draft, not the link-dense one.

---

## 11. Process notes

- Eric wants the submission copy kept **local**, not run through PRs and CI ("We don't need to do that"). Your
  `docs/devpost.md` on `main` is fine as a repo document; you don't need to keep it in sync with what you paste.
- `docs/judges.md` on `main` still says it claims no challenge technology, and still has Saturday's numbers (108
  features, 379 PRs). It only matters if a judge opens the repo. Low priority.
- The beginner's second take, the LED strip during a song, and the video are where the remaining points are. All
  three need a person at the piano, not a writer.
