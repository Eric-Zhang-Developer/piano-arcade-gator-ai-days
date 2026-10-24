# Twinkle 13: results

**The question:** can an agent write a variation that sounds good on the real piano?
**Answer:** not yet known. Eric hasn't listened yet. The ratings below are his to fill in, in his words.

## Outputs, in play order

| File | What it is | Length | Rating (1-5) | Melody recognizable? |
|---|---|---|---|---|
| `out/01-theme.mid` | Mozart's theme as written, with its repeats and the scan's dynamics | 48 s | | |
| `out/02-var12.mid` | Variation 12 as written: repeats, first and second endings, coda, the scan's dynamics | 88 s | | |
| `out/03-var12-band.mid` | Var 12 with a band: drums (ch 10) and an electric bass (ch 2, GM 33) on the left hand's beat notes | 88 s | | |
| `out/04-var12-minore.mid` | Var 12 in C minor (E to Eb, A to Ab), Mozart's Var 8 move | 88 s | | |
| `out/05-var12-harpsichord.mid` | Var 12 with a GM program change to harpsichord (6) | 88 s | | |
| `out/06-var13a-cathedral.mid` | Var 13a: music box, then four-voice canon, then apotheosis | 54 s | | |
| `out/07-var13b-storm.mid` | Var 13b: minor storm, then Var 12 with the band at 152 BPM, then apotheosis | 52 s | | |
| `out/08-var13c-full-arc.mid` | Var 13c: all five movements, music box to apotheosis | 88 s | | |

The movements of Var 13 and the Mozart move each one takes further are in `analysis.md`. Lengths are from `mido`.
The three Var 13 tries are the `13a`, `13b`, `13c` the spec allows; Eric keeps the one he likes best.

**Best Var 13:** (Eric) · **Phone recording:** (file name, kept out of git)

## How to run it

```bash
cd spikes/twinkle-13
python3.12 -m venv .venv && .venv/bin/pip install mido==1.3.3 python-rtmidi==1.5.8
# fetch source/ with the block in SOURCE.md, then:
.venv/bin/python transform.py          # writes out/*.mid
.venv/bin/python transform.py check    # every file fits the piano and leaves no note on
.venv/bin/python player.py             # plays out/*.mid to Portable Grand in order; Ctrl-C stops cleanly
.venv/bin/python player.py out/06-var13a-cathedral.mid   # one file
```

Or in Chrome, with play buttons per file and a ratings form that copies its answers as Markdown:
`python3 -m http.server 8013 -d spikes/twinkle-13`, then open <http://localhost:8013/> and allow MIDI.
`index.html`'s MIDI parser matches `mido` on all 8 files (same events and note-ons; end times within 1 ms).
It hasn't been played through yet: the Chrome test was skipped.

## What the agent checked (no ears involved)

Run on 2026-10-24, MacBook Air, Python 3.12.13, `mido` 1.3.3, `python-rtmidi` 1.5.8.

- **Every file fits the DGX** (`transform.py check`): all keys within A0-C8, at most 22 notes at once (the
  piano has 192), and every note-on has its note-off. The check fails on a planted key 17 and a planted stuck
  note.
- **The player stops cleanly** (dry run on the IAC bus, with a listener on the other end): interrupted 6 s into
  `08-var13c-full-arc.mid` with SIGINT, and again with SIGTERM. Both times the listener got GM System On first,
  then CC 123 on all 16 channels twice (32), and CC 64 = 0, and had **0 notes still sounding**.
- **The real port opens:** `Portable Grand` was listed and took GM System On and All Notes Off. No notes were
  sent to the piano; the listening is Eric's.

## Not done

- **The Validation run at the piano:** playing each output through the DGX's speakers, the ratings, the
  recognizability answers, the best Var 13 and its phone recording. These need Eric.
- **Ornaments:** the source has no trills or turns, so none play (see `SOURCE.md`).
