# Level forge, phase 1: findings

Spike: `specs/features/level-forge/spec.md` (issue #507). Phase 1 only: no API key, no app route. The agent was a
worker's own Claude Code session (eric-agent-2, Opus 5.5), using web fetch on Mutopia's search page and the scripts in
`game-tools/forge/` for every step that touches a file. Runs on 2026-10-24, 18:35–18:38 UTC.

## Answer

**Yes, for phase 1.** 5 of 5 pieces ended in a saved level that passes every library rule, each in under 30 seconds
from the request to the saved level (the bar is 4 of 5, each under 2 minutes). The two library re-forges matched
96.4% and 100% of the committed notes over the beats both cover (the bar is 95%). What a level costs in the app is
still open: see Cost.

**Recommendation: promote to phase 2 on Eric's go.** The scripts are ready to be its tools unchanged, and phase 2
answers what phase 1 can't: the cost per level, and a blind re-forge of the two library pieces.

## The five forges

| # | Piece | Result | Request to saved | Session token counter | Source and choices |
|---|---|---|---|---|---|
| 1 | Für Elise (by name) | pass | 23 s | 1.8k | Mutopia 931, Public Domain. Pickup 0.5 + bars 1–9, 66 bpm, 56 notes |
| 2 | Ode to Joy (by name) | pass | 19 s | 1.4k | Mutopia 528, Public Domain. SATB hymn: right hand the upper staff's top voice, left hand the lower staff's bottom voice; bars 1–16, 80 bpm, 122 notes |
| 3 | Bach, Prelude in C, BWV 846 | pass | 19 s | 1.9k | Mutopia 5, Public Domain. The search also returned the C major fugue (4) and a guitar-duo prelude (2206); the keyboard prelude was picked. The file's tracks are reversed (1 lower, 2 upper). Bars 1–8, 66 bpm, 128 notes |
| 4 | Joplin, The Entertainer | pass | 19 s | 1.7k | Mutopia 263, Public Domain. Bars 1–12 of 2/4 (the intro and the A strain's start), 80 bpm, 189 notes |
| 5 | Chopin, Minute Waltz, Op. 64 No. 1 | pass | 25 s | 1.7k | Mutopia 483, Public Domain. Bars 1–16, 120 bpm (the score's molto vivace is far faster), 170 notes |

No step failed. Each forge was 1 search (Mutopia's own search page, fetched), 1 download, 1 convert, 1 check and 1
save. Spot checks against the score: Bach's bar 1 is C4 and E4 held under G4 C5 E5, twice; the Entertainer opens on
its octave run D E C A, B G; the waltz on A♭ G A♭ C B♭ G over D♭.

## Accuracy: the two library re-forges

`game-tools/forge/forge diff <forged> <committed>`: the committed notes matched on pitch, hand and beat (within 1/12
beat) over the beats both charts cover.

| Piece | Beats compared | Committed notes | Matched | Share | Forged with no match | Same source |
|---|---|---|---|---|---|---|
| Für Elise | 13.5 | 55 | 53 | 96.4% | 3 | yes (Mutopia 931) |
| Ode to Joy | 64 | 122 | 122 | 100% | 0 | yes (Mutopia 528) |

Für Elise's misses are all at beat 13, a choice of form rather than wrong notes: the committed chart writes the repeat
out (`--spans`), so the pickup E, D♯ comes again; the forge took the bars as notated and ends on the first ending's A
with its left hand.

**Caveat: these two weren't blind.** Before running them this session had read
`game-tools/midi-to-chart/README.md`, which names both source files and the flags the library used. The search did find
the same sources from the name alone (each was Mutopia's only result), but the hand, voice and bar choices for Ode to
Joy match the README's. Treat these numbers as the scripts' and the sources' accuracy, not an unaided agent's. The
in-app agent in phase 2 won't have read the README, so its re-forges are the real blind test.

## Time

Measured with the shell clock, from the step that started each forge to the save that ended it, including the
session's own thinking. 19–25 s each, well under 2 minutes. The slow parts are the vitest start-up in `check` (about
0.6 s) and the fetches; the converter is instant at these sizes. An in-app agent adds model latency per turn, so
phase 2 will be slower, but there's roughly a 5× margin.

## Cost

**Not measured in dollars, and the session numbers don't price phase 2.** The "session token counter" column is how
far this session's remaining-token count fell during each forge (1.4k–1.9k). It doesn't show cached input, and this
session carried a long conversation, so it says nothing reliable about a fresh agent's input tokens. What it does say:
a forge is about 6 tool calls with short outputs (the largest is the search page), so the model's own output per forge
is small. The cost in phase 2 will be dominated by input tokens across those turns, which the route's `usage` sums will
measure. The spec's guard (12 tool calls or 150,000 tokens per forge) is generous for 6 calls.

## What the scripts enforce (phase 1, `game-tools/forge/forge.py --self-test`, no network)

- `download`: refuses another host (including `mutopiaproject.org.evil.com`), http, an extension other than
  `.mid`/`.midi`/`.ly`/`.zip`, and a file over 5 MB (from `Content-Length` or the bytes read).
- `convert`: refuses a file this forge didn't download, and an `-o` (the forge picks where the chart goes).
- `check`: the library's own rules, imported from `web/src/game/songs/rules.ts` (#533) through
  `web/src/app/api/forge/check.test.ts`, plus "the id is new to the library".
- `save`: refuses a chart whose hash isn't the one this forge's `convert` wrote, one changed since `check`, a source
  with no URL this forge downloaded from, a source with no open license (decision 003), and an id already saved.

## Gaps

- **IMSLP wasn't exercised.** Mutopia had all five pieces as MIDI. IMSLP mostly serves PDFs, so a piece only there
  likely fails at `download`; untested.
- **Bars are the first N, as notated.** No forge wrote out repeats (`--spans`) or picked a famous passage that isn't
  at the start. A level that's the "known" part of a piece needs the agent to read the score's structure.
- **Ornaments come through as the MIDI has them.** The waltz's turn on its first note isn't in the file; the converter
  README already warns about this.
- **The check reports one rule line** ("follows the library rules") with every broken rule in its message, not one
  pass/fail line per rule as the spec's phase 2 wording has it. The rules are the library's own list either way.
- **Not played.** The five levels pass the perfect-player rule, but nobody played them from song select. They're in
  `web/public/songs/local/` on this machine only (gitignored), at `/play?song=local/<id>-forge`.
- **Credits:** all five are Public Domain on Mutopia; none asks for a credit, so nothing for `CREDITS.md`.

## OpenRouter

Not worth a second time box yet: phase 1 needed no model API at all, and phase 2's open question is cost, which the
Anthropic route's `usage` answers directly. Compare only if phase 2's dollars per level come out too high.
