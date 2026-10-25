## What shipped
The Composer's Hands spike: `/composers-hands` plays a composer's own piano roll (Listen), plays his left hand while
you play the right, judged on core's Judge (Duet), and draws his tempo, the score's and yours (Compare). It has a
Lab entry under Wow, and a start-panel link on `/play` with `?x=composers-hands` for songs with a roll. The source
table found Rachmaninoff's Ampico 57504 and Joplin's Connorized 10265. Both stay local, because no license is
stated; a fresh clone plays a labeled test roll.
## Where it lives
`web/src/game/x/composers-hands/`, `web/src/app/composers-hands/`, `spikes/composers-hands/` (sources.md,
match.mjs, FINDINGS.md), `specs/decisions/composers-hands-*.md`, shots in `specs/features/experiments/shots/composers-hands/`.
## How to check it
`pnpm -C web exec vitest run src/game/x/composers-hands` (13 tests). `/composers-hands?song=rachmaninoff-prelude-cs&roll=chart&midi=sim`
on a dev server: the Listen timing check read median 0 / p90 0 ms over 466 note-ons. Browser checks:
not verified locally; covered by main's scheduled full run.
## Gaps
- (b), the pitch match on a real roll, isn't measured: the rolls aren't downloaded, pending Eric's OK.
- The spool correction hasn't run on a real roll.
- The perf gate wasn't run locally (main's scheduled run covers it).
- Not heard by Eric (e).
- Reduced motion: the page adds no motion of its own; the highway follows core's reduced-motion rule.
