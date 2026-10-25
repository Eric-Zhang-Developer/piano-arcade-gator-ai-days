# Visual direction

First decided by the planning agent on Eric's word ("you choose what is best", 2026-10-24), from the five reference
studies in `specs/context/reference-notes/`. **Restyled to Duo** by Eric and Andres together on 2026-10-25, from the
frames in `specs/context/mood-frames/codex-cyberpunk-duo/` (`F-duo-1-select`, `F-duo-2-playfield`,
`F-duo-3-results`); the reasoning is in `specs/context/dialogues/2026-10-25-what-are-we-building.md`. It applies to
both lanes: the game here, and `/learn` in Andres's own folder. Every frontend spec follows this file. Change it
through a `contract:` PR, which Eric sees.

## The idea
**"A machine that hears every note, and a reason to play one more time."** Tasteful cyberpunk: an instrument-grade
HUD, like Formula 1 telemetry or Valorant's interface, applied to a piano. Mostly empty dark space, 1px hairlines,
small corner brackets, small monospace caps for data, big condensed numerals for the combo, the score and the rank.
Color is saved for moments.

**Duo: the brand is two hands.** Electric blue is the right hand and the primary color; purple is the left hand and
the secondary. The menu, the notes, the keys and the LED strip all speak the same two colors.

**Synthesia at the center.** The playfield (lanes, notes, the hit line, the keys) stays Synthesia's: black, glowing
rounded notes, a white-hot flare where a note meets the line. It's calm, because 88 thin lanes only stay readable when
they're calm. The arcade heritage lives in the big numbers, the rank stamp and the energy of the moments, never in
clutter.

**Retired as the brand:** the synthwave sun, the grid floor, magenta *chrome* (pink returns as hype, for moments
only), and italic everywhere. Fever may keep a
short stage moment as a reward (see Motion), **without the sun or the grid**.

**The synthwave sun and grid floor are gone everywhere, fever included.** Eric, 2026-10-25: "Did the sun come back?
The synthwave sun. I hate it. I thought it got nuked.", then "reTire the damn grid too." No screen, stage, fever
moment, burst or background draws either, and no spec may bring them back. `--pa-sun` and `--pa-sky` are allowed
nowhere. FEVER itself stays: the gauge, the word and the edge glow.

**Calm center, loud edges, loud moments.** Loudness lives at the screen's edges and in short moments (fever, full
combo, the rank, a new record), never in the lanes while notes are falling.

## Color
One meaning per color. Tokens are CSS variables (`ui-tokens` defines them) and the same values in TypeScript for
canvas code.

