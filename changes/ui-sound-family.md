## What shipped
The menu sounds as one soft family (#1167): a synthesized celesta for move, confirm, back and the sting, and a woodblock for the countdown ticks. Move walks up the focused song's scale, its key inferred from the notes. Every sound sits 18 dB under the song preview, attacks over 3 ms or more and ends on a zero. Fast repeats steal the oldest voice with a fade, under a voice cap. A Lab A/B (`?x=ui-sounds-ab`) plays old against new with overlaid traces.
## Where it lives
`web/src/game/ui-sounds/` (timbre.ts is the pure part) · `web/src/game/x/ui-sounds-ab/` (legacy.ts, measure.ts, the A/B) · `Song.key` in `song-select/load.ts` · `specs/features/ui-sound-family/measurements.md` and `shots/` · `specs/decisions/ui-sound-family-key.md`, `-timbre.md`
## How to check it
Unit: `pnpm -C web exec vitest run src/game/ui-sounds src/game/x/ui-sounds-ab` (15 pass). `UI_TABLE=1` rewrites the before/after tables, and `UI_SHOTS=1` redraws the images. `verify-ui-sounds.mjs`: not verified locally; covered by main's scheduled full run.
## Gaps
Not heard by Eric: the A/B listen at `/play?song=twinkle&x=ui-sounds-ab`, and arrowing through the select. Every value was picked by measurement, not by ear. 18 dB under may prove too quiet; `underPreviewDb` is the knob. The timbre is synthesized, not sampled, and the key is inferred, not read from the score. With the DGX, the UI sounds still come from the laptop.
