## What shipped
The video's title card is played: Étude's letters land on the game's hit line, one per note of its cipher motif E–F–G–D–E (DGX at once, laptop voice on the first key or click), the acute last with a burst, then the tagline; still by 3.55 s. The end card leads with the URL to type in the ink, fitted to one line, the repo second in blue when a live URL exists, and a facts line counted from git.
## Where it lives
`web/src/game/video-shots/` (`motif.ts`, `Title.tsx`, `facts.ts`, `make-facts.mjs`, `facts.json`, `Cards.tsx`, `cards.module.css`), `specs/decisions/video-cards-{motif,kerning,end}.md`, shots in `specs/features/video-cards/shots/`.
## How to check it
`localhost:3001/shots?card=title&capture=1` (click or press a key for the laptop voice) and `?card=end&capture=1`; `&t=<ms>` freezes the title at that time. `verify-shots.mjs`: not verified locally; covered by main's scheduled full run. Not seen by Eric.
## Gaps
No DGX attached: the letter-vs-note timing was measured on the laptop voice only, in a hidden pane (0–18 ms over 3 runs; one letter at 18 ms, over the 16.7 ms frame). The burst isn't in the frozen shots. WebMs with sound (d) not made: the pane is hidden and can't record audio. The live URL waits on `NEXT_PUBLIC_LIVE_URL`; `facts.json` is a snapshot to re-run at the freeze.
