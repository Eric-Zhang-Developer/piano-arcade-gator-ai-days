# Shot list: the game's ~90 s of the video

One row per game shot, from the two tentative plans: the writeup's "The Devpost video" table
(`specs/context/raw/piano-arcade-writeup.md`) and "The screens" in `specs/context/visual-direction.md`. **State** is
what eric-agent-3 saw on 2026-10-25 in a dev server of this branch (origin/main `354ff1b`) under `?capture=1` at
1920×1080, after the page had loaded, in the in-app browser. Sound wasn't checked. Record the production build
(`specs/features/capture-mode/recording.md`); the Next dev badge seen bottom-left in these checks is dev-only.

Two leftovers show in more than one row, so they're named once here:
- **First frames (L1):** capture's flag applies after hydration, so a page's first frames can show the cursor and
  setup text (capture-mode's done note). Part 1 sets the flag before the first paint.
- **Laptop marks in bot takes (L2):** in any take driven by `bot=` (no piano note-on), the keyboard keeps its laptop-key
  letters (`A`…`;`, `W`…`P`), the cyan laptop bar and the `Z` / `X` octave chips. laptop-octaves hides them after the
  first MIDI note-on, which a bot take never sends. Part 1 hides them under capture.

| # | Plan time | What the viewer sees | URL and setup | State today |
|---|---|---|---|---|
| 1 | 0:00 | Cold open: dark room, the highway over real keys, the LED strip | Camera, not a page | No page to check |
| 2 | 0:00 | Twinkle: PERFECT ×12, combo bursts, S rank | `/play?song=twinkle&bot=perfect&audible=1&capture=1`, Start | Play: L1, L2; falling notes carry laptop letters until Labels is set to note names (the recording guide's step 2). Results: clean (S, 42 PERFECT, the tutor's line), except a focus ring on Retry |
| 3 | ~0:10 | Title card: Étude and the tagline | `/shots?card=title&capture=1` | Doesn't exist: part 2 |
| 4 | 0:12 | Song select scrolls through the library, ~3 s | `/?capture=1`, ↑ / ↓ | Clean after load (cursor, nav bar, build stamp, Lab, Options and ? Controls hidden); L1 |
| 5 | 0:16 | Stage card: ARE YOU READY, the song, LV and NOTES | `/play?song=fur-elise&capture=1` | Clean |
| 6 | 0:16 | A Für Elise take with one LATE | The same page, played by Eric on the DGX | Needs a human take: no bot gives exactly one LATE (`bot=late` makes every note a late GREAT), and no take file is committed for `bot=take` (`web/public/takes/` is empty). With the piano, L2 hides after the first note |
| 7 | ~0:30 | Results with the tutor's line | The take's results | Clean on Twinkle (row 2); same Retry focus ring |
| 8 | ~0:35 | The piano plays the take back, the slip glowing red | Results → Replay on piano (piano-out) plays it on the DGX; on screen, Details → Watch replay (replay-view, from duo-details) | **Gap:** replay-view colors each note by its judgment, so a LATE GREAT isn't red. A red slip is new work: goes to the planner on #852, not this feature |
| 9 | 0:40 | Montage: harder pieces, a denser highway, grades climbing | `/play?song=<moonlight-3, nocturne-op9-2, maple-leaf-rag…>&bot=<rank-c…perfect>&capture=1`; `bot=fever` for fever | L2. Fever's edge still uses the retired sun gradient (#885, its own polish issue) |
| 10 | 1:00 | WARNING card | Any song at Lv 13+ (`maple-leaf-rag`, Lv 14), or `&warn=1` | Clean: WARNING and the level in the count-in's first bar; L2 under it |
| 11 | 1:00 | Var. XII at 50% against the ghost, then the piano at full speed | `&tempo=50`; the ghost shows on Retry; full speed with `bot=perfect&audible=1` | **Gap:** no Var. XII chart is committed (`spikes/twinkle-13/out/02-var12.mid` is a MIDI, not a chart). A new chart is a song request, not this feature: goes to the planner on #852 |
| 12 | 1:25 | Any song: the agents take a recording apart into a chart, ~8 s | Terminal footage of `game-tools/forge/forge` | Not a game page |
| 13 | 1:35 | "Golden": a human on the melody, judgments popping | `/play?song=local/golden-hard&hands=R&capture=1` (the piano plays the left hand), or golden-demo's autoplay `…&bot=perfect&audible=1&demo=1&beat=off` | Local charts, so checked with the same flags on `fur-elise`: the autoplay starts itself and shows the DEMO badge; L2. Which of the two the plan means ("the band out of the piano") is Eric's call |
| 14 | 1:50 | End card: the repo URL (the live URL once set) | `/shots?card=end&capture=1` | Doesn't exist: part 2. No QR library is installed, so any QR is made in the edit |

## What this means for the build
- **Part 1 (capture from the first frame):** L1 everywhere, L2 in rows 2, 9, 10 and 13. Row 2's Retry focus ring is
  small; checked again after L1 and L2, and hidden only if it still shows in a recording.
- **Part 2:** the two cards, rows 3 and 14.
- **Not this feature:** rows 8 and 11 (new work, to the planner), and the Duo before/after, which has no row in either
  plan, so it isn't built (logged in `specs/decisions/video-shots-brief.md`).
