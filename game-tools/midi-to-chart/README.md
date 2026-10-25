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
- Each note's `velocity` (dynamics grades against it): the note-on velocities if they vary; else the CC7 volume in
  force at each note-on (LilyPond writes dynamics that way), clamped to 1–127; else none. stderr says which.

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
- A file whose notes in the chosen bars start off the 1/12- and 1/8-beat grids (16ths, triplets, 32nds): that's a performance, not notation. It says how
  many notes did. (A grace note is skipped and logged instead: an off-grid onset at most 1/4 beat before the hand's next
  onset on the grid, stopping within 1/4 beat of it. One held longer is tied into its main note and starts on that onset.)
- A hand with no notes in the bar range.

## What it changes, and says so on stderr
- A pitch both hands play at the same beat is kept once (the longer one).
- A note running into the next note of the same pitch is shortened to end where that note starts.
- A note held past the last chosen bar ends at that bar.
- A release off the grid (engravers' MIDI shortens some by a tick) is snapped to it.

Grace notes and ornaments come through as whatever the MIDI file wrote; check them against the score by hand.

## Demo performance: `perform.py` (spec: demo-performance)
Writes a chart's `pedal.json` and sets velocities from its cited score, without touching notes. A library song's
`pedal.json` must also be listed in `web/src/game/pedal/library.json`; the pedal test checks they agree.
```bash
.venv/bin/python perform.py pedal <chart.json> --midi song.mid --pickup Q --bars a-b   # the MIDI export's CC64
.venv/bin/python perform.py pedal <chart.json> --ly song.ly --context <name> --spans ... --start-beat B  # a LilyPond pedal line
.venv/bin/python perform.py pedal <chart.json> --harmony   # no Ped. marks: the per-harmony rule
.venv/bin/python perform.py velocity <chart.json> --mark pp   # one printed mark over the whole excerpt
.venv/bin/python perform.py dynamics <chart.json> --ly song.ly --right a,b --left c --midi song.mid --bars a-b  # read the marks
.venv/bin/python perform.py --self-test
```
Batch 1 (#815), with the song pack's sources plus `fur_Elise_WoO59.ly`
(`https://www.mutopiaproject.org/ftp/BeethovenLv/WoO59/fur_Elise_WoO59/fur_Elise_WoO59.ly`):
```bash
.venv/bin/python perform.py pedal ../../web/public/songs/chopin-prelude-4/chart.json --midi source/Chop-28-4a.mid --pickup 1 --bars 1-13
.venv/bin/python perform.py pedal ../../web/public/songs/fur-elise/chart.json --ly source/fur_Elise_WoO59.ly --context pedalOne \
  --spans 0-12,0-11,12-13.5,13.5-33,33-34.5,13.5-33,34.5-35.25 --start-beat 1
.venv/bin/python perform.py pedal ../../web/public/songs/ode-to-joy/chart.json --harmony
.venv/bin/python perform.py pedal ../../web/public/songs/moonlight-1/chart.json --harmony
.venv/bin/python perform.py velocity ../../web/public/songs/fur-elise/chart.json --mark pp
.venv/bin/python perform.py velocity ../../web/public/songs/moonlight-1/chart.json --mark pp
```
Batch 3 (#818), with `25EF-02.ly` and `K545-1.ly` (Mutopia 203 and 998) read by hand for the marks:
```bash
.venv/bin/python perform.py pedal ../../web/public/songs/clementi-sonatina-36-1/chart.json --harmony
.venv/bin/python perform.py pedal ../../web/public/songs/bach-prelude-c/chart.json --harmony
.venv/bin/python perform.py pedal ../../web/public/songs/mozart-545-1/chart.json --harmony
.venv/bin/python perform.py velocity ../../web/public/songs/burgmuller-arabesque/chart.json \
  --marks "L@0=p,R@4=p,RL@8-18~+16,R@19!,RL@20=p,RL@24-34~+16"
.venv/bin/python perform.py velocity ../../web/public/songs/mozart-545-1/chart.json --marks "R@0=mp,L@0=p,R@8!,\
RL@10-11~+16,R@12!,RL@13-14~-16,RL@16=p,RL@16-17.75~+16,RL@18-19.75~-16,RL@20-21.75~+16,RL@22-23.75~-16,\
RL@24-25.75~+16,RL@26-27.75~-16,RL@28-29.75~+16,RL@30-31.75~-16,RL@32=p,RL@34.25-35.75~+16,RL@40=f,R@40!"
```
Batch 4 (#819), from each source's `.ly` and `.mid` on Mutopia (pieces 2035, 263, 1888, 108 and 483; Alla turca's and the
Minute Waltz's `.ly` are in their `-lys.zip`). Entertainer and Mountain King are read by `dynamics`, and the rest by hand
(`specs/decisions/demo-performance-dynamics.md` says why). Entertainer's marcato, R@7!, is appended by hand to the list
`dynamics` printed:
```bash
S=../../web/public/songs
.venv/bin/python perform.py dynamics $S/mountain-king/chart.json --ly source/Dans_l_antre_du_roi_de_la_montagne.ly \
  --right rightOne,rightTwo --left left --midi source/Dans_l_antre_du_roi_de_la_montagne.mid --bars 1-17
.venv/bin/python perform.py dynamics /tmp/en.json --ly source/entertainer.ly --right top,dyn --left bottom,dyn --unfold \
  --midi source/entertainer.mid --spans 0-38,70-71.25   # prints the list; then velocity --marks "<it>,R@7!" on the chart
.venv/bin/python perform.py velocity $S/gnossienne-1/chart.json --marks "RL@0=p,RL@22-25~-16,RL@28=f"
.venv/bin/python perform.py velocity $S/minute-waltz/chart.json \
  --marks "R@0!,RL@12-24~+16,RL@24-30~-16,RL@30-36~-16,RL@42-45~+16,RL@45-48~+16,RL@48-54~-16"
.venv/bin/python perform.py velocity $S/alla-turca/chart.json --marks "RL@1=p,RL@17=p,RL@33=mp,RL@49=p,RL@113/2=p,\
RL@65=mp,RL@81=p,RL@177/2=p,RL@54-113/2~+16,RL@86-177/2~+16,R@8!,RL@10!,RL@12!,RL@14!,R@24!,RL@26!,RL@28!,RL@30!,\
R@36!,R@40!,R@44!,R@48!,RL@56!,R@58!,R@68!,R@72!,R@76!,R@80!,RL@88!,R@90!"
for s in gnossienne-1 entertainer; do .venv/bin/python perform.py pedal $S/$s/chart.json --harmony; done
.venv/bin/python perform.py pedal $S/minute-waltz/chart.json --midi source/chopin_valse_op64_no1.mid --bars 1-20
```
Batch 2 (#816), from each source's `.ly` and `.mid` on Mutopia: `ftp/SatieE/gymnopedie_1/gymnopedie_1`,
`ftp/ChopinFF/O9/chopin_nocturne_op9_n2/chopin_nocturne_op9_n2`, `ftp/JoplinS/maple/maple`,
`ftp/DebussyC/L75/debussy_Ste_Bergamesq_Clair/debussy_Ste_Bergamesq_Clair`, and `moonlight3-a4.ly` and
`moonlight3.mid` from `ftp/BeethovenLv/O27/moonlight/moonlight-lys.zip` and `moonlight-mids.zip`:
```bash
S=../../web/public/songs
.venv/bin/python perform.py dynamics $S/gymnopedie-1/chart.json --ly source/gymnopedie_1.ly --right top,middle --left bottom \
  --midi source/gymnopedie_1.mid --bars 22-31
.venv/bin/python perform.py dynamics $S/nocturne-op9-2/chart.json --ly source/chopin_nocturne_op9_n2.ly --right upper --left lower \
  --midi source/chopin_nocturne_op9_n2.mid --pickup 0.5 --bars 1-9
.venv/bin/python perform.py dynamics $S/maple-leaf-rag/chart.json --ly source/maple.ly --right top --left bottom --unfold \
  --midi source/maple.mid --pickup 0.5 --bars 1-33
.venv/bin/python perform.py dynamics $S/moonlight-3/chart.json --ly source/moonlight3-a4.ly --right topmain --left bottom \
  --midi source/moonlight3.mid --bars 1-8
.venv/bin/python perform.py velocity $S/clair-de-lune/chart.json --mark pp
.venv/bin/python perform.py pedal $S/nocturne-op9-2/chart.json --ly source/chopin_nocturne_op9_n2.ly --context lower \
  --down ped --up pes --midi source/chopin_nocturne_op9_n2.mid --pickup 0.5 --bars 1-9
.venv/bin/python perform.py pedal $S/moonlight-3/chart.json --ly source/moonlight3-a4.ly --context sustain \
  --midi source/moonlight3.mid --bars 1-8
for s in gymnopedie-1 clair-de-lune maple-leaf-rag; do .venv/bin/python perform.py pedal $S/$s/chart.json --harmony; done
```
Batch 6 (#1102), with song-pack-5's sources (`specs/decisions/song-pack-5-sources.md`). The marks are hand-read:
`dynamics` lays Wild Horseman's dynamics line, which sits outside its `\repeat volta`, over the unfolded MIDI, and
it misplaces Happy Farmer's accents inside its `\voiceOne << >>` blocks.
```bash
S=../../web/public/songs
.venv/bin/python perform.py velocity $S/happy-farmer/chart.json --marks "RL@7/2=f,RL@36!,RL@40!,RL@60!,RL@64!"
.venv/bin/python perform.py velocity $S/wild-horseman/chart.json \
  --marks "RL@5/2=mf,RL@6!,RL@9!,RL@18!,RL@21!,RL@30!,RL@33!,RL@42!,RL@45!,RL@54!,RL@57!,RL@66!"
.venv/bin/python perform.py velocity $S/old-french-song/chart.json --marks "RL@3/2=p,RL@35/2=pp"
for s in happy-farmer old-french-song minuet-g-minor musette-d; do .venv/bin/python perform.py pedal $S/$s/chart.json --harmony; done
```
Batch 7 (#1103), with song-pack-6's sources plus `chopin_prelude_op28_no7.ly` from
`ftp/ChopinFF/O28/Chop-28-7/Chop-28-7-lys.zip`. `dynamics` reads Chopin (`--right playRH --left playLH`); it refuses
Träumerei (4 notes by its uncharted grace notes) and can't name K. 331's inline staves, so those two are hand-read.
```bash
S=../../web/public/songs
.venv/bin/python perform.py velocity $S/chopin-prelude-7/chart.json --marks "RL@2=p,RL@33-36~+16"
.venv/bin/python perform.py velocity $S/traumerei/chart.json \
  --marks "RL@3=p,RL@13/2-17/2~+16,RL@45/2-49/2~+16,RL@36=p,RL@77/2-81/2~+16,RL@109/2-113/2~+16"
.venv/bin/python perform.py velocity $S/mozart-331-theme/chart.json --marks "RL@0=p,RL@41/2!,RL@21=p,RL@24=p,RL@89/2!,RL@45=p"
.venv/bin/python perform.py pedal $S/chopin-prelude-7/chart.json --ly source/chopin_prelude_op28_no7.ly --context playLH \
  --midi source/Chop-28-7.mid --pickup 1 --bars 1-17
.venv/bin/python perform.py pedal $S/traumerei/chart.json --ly source/SchumannOp15No07.ly --context pedaltr \
  --down sustainDown --up sustainUp --spans 0-33,1-33 --start-beat 3
for s in mozart-331-theme brahms-waltz-15; do .venv/bin/python perform.py pedal $S/$s/chart.json --harmony; done
```
Batch 8 (#1104), from each source's `.ly` and `.mid` on Mutopia: `ftp/ChopinFF/O28/Chop-28-20/Chop-28-20`,
`ftp/DebussyC/L66/debussy_Arabesque_1/debussy_Arabesque_1`, `ftp/SchubertF/D780/MomentsNo3/MomentsNo3`,
`ftp/BeethovenLv/O13/pathetique-2/pathetique-2`, and `Chop-28-15.mid` with `sec1.ly` from `Chop-28-15-lys.zip`.
All are hand-read: `dynamics` skips the two Chopins' `\barRest` variable (it put their marks a bar or more early), refuses
the Arabesque (3 notes restruck only in the 2.26 MIDI; without them it prints this same list) and can't parse the
Moment musical's voice setup. Prelude 20 prints Ped. on each beat and then *simile*; its MIDI renders only the 6 literal
pairs, so its `pedal.json` is the printed pattern carried through bar 12 (decision `demo-performance-pedal`).
```bash
S=../../web/public/songs
.venv/bin/python perform.py velocity $S/chopin-prelude-20/chart.json --marks "RL@0=ff,RL@8-14~+16,RL@16=p,RL@32=pp,RL@42-47~+16,RL@48!"
.venv/bin/python perform.py velocity $S/debussy-arabesque-1/chart.json --marks "RL@0=p,RL@9-11~+16,RL@13-15~+16,\
RL@16-56/3~+16,RL@20=pp,RL@36-79/2~+16,RL@48-99/2~+16,RL@64=p,RL@72-76~+16,RL@76-78~-16,RL@86=p,RL@181/2-183/2~+16,\
RL@94=p,RL@100=p,RL@113-114~+16,RL@135-422/3~+16,RL@141-431/3~-16,RL@144=p"
.venv/bin/python perform.py velocity $S/moment-musical-3/chart.json --marks "R@6!,R@7!,R@10!,R@11!,R@22!,R@23!,R@26!,\
R@27!,R@36!,R@37!,R@44!,R@45!,R@52!,R@53!,R@60!,R@61!"
.venv/bin/python perform.py velocity $S/pathetique-2/chart.json --mark p
.venv/bin/python perform.py velocity $S/raindrop-prelude/chart.json --marks "RL@0=p,RL@4-9.5~+16,RL@10-13.5~-16,\
RL@20-25~+16,RL@25.5-29.5~-16,RL@31=p,RL@49-51~+16,RL@52-53.5~-16,RL@69-72~+16,RL@73-75~-16,RL@76=p,RL@80-85~+16,\
RL@85-89.5~-16,RL@96-101.5~+16,RL@101.5-104~-16"
.venv/bin/python perform.py pedal $S/raindrop-prelude/chart.json --midi source/Chop-28-15.mid --bars 1-27
for s in debussy-arabesque-1 pathetique-2; do .venv/bin/python perform.py pedal $S/$s/chart.json --harmony; done
python3 -c 'import json; print(json.dumps({"pedal": [[float(b), float(b + 1)] for b in range(48)]}))' > $S/chopin-prelude-20/pedal.json
```
