# 001: Game direction after the spike and the reference studies

- Date: 2026-10-24   Decided by: Eric (game lane), in planning with Claude   Feature: project-wide
- **Context:** The v4 plan (`specs/context/raw/piano-arcade-v4.md`) was written before the feasibility spike
  (`spikes/piano-midi/RESULTS.md`: all R1–R7 pass) and before studying five reference videos
  (`specs/context/references/*/README.md`). Several of its choices changed. The raw plan stays as history; where it
  disagrees with this file, this file wins.

| # | Topic | Was (v4) | Now | Why | How to undo |
|---|---|---|---|---|---|
| 1 | Framework | "one web app, TypeScript, canvas" | Next.js App Router + TypeScript in `web/`, pnpm | The team knows Next.js; the coach fits as a route | A `contract:` PR changing `tech-stack.md` |
| 2 | Look | Pixel art is the medium | Synthesia's look (dark, glowing, aligned to keys) plus an arcade layer from Nostalgia and Chunithm | Eric's pick after the reference study | Edit `mission.md` Not doing |
| 3 | Highway | Perspective lanes to a horizon | One renderer with a perspective setting: 0 is flat Synthesia, small values add mild depth. Eric compares both and locks one | Three of five studies flagged strong perspective: far notes shrink to slivers | Change the setting's default |
| 4 | Lane width | Full keyboard | Zoom to the song's range (lowest to highest note, plus padding) | 88 lanes are too thin for arcade feedback; Nostalgia gets fat notes from a small keyboard | A setting for the full 88 keys |
| 5 | Note speed | Not set | About 2 s of lookahead, as a setting | Nostalgia (~0.45 s) is too fast to learn from; Synthesia is ~2.1 s | Change the setting |
| 6 | Note color | Cyan right hand, magenta left | One note color; misses in a clearly different color | Eric's pick; a miss must never look like a hit | Color by hand later |
| 7 | Effects | Hit bursts, shake, fever | Effects rise above the judgment line (Synthesia wisps, bursts); the combo is a giant number behind the notes; one rare whole-screen state (fever) | All five studies put effects above the line or beside the highway, not in the lanes | Per-feature specs |
| 8 | Sound | Hit sounds pitched to the key | No per-hit sounds; event sounds only, mixed under the piano | None of the four game videos has hit sounds separate from the music; the piano is the music | `mission.md` Not doing |
| 9 | Scoring first | Tempo curve (rubato-tolerant) | Fixed tempo first (v4's strict metronome mode); the tempo curve later | Ship a playable loop tonight | A later feature |
| 10 | First song | Twinkle theme | Twinkle, first verse, right hand, from a public-domain score | Short, known, playable by judges | Swap the chart |
| 11 | Library | About 20 pieces by Saturday noon | 5 pieces; "Golden" is a stretch, decided Saturday night | Scope | Raise the target |
| 12 | Lanes | One team, many lanes | Two people's lanes (game: Eric; learning: teammate), separate folders, CODEOWNERS for cross-lane review | Each person keeps the final say over their lane | Edit "Lanes" in `AGENTS.md` |
| 13 | Sheet music | A strip on the gameplay screen | Deferred to a practice mode (learning lane) | Reading the score and following falling notes compete for attention | Add it back to a game spec |
| 14 | Demo video | 2–3 min pitch plus a deep dive | 3 minutes maximum (Devpost rule); the deep dive goes in the Devpost write-up | Devpost: "A demo video (3 minutes maximum) or slides" | Only if organizers allow a supplementary link |
| 15 | Schedule | An hour-by-hour plan | No deadlines enforced (`start` is empty in `milestones.toml`); milestones set the order | The schedule made agents too rigid | Set `start` |
