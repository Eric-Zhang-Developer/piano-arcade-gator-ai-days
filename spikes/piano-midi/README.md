# Piano MIDI spike

Evidence, not a dependency. This folder answers one question for `specs/features/piano-midi-spike/spec.md`: can a
laptop read every key press from the Yamaha DGX-660 and make it play notes and a band? Nothing imports from here;
the real MIDI I/O lane rebuilds what it needs. The answer is in [RESULTS.md](RESULTS.md).

- `macos.md`: the Audio MIDI Setup layer (IAC Driver, the piano's port names).
- `midi.py`: the Python layer (`mido` + `python-rtmidi`). Run `.venv/bin/python midi.py -h` for its commands.
- `index.html`: the Chrome layer, plain JS. Serve it from this folder and open `http://localhost:8000`.

```bash
python3.12 -m venv .venv && .venv/bin/pip install --only-binary=:all: mido==1.3.3 python-rtmidi==1.5.8
.venv/bin/python midi.py ports
python3 -m http.server 8000
```

`python-rtmidi` 1.5.8 ships wheels only up to CPython 3.12, hence `python3.12`. Both layers drop Active Sensing
(`0xFE`) and MIDI clock (`0xF8`) from the log. Python stamps arrival with `perf_counter` in the callback thread;
Chrome uses the event's `timeStamp`.
