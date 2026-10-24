# Band player spike

Plays a band arrangement on the DGX-660's own GM voices. Eric plays the piano part over it. It's for hearing an
arrangement before the game plays it. Nothing imports from here; backing-track rebuilds what it needs.

- `index.html`: the page, plain JS over Web MIDI. It plays every channel of a Standard MIDI File to one output, with
  a one-bar count-in.
  - It sends GM System On first.
  - Stop, Esc and leaving the page send pedal-up and All Notes Off on all 16 channels.
  - `?file=` names the `.mid` to play, relative to this page; without it, pick a file.
  - `?port=` picks the output by part of its name. The default is "Portable Grand", the DGX's port.
- `midi.py`: a dependency-free Python reader and writer for Standard MIDI Files, for scripts that write arrangements.

```bash
python3 -m http.server 8043 -d spikes/band-player
```
Then open `http://localhost:8043/?file=local/<song>.mid` in Chrome.

## The arrangement format
A format-1 Standard MIDI File. Its tempo map (track 0) is the song's: the page plays in seconds through it.
- One part per track, each on its own channel with a GM program change at tick 0.
- Channel 10 is drums.
- The piano part, when present, is channel 1 (program 0). A "minus piano" version leaves that track out, so the
  player plays it.

Song content (arrangements of pieces we can't commit, per decision 003) goes in `local/` next to this page.
`local/` is gitignored.
