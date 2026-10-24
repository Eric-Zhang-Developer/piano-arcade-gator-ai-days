"""Twinkle 13 player: play .mid files to the DGX-660, in order. Throwaway, see the spec.

  .venv/bin/python player.py                       every out/*.mid, in file-name order
  .venv/bin/python player.py out/02-var12.mid ...  just these
  -p SUBSTR   the first output port whose name contains SUBSTR (default: Portable Grand); -p IAC for a dry run
  --gap S     seconds of silence between files (default 3)

The piano spike's lessons, rebuilt here: the port is named `Portable Grand`; send GM System On first; on stop or
Ctrl-C, send All Notes Off (CC 123) on all 16 channels. This also lifts the sustain pedal (CC 64 = 0), which
the Var 13 files use. `kill` (SIGTERM) stops it the same way.
"""
import argparse
import glob
import os
import signal
import time

import mido

HERE = os.path.dirname(os.path.abspath(__file__))
GM_SYSTEM_ON = (0x7E, 0x7F, 0x09, 0x01)


def silence(port):
    for ch in range(16):
        port.send(mido.Message("control_change", channel=ch, control=64, value=0))
        port.send(mido.Message("control_change", channel=ch, control=123, value=0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("-p", "--port", default="Portable Grand")
    ap.add_argument("--gap", type=float, default=3)
    args = ap.parse_args()
    for sig in (signal.SIGINT, signal.SIGTERM):  # also when started in the background, where SIGINT is ignored
        signal.signal(sig, signal.default_int_handler)
    files = args.files or sorted(glob.glob(os.path.join(HERE, "out", "*.mid")))
    names = [n for n in mido.get_output_names() if args.port.lower() in n.lower()]
    if not names:
        raise SystemExit(f"no output port matching {args.port!r}; have {mido.get_output_names()}")
    with mido.open_output(names[0]) as port:
        print(f"# port: {names[0]}", flush=True)
        try:
            port.send(mido.Message("sysex", data=GM_SYSTEM_ON))
            time.sleep(0.2)
            for i, path in enumerate(files):
                mid = mido.MidiFile(path)
                print(f"> {os.path.basename(path)}  ({mid.length:.0f} s)", flush=True)
                for msg in mid.play():
                    port.send(msg)
                silence(port)
                if i < len(files) - 1:
                    time.sleep(args.gap)
        except KeyboardInterrupt:
            print("\n# stopped", flush=True)
        finally:
            silence(port)
            time.sleep(0.3)  # then once more, in case the port was still draining
            silence(port)


if __name__ == "__main__":
    main()
