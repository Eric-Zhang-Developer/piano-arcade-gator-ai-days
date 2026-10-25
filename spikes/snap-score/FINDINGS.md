# Snap a score: findings

Spike: `specs/features/snap-score-spike/spec.md` (issue #518). Worker eric-agent-6. Runs on 2026-10-25, 05:57–06:03 ET,
one call at a time: `claude-opus-5-5` over the Messages API, effort `high`, structured output, the prompt in
`prompt.md`. The measurement choices the spec leaves open are in `specs/decisions/snap-score-spike-measure.md`.

## Answer

**Not yet a yes, on clean renders. Photos pending.** All three clean pages read at 98.7–100% of the committed notes,
but only one of them meets every part of the spec's yes:

- **minuet-g:** 100%, and the no-image recall control is also 100%. By the spec this is memory, not reading, so it
  doesn't count.
- **ode-to-joy:** 99.2%, against a recall floor of 1.6%. This is real reading. But the chart fails the library's
  rules, because the page is a four-voice hymn and the reader took all four voices (see What didn't).
- **fur-elise:** 98.7%, rules pass, recall 92.6%. The read beats recall, and the 11 notes recall misses are the
  edition's own hand split, which only the page shows. But recall alone is over the 90% bar.

That's 1 clean pass of 3 against a bar of 2. No phone photo has been read yet, and photos are the question the spec
asks.

**Recommendation: iterate, one more time box.** The model reads printed notes almost perfectly, so what's still open
is the photos and the test design, not the reader. The next box needs:
1. Eric's three phone photos (`<chart id>.photo.jpg` in `local/`, about 5 minutes).
2. One prompt line for hymn pages: one voice per staff, the top of the treble and the bottom of the bass. That's the
   committed chart's own rule (its source line), and it makes ode-to-joy a piano level.
3. In place of minuet-g, a library piece the recall control can't write.

The case against iterating: the clean reads already reach 99–100% where the model can't be recalling (ode), so photos
may be the only real unknown. A photo-only rerun would then be enough.

## The table

`node spikes/snap-score/score.mjs`. Share is `forge diff`'s share of committed notes matched on pitch, hand and beat
(within 1/12), over the beats both charts cover. The committed chart has its written-out repeats cut first (decision
above). Rules is level-forge's `check.test.ts`, run on the snapped chart.

| Piece | Image | Share | Shifted | Matched | Forged unmatched | Rules | Tokens | Seconds | Attempts |
|---|---|---|---|---|---|---|---|---|---|
| fur-elise | clean | 0.9866 | same | 147/149 | 0 | pass | 5623 in, 10841 out | 81.9 | 1 |
| fur-elise | recall | 0.9262 | same | 138/149 | 8 | pass | 666 in, 8317 out | 67.6 | 1 |
| fur-elise | photo | pending | | | | | | | |
| minuet-g | clean | 1 | same | 64/64 | 37 | pass | 5623 in, 7545 out | 51.6 | 1 |
| minuet-g | recall | 1 | same | 64/64 | 37 | pass | 692 in, 8502 out | 62.5 | 1 |
| minuet-g | photo | pending | | | | | | | |
| ode-to-joy | clean | 0.9918 | same | 121/122 | 117 | fail | 5623 in, 8829 out | 64.6 | 1 |
| ode-to-joy | recall | 0.0164 | 0.1066 (+4 beats) | 13/122 | 68 | pass | 670 in, 3500 out | 34.6 | 1 |
| ode-to-joy | photo | pending | | | | | | | |

The forged unmatched counts are extra notes, not errors. minuet-g's committed chart is the right hand only, so the
left hand's 37 notes have nothing to match. ode-to-joy's 117 are the alto and tenor. Every call succeeded on the first
attempt, with no refusal, no cut-off and no unparseable reply.

## What worked

- **Pitch, rhythm and hand, almost note for note.** Across the three clean pages, 332 of 335 committed notes matched.
  The reader got the 3/8 sixteenths of Für Elise, the pickup bars (a negative beat padded to bar 0 lined up with no
  shift on every page), and the key signature with its accidentals. It also got Für Elise's cross-staff E–D♯ run in
  bars 13–15, which the edition splits between the hands. Recall put all of that run in the right hand.
- **The recall control does its job.** It separates the three pieces cleanly: total memory (minuet-g), none
  (ode-to-joy's SATB setting) and partial (Für Elise: the tune, not this edition's layout).
- **Structured output plus effort `high`.** Every reply parsed. A wrong chart could only have been a misreading.

## What didn't

- **Extra voices.** ode-to-joy's page is a four-voice hymn on a grand staff. The prompt asks for every notehead, so the
  reader returned the alto and tenor too. The left hand then spans 19 semitones at beat 59, and two voices share G4 at
  once (n196, n199). The library's rules fail on both. The committed chart keeps only the soprano and the bass.
- **One accidental.** ode-to-joy bar 10, the bass: the page's D♯ (51) was read as D (50). This is the only wrong
  pitch on three pages.
- **Form, not notes.** Für Elise's two misses are the E–D♯ pickup at beat 13. The committed chart plays it again to
  lead into its written-out repeat, while the page prints it once. Level-forge's findings report the same two notes
  for the same reason.
- **Not tested at all: clefs changing mid-page, ledger-line stacks, 8va, triplets.** None of these three pages has
  them. sheet-engraving's survey found them in maple-leaf-rag, mountain-king, nocturne, the-entertainer and
  moonlight-1.

## Cost

At Anthropic's published Opus 5.5 prices, as listed in Claude Code's bundled `claude-api` reference
(`shared/models.md`, read 2026-10-25): $4 per million input tokens and $20 per million output tokens. A clean page
costs about $0.17–0.24 and takes 52–82 s, almost all of it output (high effort's thinking counts as output). A
recall call's input is under 700 tokens, so most of a clean call's 5623 is the image. The six calls together came to about $1.03.

## What to keep

- `snap.mjs`: the reader, with no dependency and a self-test that checks the key never appears in output. It could
  seed a phase-2 server route as it stands: one `fetch`, one schema, two attempts.
- `score.mjs` and its verified `CUTS`: any later read of a library piece needs the same repeat handling.
- The recall control, as a standing guard in any phase 2 that scores famous pieces.

## Recipe

```bash
curl -sSLo spikes/snap-score/local/<id>.pdf <the piece's Mutopia letter PDF>
sips -s format png -Z 2200 spikes/snap-score/local/<id>.pdf --out spikes/snap-score/local/<id>.clean.png
node --env-file=<main checkout>/web/.env.local spikes/snap-score/snap.mjs spikes/snap-score/local/<id>.clean.png \
  --id <id> --bpm <bpm> --title "<t>" --composer "<c>" --source "<source line>" --out spikes/snap-score/local/
node --env-file=<main checkout>/web/.env.local spikes/snap-score/snap.mjs --recall --id <id> ...
node spikes/snap-score/score.mjs
```

The PDFs came from Mutopia's piece pages: `BachJS/BWVAnh114/anna-magdalena-04` (minuet-g), `BeethovenLv/ode`
(ode-to-joy) and `BeethovenLv/WoO59/fur_Elise_WoO59` (fur-elise). A photo runs the same way with
`local/<id>.photo.jpg` in place of the render.
