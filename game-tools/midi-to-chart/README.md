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
- `--rh-voice top` / `--lh-voice bottom` keep only a staff's outer voice (for a hymn setting with two voices a staff).
- `--pickup Q` marks a pickup bar of Q quarter notes; it lands at the end of a silent first bar so downbeats stay on
  beat 0, `beatsPerBar`, ...
- `--spans a-b,c-d` (quarter notes from the file start, in playing order) replaces `--bars` to write out repeats and
  volta endings, which notation MIDI plays only once; `--start-beat` sets where the first span starts.
- `--bars` is 1-based and inclusive; a pickup bar is bar 1. Beats start at 0 on the first chosen bar.
- `--by-channel` reads `--rh`/`--lh` as MIDI channels across all tracks instead of track indices.
- `beatsPerBar` comes from the file's time signature at the first chosen bar (3/8 gives 1.5).
- Each note's `velocity` is its note-on's (dynamics grades against it). Volume changes (CC7) are not read.

## The song pack's commands
Sources (public domain, Mutopia): `curl -O` each into `source/`:
`https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.mid`,
`https://www.mutopiaproject.org/ftp/ChopinFF/O28/Chop-28-4a/Chop-28-4a.mid`,
`https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59.mid` (and the `-let.pdf` scans).
```bash
.venv/bin/python convert.py source/ode.mid --rh 1 --rh-voice top --lh 2 --lh-voice bottom --bars 1-16 --bpm 80 ...
.venv/bin/python convert.py source/Chop-28-4a.mid --rh 1 --lh 2 --pickup 1 --bars 1-13 --bpm 44 ...
.venv/bin/python convert.py source/fur_Elise_WoO59.mid --rh 1 --lh 2 --start-beat 1 --bpm 66 \
  --spans 0-12,0-11,12-13.5,13.5-33,33-34.5,13.5-33,34.5-35.25 ...
```
The `...` are `--id --title --composer --catalog --source -o`, as in each chart's fields.

## What it refuses
- A file whose notes in the chosen bars start off a 1/12-beat grid: that's a performance, not notation. It says how
  many notes did. (A grace note, an off-grid sliver under 1/8 beat, is skipped and logged instead.)
- A hand with no notes in the bar range.

## What it changes, and says so on stderr
- A pitch both hands play at the same beat is kept once (the longer one).
- A note running into the next note of the same pitch is shortened to end where that note starts.
- A note held past the last chosen bar ends at that bar.
- A release off the grid (engravers' MIDI shortens some by a tick) is snapped to it.

Grace notes and ornaments come through as whatever the MIDI file wrote; check them against the score by hand.
