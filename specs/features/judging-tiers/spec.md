---
name: "Judging tiers: a GOOD tier that keeps the combo, early/late labels, and wrong notes that break it"
depends_on: ["core-loop", "timing-feedback"]
owns: ["web/src/game/core/judge.ts", "web/src/game/core/judge.test.ts", "web/src/game/core/highway.ts", "web/src/game/core/settings.ts", "web/src/game/timing/", "web/src/app/play/page.tsx", "web/e2e/"]
assignee: "eric"
---

# Judging tiers

With the beat, Eric scored 71.4% on one-hand Twinkle, and nearly every miss was the right key just outside ±50 ms
(`specs/context/findings.md`). The judging treated a right key 60 ms late the same as a wrong key or silence: a MISS
plus an extra, combo broken. Musically that's backwards. A listener barely hears 60 ms in a simple melody, but hears
a wrong key at once. Eric's rule: punish wrong notes and outright misses; be gentle with slightly-off timing.
Decision `judging-tiers-punish-what-sounds-wrong.md`; the rule itself is in `mission.md`.

## Requirements
- **Tiers** (`mission.md`): PERFECT ≤ 25 ms, GREAT ≤ 50 ms, GOOD ≤ `GOOD_MS` (100 ms, a setting in
  `web/src/game/core/settings.ts`), each bound counting as the better tier. A note with no matching key within
  `GOOD_MS` is a MISS. Matching is unchanged otherwise: nearest unmatched note of the same pitch, one-to-one.
- **WRONG notes:** an extra (a press that matches no note) is WRONG unless a note of the same pitch is within
  `NEAR_MISS_MS` (150 ms, shared with timing-feedback) of it, or it falls before the first note's time −`GOOD_MS` or
  after the last note's time +`GOOD_MS`. A WRONG note emits `wrongNote { pitch }` (after `extra`), is listed in
  `Results.wrong`, and counts in `counts.wrong`.
- **Combo:** PERFECT, GREAT and GOOD continue it; MISS and WRONG reset it. Fever ends at the next MISS or WRONG.
  `fullCombo` needs no MISS and no WRONG.
- **Accuracy** = (PERFECT + 0.5 × GREAT + 0.25 × GOOD) / (notes + WRONG). Rank thresholds unchanged. The GOOD weight is
  a named constant.
- **Live labels** (highway): GOOD gets its own color. GREAT and GOOD show which way and how far, as "EARLY −38 ms" /
  "LATE +72 ms"; PERFECT shows the signed ms as before. A WRONG note shows "WRONG" in a clearly different color. A GOOD
  note is consumed like any hit.
- **Results screen:** rows PERFECT, GREAT, GOOD, MISS, Wrong notes, Extra presses, Accuracy, Max combo, with
  `data-testid` `count-GOOD` and `count-wrong` added and `count-extra` kept (piano-sim's verify reads it).
- **Timing feedback:** hits now include GOOD; near misses lie between `GOOD_MS` and `NEAR_MISS_MS`; the near-miss
  line reads "N of M misses were within 150 ms".
- `[verify].command`: still the Perfect player; also fails unless GOOD and WRONG are 0.

## Validation
- `pnpm -C web test`, the synthetic players against Twinkle:
  - Perfect: all PERFECT, accuracy 100%, rank S, max combo = notes.
  - Skipper (drops notes 3 and 10): exactly 2 MISS, 0 WRONG, 0 extras.
  - Late40: all GREAT.
  - Late80: all GOOD, accuracy 25%, rank D, max combo = notes (GOOD keeps the combo).
  - Boundary: +25 → PERFECT, −50 → GREAT, +51 → GOOD, +100 → GOOD, +101 → MISS plus an extra that is not WRONG.
  - Wrong pitch: one note a semitone off at 0 ms → that note MISS, 1 WRONG, accuracy 41/43, and the combo breaks there.
  - Wrong then right: a wrong key 30 ms before a note, then the right key on time → the note is PERFECT, 1 WRONG, and
    the combo resets at the wrong key.
  - Count-in press: a key 1000 ms before the first note → an extra, not WRONG.
  - Fever: a WRONG note during fever emits `feverEnd`.
  - Timing summary: a press at +120 ms is a near miss; at +80 ms it's a GOOD hit, not a near miss.
- `[verify].command` passes.
- On the piano (Eric): play twice; record scores and how the new tiers felt in `findings.md`.

## Defaults
- Colors: GOOD a calm blue, WRONG a strong red, distinct from MISS. Take the smaller option; log choices in a
  `judging-tiers-*.md` decision.
