# 000: Project-wide defaults

Agents read this after their feature spec's Defaults. Humans review it first after a run. Each row says how to
undo it.

| # | Topic | Default | Undo |
|---|---|---|---|
| D1 | Game tuning numbers (lookahead, perspective, colors, effect timings) | A named setting with the spec's default, never a literal scattered in code | Change the default |
| D2 | A design question a game spec doesn't answer | Look at `specs/context/references/` for how the reference games handle it, take the smaller option, and log it | Revert the decision file's change |
| D3 | Something only the real piano can show (feel, sound mix, latency) | Build it, mark it `not verified on the piano` in the done note, and file a `needs-human` issue for Eric to try it | Eric's result decides |

## When nothing covers it
1. Keep every rule in `mission.md` exact.
2. Show "unknown / needs review" rather than guess.
3. Take the smaller change that someone else can undo.
4. Prefer deterministic code over a model call, and a model call over manual guessing.
5. Log it in `decisions/<feature>-<topic>.md`.
