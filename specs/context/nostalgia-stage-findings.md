# NOSTALGIA stage: measured findings

For `stage-view` (#875), measured by a research subagent on 2026-10-25 from
`video-references/[ノスタルジア Op.3] FLOWER (BEMANI SYMPHONY NOSTALGIA mix) Real 998kFC [OoY-uM81mWc].mp4`
(local only, never committed) and `specs/context/reference-notes/nostalgia-flower.md`.
Text only: no frame from the video is in the repo.

## How it was measured

- The file is 1706×1440 at 60 fps, 179.4 s long.
- **Coordinates:** x is a fraction of the width and y a fraction of the full frame's height.
  - The full frame includes the player's keyboard below the game screen.
  - The game screen is the top 16:9, y 0 to 0.667. That's a reading of the frame, not a measurement (see
    `specs/decisions/stage-view-geometry.md`).
- Values come from frame luma (ffmpeg rawvideo and Python), except those marked "visual".
- **Timing error:** the capture duplicates or drops a frame now and then, so single times are ±1 frame (±17 ms).
- **Play:**
  - first note faintly visible at 0:20.83, first hit at 0:21.87, last hit at 2:38.95;
  - the Full Combo sequence runs 2:40.45–2:44.40;
  - result: ◆Just 1709, Just 8, Good 1, Max Combo 1718.

## The lane is a hill

- **Path:**
  - notes appear dim on a back slope (y≈0.17);
  - they rise to a crest at **y=0.045**;
  - then they slide down the front face to the bar.
- **Bar:** centred at **y=0.555** (band 0.542–0.567), spanning x 0.005–0.995.
- **Strip keys:** 28 below the bar, 0.0357 apart.
- **Field width,** from beat-line extents:
  - fit: W(y) = 0.589 + 0.9625y − 0.4543y² (max residual 0.005), giving 0.98 at the bar;
  - at the crest the width stalls at 0.55–0.59 while y holds for about 3 frames.

  | y | 0.087 | 0.135 | 0.207 | 0.296 | 0.402 | 0.490 | 0.522 |
  |---|---|---|---|---|---|---|---|
  | width | 0.664 | 0.713 | 0.771 | 0.832 | 0.900 | 0.953 | 0.970 |

- **Paths curve outward:**
  - a note keeps a fixed fraction u of the half-width (x = 0.5 + u·W/2, u constant to ±0.002), so its path arches
    out as the field widens;
  - notes sit at continuous x, not in lanes.
- **Guides:**
  - 10 decorative arched guides; at y=0.50 they sit at x 0.031, 0.129, 0.229, 0.332, 0.432 | 0.569, 0.669, 0.773,
    0.872, 0.972;
  - their tops are near y≈0.079 (visual).
- **Note size:**
  - width about 0.05–0.06 at the crest and 0.100 at the bar;
  - thickness 0.015 → 0.021 of the height.

## Approach

- **First faint sighting to the bar:** 1033 ms, on 3 notes, with no spread. A viewer probably notices them a little
  later, at about 0.9–1.03 s.
- **Crest to bar:**
  - about 500–517 ms on 6 notes (range 490–550);
  - beat lines take exactly 30 frames (500 ms).
- **y=0.10 to bar:** 333 ms.
- **Constant speed:** the per-frame steps are identical on 25 beat lines across the song, so there are no hi-speed
  changes. "×2.7" stays in the margin, probably the hi-speed setting (unconfirmed).
- **Front face:** y(τ) = 0.5606 + 2.083τ + 2.095τ², with τ the seconds to the hit (negative).
  - Max residual 0.0035; vertex at τ = −0.497 s, y = 0.043.
  - Screen speed roughly triples from the crest to the bar.
- **Back slope:** slower, easing into the crest.
  - On one note (A-left, hit 0:21.87): 0:20.83 → 0.173, 0:21.00 → 0.118, 0:21.07 → 0.099, 0:21.20 → 0.068,
    0:21.37 → 0.046.
  - Fit for `/stage`: y = 0.0592 + 0.1548τ + 0.2545τ², max residual 0.002, meeting the front fit at the crest.
- **Measured note (A-right, u≈0.604):**

  | time | x | y |
  |---|---|---|
  | 0:21.38 | 0.674 | 0.047 |
  | 0:21.70 | 0.742 | 0.249 |
  | 0:21.82 | 0.783 | 0.462 |

## Hit effects

Measured on the hit at 1:39.92. Every effect starts the frame after the note reaches the bar.

| effect | look | size | timing |
|---|---|---|---|
| Pillar | teal-grey top, pink middle, gold base | 0.108 W × 0.17 H, bar up to y≈0.375 | fades linearly, about 250 ms |
| Starburst | gold ring, diamond spikes, fine radiating lines | ring 0.064 → 0.097 W; spikes 0.146 W × 0.174 H | bright 150 ms; ring tail to about 330 ms |
| "JUST" | white serif, pink outline | 0.064 W × 0.022 H, at y≈0.463 | about 415 ms |
| Strip key light | teal | — | about 200 ms; it shows key-down, not a hit |

**Tiers:** every label seen reads "JUST". The 9 hits that weren't ◆Just weren't found, so how the tiers look
different is unknown.

## Combo and milestones

- **Combo:** serif digits at the top centre, x 0.427–0.573, y 0.099–0.167; a small "combo" label at y 0.078.
- **Milestone ghost, every 100:**
  - a grey translucent copy of the number appears at the same size, grows to about 1.65× and fades out in about
    500–530 ms;
  - seen at 600 (1:18.83) and 1600 (2:32.60).
- **Rank C** (2:07.10): a badge fades in at the centre (y≈0.29).

## End of a full combo

| time | what shows |
|---|---|
| 2:38.95 | the last hit; a purple-white glow wash, full width, over y≈0.29–0.57 (visual) |
| 2:39.20 | the wash peaks |
| 2:39.95 | the wash is gone (about 1.0 s in total) |
| 2:40.65–2:40.90 | "Full Combo!" script writes in at y≈0.26, x 0.17–0.81 |
| 2:43.25 | the banner starts to fade |
| 2:44.40 | the banner is gone |

On screen about 3.75 s in all. The field fades out around 2:40.6.

## Audio

Method: 20 ms RMS, full band and above 5 kHz, plus spectrograms. The A/V offset is assumed to be about 0.

- **Milestones (600, 1600):** nothing detectable over the song. A quiet sound mixed under the music can't be ruled
  out.
- **Full Combo:**
  - a click at 2:40.45;
  - music-box-like tones at about 2:40.61, 2:41.11, 2:41.58, 2:42.03 and 2:42.58 (about 1.4–2.1 kHz, ±10%);
  - a sustained chord with tremolo from 2:43.23 to 2:44.40;
  - a transient at the wipe, 2:44.5.

## Heavy or not

Not heavy, so no spike is needed. All of this fits plain Canvas 2D at 60 fps:

- **Curve:** closed-form (y quadratic in time, x = 0.5 + u·W(y)/2).
- **Effects:** gradients and simple shapes with alpha and `lighter` compositing, about 10–20 at once.
- **The one trap:** per-frame `shadowBlur` or a filter blur at 1080p. Draw glows as gradients instead.
