---
name: "Level forge spike: an in-app agent turns a public-domain source into a playable level, priced per level"
depends_on: ["song-pack-1", "chart-lint", "piano-sim"]
owns: ["specs/features/level-forge/", "changes/level-forge.md", "game-tools/forge/", "web/src/app/api/forge/", "web/src/app/forge/", "spikes/level-forge/", "specs/decisions/level-forge-"]
assignee: "eric"
---

# Level forge (spike)

Issue #507. Eric, 2026-10-24: the product needs a better answer to "how is AI integrated?", and AI belongs
everywhere around the playing loop (the `contract:` PR on `mission.md`). This spike tests the boldest version: type a
piece's name, and an agent finds a public-domain source, runs our converter and our checks, and hands back a level
you can play. It overlaps the provisional learning-lane `chart-compiler` spec; Eric is claiming it for his lane, the
same move as `song-rip-spike`. A spike follows the spike guideline (#493): one question, findings at the end.

## Two phases
Eric, 2026-10-24: "the forge spike's phase 1 is a local agent session using the same convert/check/save scripts, no
API spend; the in-app API route is phase 2."
- **Phase 1 (local, no API spend):** a worker's own Claude Code session plays the agent. It searches Mutopia and
  IMSLP, picks a source and bars, and runs the scripts: `download`, `convert`, `check`, `save`
  (`game-tools/forge/`). This is the spike's question and its FINDINGS.md.
- **Phase 2 (in-app, API key):** the `/api/forge` route and `/forge` page below call the same scripts, unchanged,
  with a budget set from phase 1's numbers. It starts only when Eric says go.

## The question
Phase 1 answers it; phase 2 repeats it in the app. Can an agent make a correct, playable level from a public-domain
source in **under 2 minutes**, and what does one level cost?
- **Yes:** at least 4 of 5 test pieces (below) end in a saved level that passes every check, each in under 2 minutes,
  with the cost of each measured, and the two library re-forges match at least 95% of their committed notes.
- **No:** fewer than 4 pass, or a passing level takes over 2 minutes. FINDINGS.md says which step failed.
- **Time box:** 3 hours for phase 1. Then FINDINGS.md, whatever the state.

## Plan
1. **Phase 1 scripts**, `game-tools/forge/`: `download`, `convert`, `check` and `save`, plain commands with the
   behavior under Requirements, Tools. Each prints JSON. Phase 2 calls them as they are.
2. **Phase 1 runs**: the five pieces under Validation, from a worker's session, then FINDINGS.md in
   `spikes/level-forge/`. No API key, no new `web/` dependency.
3. **Phase 2, on Eric's go only.**
4. **Key, done by Eric** (added 2026-10-24 to `web/.env.local`, which is the only file Next reads; the Console's
   $5–10 spend limit isn't confirmed yet). In the worktree that builds phase 2, symlink that file
   (`ln -s <main>/web/.env.local web/.env.local`) so the key lives in one place. Agents never create, print, copy or
   commit the key, and never use a `NEXT_PUBLIC_` name. Phase 1 doesn't touch it.
5. **Dependencies.** `@anthropic-ai/sdk` and `zod` go into `web/package.json`, which is frozen: a `contract:` PR adds
   just those two, first.
6. **The route**, `web/src/app/api/forge/route.ts`, then the page `/forge`, then the five runs again in the app.

## Requirements
**Tools** (phase 1 scripts; phase 2 exposes the same ones to the model)
- `download`, `convert`, `check` and `save`, as described for phase 2 below. They are code, so their refusals hold
  in both phases.
- `check` runs the library test's rules and the perfect bot over one chart. If those live in TypeScript, `check` is a
  small vitest file run by name, never a copy of the rules.

**Phase 1 measures**, per piece, into FINDINGS.md:
- pass or fail;
- minutes from the request to a saved level;
- the failing step and its message;
- the tokens the session spent on it, from the session's own usage, as an estimate for phase 2.

**Phase 2: the agent**
- Official TypeScript SDK, Tool Runner (`client.beta.messages.toolRunner` with `betaZodTool` tools), model
  `claude-opus-5-5`, `output_config.effort` `"low"` (the runs compare `"medium"` too).
- Refusal fallback on: beta `server-side-fallback-2026-07-01` with `fallbacks: "default"`. Check `stop_reason`
  before reading content; a refusal ends the forge with its reason on screen.
- Opus 5.5 rejects forced `tool_choice`: keep `auto` and name the tool order in the prompt.

**Phase 2: tools** (the only ones the model gets)
- `web_search` (`web_search_20260209`) and `web_fetch` (`web_fetch_20260209`), both with
  `allowed_domains: ["mutopiaproject.org", "imslp.org"]`. Web fetch only opens URLs already in the conversation.
- `download(url)`: our code fetches the file, because web fetch hands content to the model, not a file to us.
  - Only those two hosts, only `.mid`, `.midi`, `.ly` or `.zip`, at most 5 MB.
  - It saves into the forge's scratch folder under `web/public/songs/local/` and returns the file's track list (name
    and note count per track), the same listing the converter README starts with.
- `convert(file, rh, lh, bars, bpm, id, title, composer, source)`: runs `game-tools/midi-to-chart/convert.py` with
  those flags and returns its stderr and the chart's note count. The model picks tracks, bars and tempo; it never
  sends notes.
- `check(id)`: the library test's rules (`web/src/game/songs/library.test.ts`) and the perfect bot
  (`web/src/game/sim/bot.ts`) at 100% over the converted chart. It returns pass/fail per rule.
  - If the library test can't reach a `local/` chart, export its rules as a function rather than copying them.
- `save(id)`: moves a chart that passed `check` to `web/public/songs/local/<id>/chart.json`, where song select lists
  it.
  - It refuses a chart that `convert` didn't write in this forge (a hash match), so no note the model typed can land.

**Rules the code enforces, not the prompt**
- `source` must name a URL the forge downloaded from and the license as quoted on that page (decision 003). If the
  page shows no open license, `save` refuses. A credit the license asks for is listed in FINDINGS.md for a later
  `docs:` PR to `CREDITS.md`.
- The route answers only in `next dev` with `ANTHROPIC_API_KEY` set; elsewhere it returns 404. The Python converter
  and the key exist only on the dev machine, so the production build never forges.

**Cost guard** (a second line; the Console limit stays the real one)
- Each forge stops at 12 tool calls or 150,000 total tokens, whichever comes first, and says which.
- Each forge appends one line to `web/public/songs/local/forge-log.jsonl` (self-ignored):
  - the piece, effort, seconds, result and failing step;
  - `usage` summed over every turn (`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
    `cache_creation_input_tokens`) and the web search count (`usage.server_tool_use`);
  - dollars at Opus 5.5's $4 / $20 per million input / output tokens and $0.20 per million cache reads. The search
    fee isn't in our sources, so it's logged as a count, not priced.
- When the log's dollar total reaches `FORGE_CAP_USD` (default 5), the route refuses new forges and says so.

**The page, `/forge`**
- A text box, Forge, then each step streamed as it happens: searching, the source and license found, downloading,
  tracks, converting, checking (each rule), saved.
- On a pass: the level's title and source, a Play link (`/play?song=local/<id>`), and the seconds, tokens and
  dollars it took.
- On a fail: the step and its message, and nothing saved.
- Offline (venue wifi down): it lists levels already forged, from the log, each with its Play link. These are the
  fallback.

## Validation
Phase 1:
1. Each script's refusals, with no network: `download` refuses another host, another extension and a file over
   5 MB. `save` refuses a chart `convert` didn't write in this forge.
2. Five forges from a worker's session, one at a time, through the scripts only. Each gets the measures above.
   - **Accuracy, against songs already in the library** (Eric, 2026-10-24): Für Elise and Ode to Joy, asked for by
     name only. Diff each forged chart against the committed one (`web/public/songs/<id>/chart.json`) over the bars
     both cover: the share of committed notes matched on pitch, hand and beat (within 1/12 beat), the forged notes
     with no match, and whether the forge found the same source (both are Mutopia: 931 and 528). The diff is a
     script in `game-tools/forge/`, and its numbers go in FINDINGS.md.
   - **Pass rate, on new pieces:** Bach's Prelude BWV 846 (Mutopia 5), Joplin's The Entertainer (Mutopia 263) and
     Chopin's Minute Waltz (Mutopia 483).

Phase 2 (on Eric's go):
3. `pnpm -C web exec vitest run --passWithNoTests src/app/api/forge`:
   - `save` refuses a chart whose hash isn't from this forge's `convert`;
   - `download` refuses another host, another extension and a file over 5 MB;
   - the route returns 404 without the key;
   - the cap refuses once the log total reaches `FORGE_CAP_USD`.
   - No network: the SDK client is a fake.
4. The same five forges from `/forge`, one at a time, at effort `"low"`, then the two slowest again at `"medium"`,
   plus one piece Eric names on the day. For each: pass or fail, seconds, tokens, dollars, the accuracy diff where
   it applies, and whether the level plays from song select.
5. One forge with wifi off: the page shows the forged list and no error.

## Gaps (accepted)
- OpenRouter is Eric's alternative. It's not in this spike: the Anthropic server tools may not pass through a
  proxy. FINDINGS.md says whether a comparison is worth a second time box.
- Sources other than Mutopia and IMSLP, and audio sources, are out: song-rip-spike asks that question.
- IMSLP mostly serves PDFs, which the converter can't read. A piece only on IMSLP likely fails, and that's a finding.

## Defaults
- The 95% accuracy bar for the library re-forges is the planner's pick (Eric set no number). Change it here.
- Effort `"low"` first because a forge is mostly picking and checking; `"medium"` is the comparison.
- Saved to `local/`, not the committed library: a forged level is committed later, through a normal chart PR, if
  Eric wants it.
