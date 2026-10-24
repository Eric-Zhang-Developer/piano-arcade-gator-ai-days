---
name: "Twinkle 13: an agent writes Mozart's 13th variation, played on the DGX"
depends_on: []
owns: ["spikes/twinkle-13/"]
assignee: "eric"
---

# Twinkle 13 (spike)

Mozart wrote 12 variations on "Ah vous dirai-je, Maman" (Twinkle), K. 265. **An agent writes the 13th**, and the
DGX-660 plays it through its own speakers. The question: can an agent write a variation that sounds good on the real
piano? It's for fun and for the wow, and the best take becomes a clip for the video.

This is throwaway evidence, like `piano-midi-spike`. No feature imports from `spikes/`. It's in no milestone, so no
worker picks it up: a session Eric starts runs it.

## Plan
1. **Source:** get a machine-readable score of K. 265 (MusicXML or MIDI) under any license decision 003 allows for
   committed files. Record the URL and license, and credit it in `CREDITS.md`.
2. **Study Mozart's moves:** compare the theme with Variation 12, and skim the variations between. List what Mozart
   changes (figuration, meter, mode, register, texture, tempo), each with the bars where it happens. Read it from the
   score, not from memory.
3. **Write a transform script** that takes Variation 12 and produces the outputs below. The agent writes code that
   transforms notes. It doesn't write the notes of a piece freehand: the melody has to survive.
4. **A small player:** it plays a `.mid` file to the piano. Copy the piano spike's lessons, not its code: the port
   is named `Portable Grand`; send GM System On first; on stop or Ctrl-C, send All Notes Off (CC 123) on all 16
   channels.
5. **Eric listens** and rates each output. Write `RESULTS.md`.

## Requirements
**Outputs** (`.mid` files in `spikes/twinkle-13/out/`, committed, played in this order):
1. **Theme:** Mozart's theme as written, from the source.
2. **Variation 12:** as written, from the source.
3. **Small remixes of 12:** two or three. Each changes one thing, and its name says what. For example: the band
   underneath (drums on channel 10, bass on channel 2, a GM program change), a mode change, or a reharmonization.
   Small means the original is obvious on first listen.
4. **Variation 13:** unhinged, and beautiful in a good way. It builds on the moves Mozart made across the variations
   (from step 2) and takes them further than a human could play: runs and textures no two hands can manage, the band,
   a reharmonization, whatever serves it. The Twinkle melody must still be recognizable at some point. Make up to
   three tries (`13a`, `13b`, `13c`) and keep the one Eric likes best.

**Constraints:**
- The DGX receives on all 16 channels with 192-note polyphony (piano spike, Known facts). Drums on channel 10 and bass
  on channel 2 sounded distinct (`spikes/piano-midi/RESULTS.md`, R5).
- Stopping at any point leaves no stuck notes.
- Each output's MIDI file name and a one-line description go in `RESULTS.md`.

**Files:**
- `SOURCE.md`: the URL, the license, and the date retrieved.
- `analysis.md`: Mozart's moves, from step 2.
- The transform script and the player, both Python with `mido`, in a venv that isn't committed.
- `out/`: the MIDI files.
- `RESULTS.md`.

## Validation
- Run the player for each output -> it plays through the piano's speakers, in order, with no stuck notes after
  Ctrl-C.
- **Eric at the piano** (a person runs this): listen to each output, then rate it from 1 to 5 and answer "is the
  melody recognizable? yes or no". Write both in `RESULTS.md`, in Eric's words.
- Proof to keep: `RESULTS.md` with the ratings, the committed `.mid` files, and a phone recording of the best
  Variation 13. Keep the recording out of git and note its file name in `RESULTS.md`.
- `verify.py` doesn't cover spikes: the done note says `not verified` and points at `RESULTS.md`.

## Defaults
- Prefer the smaller, reversible option. No app code, no `web/` changes.
- If the source's notes look wrong (the wrong note count, or missing bars), fix them only by checking against a
  scanned public-domain edition on IMSLP, and log each fix in `SOURCE.md`.
- If every Variation 13 rates 2 or lower, say so in `RESULTS.md`. That's a valid answer to the question.
- Recordings of other performers are fine as local reference (decision 003). Never commit them.
