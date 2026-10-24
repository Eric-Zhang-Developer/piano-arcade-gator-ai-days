# Visual direction

Decided by the planning agent on Eric's word ("you choose what is best", 2026-10-24), from the five reference
studies in `specs/context/reference-notes/`. Every frontend spec follows this file. Change it through a `contract:`
PR, which Eric sees.

## The idea
**Synthesia at the center, an arcade cabinet around it.** The playfield (lanes, notes, the hit line, the keys) is
Synthesia's: black, glowing rounded notes, a white-hot flare where a note meets the line. It's calm, because 88 thin
lanes only stay readable when they're calm. Everything around it is the arcade: a HUD panel off the playfield, a huge
combo, tier colors, the synthwave stage, screens that feel like a cabinet.

**Calm center, loud edges, loud moments.** Loudness lives at the screen's edges and in short moments (fever, full
combo, the rank, a new record), never in the lanes while notes are falling.

## Color
One meaning per color. Tokens are CSS variables (`ui-tokens` defines them) and the same values in TypeScript for
canvas code.

| Token | Value | Means | Never |
|---|---|---|---|
| `--pa-bg` | `#000000` | The playfield and every screen's base | |
| `--pa-hand-r` | `#5ef2c4` (mint, today's note color) | Right-hand notes, and the keys they light | Chrome or text |
| `--pa-hand-l` | `#6aa8ff` (azure) | Left-hand notes, and the keys they light | Chrome or text |
| `--pa-flare` | `#ffffff` | The note head and the hit flare: the moment to press | |
| `--pa-miss` | `#c98a9a` | MISS | Notes |
| `--pa-wrong` | `#ff4d5e` | WRONG. **The only red.** Notes never use red | Anything else |
| `--pa-gold` | `#ffe27a` | PERFECT, the rank, records | The playfield |
| `--pa-good` | `#7cb7ff` | GOOD | |
| `--pa-panel` | `rgba(12, 12, 16, 0.72)` | HUD and card panels | |
| `--pa-ink` / `--pa-ink-dim` | `#f2f2f5` / `rgba(242, 242, 245, 0.6)` | Text | |
| `--pa-magenta` | `#ff2fd0` | Cabinet chrome: the stage grid, frames, focus rings | Notes |
| `--pa-cyan` | `#27e1ff` | Cabinet chrome: secondary accents, selection | Notes |
| `--pa-sun` | `#ffb02e`, sun gradient `#ffe66b` → `#ff3fa4` | Fever, the stage's sun | |
| `--pa-sky` | `#0b0220` | The stage's sky; cabinet backgrounds | The playfield |
| Tier colors | x1 `#e8e8ec`, x2 `#ff9f43`, x3 `#8ee05e`, x4 `#c47cff` | The multiplier (the HUD's, from Guitar Hero) | |

- **Notes:** hue is the hand, brightness is time to hit. A note far from the line is dim (about 35% of full
  brightness), brightens as it falls, and its head is white-hot at the line. (Synthesia colors by time alone; we
  need hue for the hand once charts use both.)
- **Never color alone:** every state color also has a word, glyph or shape (the HUD's labels, a ✕ on WRONG).
- **Values that already exist keep their value.** These tokens name them; they don't repaint them.

## Type
- **Display:** Saira (Google Fonts, OFL), through `next/font`, so no new dependency. 700 to 900 weight. Numbers
  and titles in italic: the combo, the score, counts, the rank, song titles on cards. If it fails to load, the
  fallback is `system-ui` 800.
- **Body:** `system-ui`. Labels, composers, help text.
- **No pixel fonts** (`mission.md`: pixel art isn't the medium).
- **Readable on video:** anything the viewer must read is at least 24 px at 1920×1080 (16 px at 1280×720).

## Motion
- **The center doesn't move** except the notes. Effects rise above the hit line and never cover a note due within
  500 ms (juice-visual's rule).
- **Moments are short:** fever starts, full combo, the rank stamp, a new record: big, at most 2 s, then out of the
  way.
- **Interface motion:** 150–250 ms, ease-out. A stamp: about 300 ms with a slight overshoot. A tally: at most 1.2 s
  in total.
- **Reduced motion:** every animation has a static end state, shown at once.

## The screens (the video's shot list, tentative)
1. **Music select** (`/`): song cards with a generated jacket (gradient and type, no images), the level badge, the
   focused card larger. Keyboard first.
2. **Stage card:** "ARE YOU READY", the song, its level, then the count-in. Chunithm's opening card is the model.
3. **Play:** the playfield as above, the HUD panel at the top edge, the stage behind.
4. **Results:** a ceremony. Counts tally up, the rank stamps down in gold, then panels (the take graph).

## Do and don't
- **Do:** black playfield; rounded note pills sized to their key (narrower on black keys); a glowing full-width hit
  line; judgments and combo off the lanes; one loud thing at a time.
- **Don't:** red notes; mint or azure on chrome; recolor every note in fever (Guitar Hero's star-power mistake hides
  the hands); strong perspective on the highway; pixel art; images of other games or artists' covers on jackets;
  emoji as icons.

## Reference frames
The frames themselves are screenshots of commercial games, so they stay local and out of git (decision 003). On
Eric's Mac they're at `/Users/ericzhang/code/hackathons/gator-ai-days-2026/specs/context/references/<study>/`,
named by timestamp. Agents running there can open them; the notes in `specs/context/reference-notes/` describe every
frame, for anyone who can't. Start with `synthesia-brahms` 0m18s (the playfield), `chunithm-hands` 0m30s (HUD and
combo) and `chunithm-chart` 0m01s (the stage card).

## How a frontend change is checked
Build with the `frontend-design` skill. Review with taste v2 (`design-taste-frontend`, installed locally in
`.claude/skills/` of Eric's main checkout, not in git): its step 8, "Look", only. Screenshots at 1280×720 and
1920×1080, plus reduced motion, scored with its `references/critique.md`; fix the top three problems; at most three
rounds. Skip its `draw.mjs`: this file sets the direction. Before and after screenshots go in the PR.