| Token | Value | Means | Never |
|---|---|---|---|
| `--pa-bg` | `#030607` | The playfield and every screen's base | |
| `--pa-hand-r` / `--pa-primary` | `#2B9BFF` (electric blue) | Right-hand notes and the keys they light; primary buttons, focus, the main highlights | Judgments |
| `--pa-hand-l` / `--pa-secondary` | `#A07CFF` (purple) | Left-hand notes and the keys they light; secondary accents | Judgments |
| `--pa-flare` | `#ffffff` | The note head, the hit flare, and the hit line: white-hot with a faint purple-to-blue glow | |
| `--pa-miss` | `#8A8F98` (grey) | MISS | Notes, interface chrome |
| `--pa-wrong` | `#ff4d5e` | WRONG, always with a ✕. **The only red.** Notes never use red | Anything else |
| `--pa-gold` | `#ffe27a` | PERFECT, the rank, records | The playfield, interface chrome |
| `--pa-good` | `#7cb7ff` | GOOD | |
| `--pa-panel` | `#0A0D15` | HUD and card panels | |
| `--pa-line` | `--pa-ink-dim` at about 25% | 1px hairlines and frames | |
| `--pa-ink` / `--pa-ink-dim` | `#E2E6F0` / `#7D8496` | Text | |
| `--pa-paper` / `--pa-paper-ink` | warm off-white / black ink (exact values: the sheet-paper feature picks and logs them) | The paper panel sheet music sits on (below) | Anything but notation |
| `--pa-hype` (alias `--pa-magenta`) | `#ff2fd0` (hype pink, unchanged) | **Hype: the arcade's big moments only,** game lane only (below) | Notes, lanes, keys, the hit line, buttons, focus, panels, judgments, `/learn` |
| `--pa-cyan` | retired as chrome | Its uses move to `--pa-primary`; the name goes once nothing reads it | New uses |
| `--pa-sun`, `--pa-sky` | retired | Nothing: the sun and the grid are gone (above) | Any use; the names go once nothing reads them |
| Tier colors | x1 `#e8e8ec`, x2 `#ff9f43`, x3 `#8ee05e`, x4 `#c47cff` | The multiplier (the HUD's, from Guitar Hero) | |

- **Notes:** hue is the hand, brightness is time to hit. A note far from the line is dim (about 35% of full
  brightness), brightens as it falls, and its head is white-hot at the line. (Synthesia colors by time alone; we
  need hue for the hand once charts use both.)
- **Never color alone:** every state color also has a word, glyph or shape (the HUD's labels, a ✕ on WRONG).
- **The 2026-10-25 restyle repaints these:** `--pa-bg`, `--pa-panel`, `--pa-ink`, `--pa-ink-dim`, `--pa-hand-r`,
  `--pa-hand-l` and `--pa-miss`, and adds `--pa-primary`, `--pa-secondary`, `--pa-line` and the paper pair. GOOD, the
  tier colors and the rest keep their values. The TypeScript mirror (`ui-tokens`) and the hand colors that drive the
  notes and the LED strip change with them.
- **Hype pink is the third color, for moments** (Eric, 2026-10-25: "I love this pink. Let's add it… just for tiny
  moments, like hype"). Its uses, about five, and no more: the stage card's ARE YOU READY rules (as now), fever
  starting, full combo, NEW RECORD, the rank reveal, combo milestone flashes on the combo bracket (50, 100, …), and
  the cold open's title card if there is one. If it spreads past these, it stops meaning "moment". The playfield stays
  two-color, one per hand. **Game lane only:** `/learn` stays two-color.
- **Judgment colors are news:** gold, red and grey appear only for judgments and moments, never as interface chrome.
  The resting screen is black, blue and purple. Acid yellow is rejected outright.
- **Hand colors on chrome are allowed now** (Duo makes the hands the brand), but a button never looks like a note:
  buttons are sharp rectangles, notes are rounded pills in the lanes.

## Shape
- **Zero corner radius on every interface element:** buttons, panels, cards, rows, data cells, focus rings, badges.
- **Only physical objects keep slight rounding:** note pills (about 2px) and piano keys (the real key's shape).
- Frames are 1px hairlines in `--pa-line`; corner brackets mark what matters (the focused song, the combo, the rank).

## Sheet music: a lit music stand on a dark stage
Wherever music is read (sheet-view, practice, the results' score strip), the score sits on a **paper panel**: black
ink on warm off-white (`--pa-paper`), sharp corners, inside the dark UI. Notation is never inverted to light-on-dark:
Eric, a pianist, finds dark-mode notation uneasy to read. A glowing piano-roll or score thumbnail is fine on the song
picker, where nobody reads it. The details of the sheet player are Eric's or Andres's to refine.

## Type
- **Display:** Saira (Google Fonts, OFL), through `next/font`, so no new dependency. **Upright and condensed** (its
  width axis, about 75) at 600 to 800, for the combo, the score, counts, the rank and titles. No italic. If it fails
  to load, the fallback is `system-ui` 700.
- **Data:** a monospace in small caps with wide tracking (`JetBrains Mono` or `IBM Plex Mono` through `next/font`,
  else `ui-monospace`), for labels, levels, bar numbers, ms and hints: `LV 05`, `BAR 14 / 32`, `−3 MS`.
- **Body:** `system-ui`, for composers and help text. Anything read at length (the tutor's line, `/learn`) may use a
  reading face the learning lane picks.
- **No pixel fonts** (`mission.md`: pixel art isn't the medium).
- **Readable on video:** anything the viewer must read is at least 24 px at 1920×1080 (16 px at 1280×720).

## Motion
- **The center doesn't move** except the notes. Effects rise above the hit line and never cover a note due within
  500 ms (juice-visual's rule).
- **Moments are short:** fever starts, full combo, the rank stamp, a new record: big, at most 2 s, then out of the
  way. Fever's moment is the gauge, the word and the edge glow; the old stage's sun, grid and sky
  don't come back.
- **Juice is motion, not furniture:** hit sparks that burst up from the hit line, the flare, a combo pulse.
- **Interface motion:** 150–250 ms, ease-out. A stamp: about 300 ms with a slight overshoot. A tally: at most 1.2 s
  in total.
- **Reduced motion:** every animation has a static end state, shown at once.

## The screens (the video's shot list, tentative)
0. **The cold open** is shot on the playfield and the LED strip: black room, the strip lights, the combo climbs.
1. **Music select** (`/`): sharp hairline rows with a piano-roll thumbnail drawn from the chart in the two hand
   colors; the focused song in a bracketed panel with data cells (`LV`, `NOTES`, `BEST`); a tutor strip ("Next for
   you: bars X–Y", only from a real take); one PLAY plus PRACTICE. Keyboard first.
2. **Stage card:** "ARE YOU READY", the song, its level, then the count-in. Chunithm's opening card is the model.
3. **Play:** the playfield as above, a bracketed song tag top left (`BAR 14 / 32` and a progress line) and the
   bracketed combo and score top right. No stage behind it except fever's moment.
4. **Results:** data cells (the counts, ACC, MAX COMBO), a per-bar strip with the weakest bars bracketed, a timing
   histogram, the score strip on paper, and a tutor panel with one primary "PRACTICE BARS X–Y". The rank still stamps.

## Do and don't
- **Do:** black playfield; rounded note pills sized to their key (narrower on black keys); a white-hot full-width hit
  line; judgments and combo off the lanes; sharp interface corners; one loud thing at a time.
- **Don't:** red notes; gold, red or grey as chrome; a fourth color (no yellow, no cyan); hype pink outside its moments; rounded
  buttons or panels; notation inverted to light-on-dark; neon soup (everything glowing); the synthwave sun or grid floor
  anywhere; italic everywhere; recolor every note in fever (Guitar Hero's star-power mistake hides the hands);
  strong perspective on the highway; glitch effects; pixel art; images of other games or artists' covers on jackets;
  emoji as icons.
- **The frames are moods, not data:** never copy a number, bar or label from them.

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
