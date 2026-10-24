# midi-to-chart

Turns a MIDI file **exported from notation** (Mutopia, an openly licensed MuseScore file) into a Piano Arcade chart.
Spec: `specs/features/song-pack-1/spec.md`.

## Install
```bash
cd game-tools/midi-to-chart && python3 -m venv .venv && .venv/bin/pip install mido
```
The venv isn't committed.

## Use
List the tracks first (notation MIDI has one per staff), then convert:
```bash
.venv/bin/python -c "import mido,sys; [print(i, t.name, sum(m.type=='note_on' for m in t)) for i,t in enumerate(mido.MidiFile(sys.argv[1]).tracks)]" song.mid
.venv/bin/python convert.py song.mid --rh 1 --lh 2 --bars 1-16 --bpm 80 \
  --id ode-to-joy --title "Ode to Joy" --composer "Ludwig van Beethoven" \
  --source "<URL>, <license>, <edition>" -o ../../web/public/songs/ode-to-joy/chart.json
.venv/bin/python convert.py --self-test
```
- `--bars` is 1-based and inclusive; a pickup bar is bar 1. Beats start at 0 on the first chosen bar.
- `--by-channel` reads `--rh`/`--lh` as MIDI channels across all tracks instead of track indices.
- `beatsPerBar` comes from the file's time signature at the first chosen bar (3/8 gives 1.5).

## What it refuses
- A file whose notes in the chosen bars fall off a 1/12-beat grid: that's a performance, not notation. It says how
  many notes did.
- A hand with no notes in the bar range.

## What it changes, and says so on stderr
- A pitch both hands play at the same beat is kept once (the longer one).
- A note running into the next note of the same pitch is shortened to end where that note starts.
- A note held past the last chosen bar ends at that bar.

Grace notes and ornaments come through as whatever the MIDI file wrote; check them against the score by hand.
