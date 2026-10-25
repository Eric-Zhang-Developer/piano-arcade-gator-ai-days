# hand-palette: the three candidates and how B and C were solved

**Context:** #1127. Under deutan, today's hands (`#2b9bff` and `#a07cff`) are 0.6 ΔE00 apart, which is below a JND. The spec asks for two or three palettes solved together: the hands, the five judgments and fever's amber.

**Method:**
- **Measure.** `web/src/game/x/hand-palette/color.ts` holds the measuring code:
  - **CIEDE2000.** It matches all 34 of Sharma, Wu & Dalal's 2005 test pairs to within 5e-5.
  - **CVD.** Machado 2009's severity-1.0 matrices, copied from the authors' table and applied in linear RGB.
  - **Check.** It reproduces #1127's numbers for today's hands exactly: 23.3, 4.6, 0.6 and 21.7.
- **Search.** A grid in OKLCH over L, C and h. The right hand stays the brand blue `#2b9bff` (Duo's primary). The left hand must sit within ±3 L* of it (±2.5 while searching), with C ≥ 0.14 so it stays electric. The score is the worst ratio to target over every pair the left hand is in, judgments and amber included.
- **What the search says:** every left hand that survives both protan and deutan is warm.
  - The best non-warm options are pale, near-grey violets and teals. Their worst pair is around 8–12.
  - Excluding orange, the best partner is red, and red is WRONG's (Duo: red only for WRONG).
  - So the left hand goes orange, which takes fever's amber (B), or rose (C).

**The candidates:**
- **A, "Today, plus the shape":** today's colors and the left-hand notch. It fixes nothing by color, and is there so Eric can keep the look and add the shape.
- **B, "Blue and orange":**
  - Left hand `#e6870a` (OKLCH 0.71 / 0.16 / 63°).
  - Fever moves from amber to the kit's hype magenta `#ff2fd0`. The hype token is already "the arcade's big moments only".
  - Hands are 53–70 apart under every vision, and every left-hand pair is at least 24% over its target.
  - Every target is met. The tightest pair is GOOD / AMBER under deutan: 8.3 against 8, about 4% over.
- **C, "Blue and rose":**
  - Left hand `#f34fc2` (OKLCH 0.69 / 0.23 / 342°). Fever keeps its amber.
  - Hands are 11.8 (protan) to 71.5 apart, and every left-hand pair is at least 17% over its target.
  - Every target is met. The tightest pair is PERFECT / AMBER under deutan: 8.8 against 8, today's pair and unchanged.
  - On screen, under protan and deutan, the rose reads as a pale blue beside the blue: the notch does more of the work than in B.
- **GREAT gets its own color in all three:** the HUD's mint `#5ef2c4`. Today the highway's GREAT word is handR, and that misses GOOD (table below).
- **Kit collisions to weigh:**
  - B gives fever the hype magenta.
  - C's rose sits near hype magenta. It's a note color, so hype would no longer be "big moments only".

## The table (ΔE00; targets: the hands 10 under all four, the rest 10 normal and 8 under a deficiency)

**A (today; GREAT is the HUD's mint, fever the gauge's amber):** R `#2b9bff`, PERFECT `#ffe27a`, GREAT `#5ef2c4`, GOOD `#7cb7ff`, MISS `#8a8f98`, WRONG `#ff4d5e`, L `#a07cff`, AMBER `#ffb02e`

| Pair | normal | protan | deutan | tritan | target |
|---|---|---|---|---|---|
| R / L | 23.3 | 4.6 | 0.6 | 21.7 | **missed** |
| PERFECT / GREAT | 32.1 | 14.6 | 20.4 | 41.5 | met |
| PERFECT / GOOD | 57.3 | 51.0 | 54.3 | 39.2 | met |
| PERFECT / MISS | 39.0 | 37.4 | 38.7 | 30.0 | met |
| PERFECT / WRONG | 50.5 | 33.9 | 19.9 | 33.8 | met |
| GREAT / GOOD | 37.7 | 37.0 | 31.2 | 12.8 | met |
| GREAT / MISS | 33.8 | 28.8 | 22.4 | 30.4 | met |
| GREAT / WRONG | 75.0 | 31.1 | 21.5 | 77.7 | met |
| GOOD / MISS | 20.8 | 20.9 | 20.6 | 22.6 | met |
| GOOD / WRONG | 47.4 | 40.6 | 47.8 | 78.9 | met |
| MISS / WRONG | 31.3 | 19.1 | 27.0 | 27.0 | met |
| R / AMBER | 55.8 | 59.0 | 63.7 | 63.0 | met |
| L / AMBER | 60.9 | 61.7 | 63.2 | 31.6 | met |
| PERFECT / AMBER | 15.9 | 11.3 | 8.8 | 14.9 | met |
| GREAT / AMBER | 44.3 | 21.8 | 23.8 | 58.3 | met |
| GOOD / AMBER | 50.4 | 53.6 | 56.5 | 49.7 | met |
| MISS / AMBER | 35.8 | 35.5 | 37.6 | 27.0 | met |
| WRONG / AMBER | 39.8 | 28.1 | 15.5 | 20.4 | met |

Hand L*: 62.7 and 60.9. Lowest fill contrast against `#030607`: 6.3:1.

**B (Blue and orange):** R `#2b9bff`, PERFECT `#ffe27a`, GREAT `#5ef2c4`, GOOD `#7cb7ff`, MISS `#8a8f98`, WRONG `#ff4d5e`, L `#e6870a`, AMBER `#ff2fd0`

| Pair | normal | protan | deutan | tritan | target |
|---|---|---|---|---|---|
| R / L | 53.2 | 57.1 | 61.7 | 69.6 | met |
| PERFECT / GREAT | 32.1 | 14.6 | 20.4 | 41.5 | met |
| PERFECT / GOOD | 57.3 | 51.0 | 54.3 | 39.2 | met |
| PERFECT / MISS | 39.0 | 37.4 | 38.7 | 30.0 | met |
| PERFECT / WRONG | 50.5 | 33.9 | 19.9 | 33.8 | met |
| GREAT / GOOD | 37.7 | 37.0 | 31.2 | 12.8 | met |
| GREAT / MISS | 33.8 | 28.8 | 22.4 | 30.4 | met |
| GREAT / WRONG | 75.0 | 31.1 | 21.5 | 77.7 | met |
| GOOD / MISS | 20.8 | 20.9 | 20.6 | 22.6 | met |
| GOOD / WRONG | 47.4 | 40.6 | 47.8 | 78.9 | met |
| MISS / WRONG | 31.3 | 19.1 | 27.0 | 27.0 | met |
| R / AMBER | 45.7 | 13.0 | 11.3 | 72.2 | met |
| L / AMBER | 55.1 | 57.5 | 48.8 | 13.1 | met |
| PERFECT / AMBER | 69.9 | 62.1 | 49.6 | 32.1 | met |
| GREAT / AMBER | 57.4 | 49.5 | 28.6 | 80.4 | met |
| GOOD / AMBER | 44.3 | 20.2 | 8.3 | 72.3 | met |
| MISS / AMBER | 28.4 | 21.2 | 13.3 | 19.9 | met |
| WRONG / AMBER | 25.1 | 38.5 | 41.0 | 9.3 | met |

Hand L*: 62.7 and 65.1. Lowest fill contrast against `#030607`: 6.3:1.

**C (Blue and rose):** R `#2b9bff`, PERFECT `#ffe27a`, GREAT `#5ef2c4`, GOOD `#7cb7ff`, MISS `#8a8f98`, WRONG `#ff4d5e`, L `#f34fc2`, AMBER `#ffb02e`

| Pair | normal | protan | deutan | tritan | target |
|---|---|---|---|---|---|
| R / L | 44.3 | 11.8 | 14.4 | 71.5 | met |
| PERFECT / GREAT | 32.1 | 14.6 | 20.4 | 41.5 | met |
| PERFECT / GOOD | 57.3 | 51.0 | 54.3 | 39.2 | met |
| PERFECT / MISS | 39.0 | 37.4 | 38.7 | 30.0 | met |
| PERFECT / WRONG | 50.5 | 33.9 | 19.9 | 33.8 | met |
| GREAT / GOOD | 37.7 | 37.0 | 31.2 | 12.8 | met |
| GREAT / MISS | 33.8 | 28.8 | 22.4 | 30.4 | met |
| GREAT / WRONG | 75.0 | 31.1 | 21.5 | 77.7 | met |
| GOOD / MISS | 20.8 | 20.9 | 20.6 | 22.6 | met |
| GOOD / WRONG | 47.4 | 40.6 | 47.8 | 78.9 | met |
| MISS / WRONG | 31.3 | 19.1 | 27.0 | 27.0 | met |
| R / AMBER | 55.8 | 59.0 | 63.7 | 63.0 | met |
| L / AMBER | 59.0 | 57.3 | 46.4 | 16.1 | met |
| PERFECT / AMBER | 15.9 | 11.3 | 8.8 | 14.9 | met |
| GREAT / AMBER | 44.3 | 21.8 | 23.8 | 58.3 | met |
| GOOD / AMBER | 50.4 | 53.6 | 56.5 | 49.7 | met |
| MISS / AMBER | 35.8 | 35.5 | 37.6 | 27.0 | met |
| WRONG / AMBER | 39.8 | 28.1 | 15.5 | 20.4 | met |

Hand L*: 62.7 and 60.4. Lowest fill contrast against `#030607`: 6.3:1.

Today's other GREAT, the highway's word (= handR `#2b9bff`): GREAT / GOOD 9.1, 8.3, 10.4, 5.8 (missed). Juice's fever glow `#ff8c3c` against A: every amber pair met.

## dataviz's validator (OKLab ΔE, adjacent pairs, against the HUD panel `#0a0d15`)
```
$ node validate_palette.js "#2b9bff,#a07cff,#ffe27a,#5ef2c4,#7cb7ff,#8a8f98,#ff4d5e,#ffb02e" --mode dark --surface "#0a0d15"

Palette (dark, surface #0a0d15, categorical): 8 slots
  [FAIL] Lightness band         outside band: [["#2b9bff",0.678],["#a07cff",0.68],["#ffe27a",0.916],["#5ef2c4",0.869],["#7cb7ff",0.768],["#ff4d5e",0.676],["#ffb02e",0.814]]
  [FAIL] Chroma floor           below floor (reads gray): [["#8a8f98",0.015]]
  [FAIL] CVD separation         worst adjacent #a07cff↔#2b9bff ΔE 0.7 (deutan) · tritan 10.7
  [FAIL] Normal-vision floor    worst adjacent #a07cff↔#2b9bff ΔE 13.3 (normal) — below 15, hard to tell apart even with full color vision
  [PASS] Contrast vs surface    all 8 >= 3:1
$ node validate_palette.js "#2b9bff,#e6870a,#ffe27a,#5ef2c4,#7cb7ff,#8a8f98,#ff4d5e,#ff2fd0" --mode dark --surface "#0a0d15"

Palette (dark, surface #0a0d15, categorical): 8 slots
  [FAIL] Lightness band         outside band: [["#2b9bff",0.678],["#e6870a",0.71],["#ffe27a",0.916],["#5ef2c4",0.869],["#7cb7ff",0.768],["#ff4d5e",0.676],["#ff2fd0",0.69]]
  [FAIL] Chroma floor           below floor (reads gray): [["#8a8f98",0.015]]
  [PASS] CVD separation         worst adjacent #5ef2c4↔#ffe27a ΔE 8.9 (protan) · tritan 5.6
  [PASS] Normal-vision floor    worst adjacent #8a8f98↔#7cb7ff ΔE 16.0 (normal)
  [PASS] Contrast vs surface    all 8 >= 3:1
$ node validate_palette.js "#2b9bff,#f34fc2,#ffe27a,#5ef2c4,#7cb7ff,#8a8f98,#ff4d5e,#ffb02e" --mode dark --surface "#0a0d15"

Palette (dark, surface #0a0d15, categorical): 8 slots
  [FAIL] Lightness band         outside band: [["#2b9bff",0.678],["#f34fc2",0.689],["#ffe27a",0.916],["#5ef2c4",0.869],["#7cb7ff",0.768],["#ff4d5e",0.676],["#ffb02e",0.814]]
  [FAIL] Chroma floor           below floor (reads gray): [["#8a8f98",0.015]]
  [PASS] CVD separation         worst adjacent #5ef2c4↔#ffe27a ΔE 8.9 (protan) · tritan 11.8
  [PASS] Normal-vision floor    worst adjacent #8a8f98↔#7cb7ff ΔE 16.0 (normal)
  [PASS] Contrast vs surface    all 8 >= 3:1
```
B and C pass its CVD separation and normal-vision floor, and A fails both. Its lightness band (0.48–0.67) and chroma floor are for chart marks on a chart surface. Here they flag the brand blue itself (0.678), the bright judgment colors and MISS's grey, which is grey on purpose. So they don't apply to this palette.

**How to undo:** the candidates are data in `candidates.ts`. Nothing outside the experiment reads them.
