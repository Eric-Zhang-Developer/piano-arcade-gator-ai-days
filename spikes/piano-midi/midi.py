"""Piano MIDI spike, Python layer. Throwaway evidence, see README.md.

  midi.py ports                 list MIDI inputs and outputs
  midi.py listen                log incoming events until Ctrl-C, then print stats
  midi.py scale                 play sequence.mid (C-major scale, then 16 16th notes at 120 BPM)
  midi.py band                  loop band.mid (drums ch 10, bass ch 2) until Ctrl-C, then All Notes Off x16
  midi.py local off|on          send Local Control (CC 122) 0 or 127, then listen
  midi.py reset                 send GM System On

Every command except `ports` also logs the input port, so echo (R7) and IAC loopback show up.
`-p SUBSTR` picks the first port whose name contains SUBSTR (default: the first port).
Every line also goes to logs/python.log.
"""
import argparse
import os
import statistics
import time
from collections import Counter

import mido

HERE = os.path.dirname(os.path.abspath(__file__))
T0 = time.perf_counter()
last_on = None
gaps, vels = [], []


def log(line):
    print(line, flush=True)
    os.makedirs(os.path.join(HERE, "logs"), exist_ok=True)
    with open(os.path.join(HERE, "logs", "python.log"), "a") as f:
        f.write(line + "\n")


def on_msg(msg):
    global last_on
    if msg.type in ("active_sensing", "clock"):  # 0xFE every ~300 ms, 0xF8 24/beat: noise
        return
    t = (time.perf_counter() - T0) * 1000
    gap = ""
    kind = msg.type
    if msg.type == "note_on" and msg.velocity == 0:
        kind = "release(v0)"
    elif msg.type == "note_on":
        if last_on is not None:
            gaps.append(t - last_on)
            gap = f"{t - last_on:.1f}"
        last_on = t
        vels.append(msg.velocity)
    ch = msg.channel + 1 if hasattr(msg, "channel") else "-"
    data = " ".join(f"{b:02X}" for b in msg.bytes())
    log(f"{t:10.1f} {gap:>8} ch{ch!s:<3} {kind:<15} {data}")


def stats():
    if vels:
        log(f"# note-ons: {len(vels)}  velocity min {min(vels)} max {max(vels)}")
    if gaps:
        common, n = Counter(round(g) for g in gaps).most_common(1)[0]
        log(f"# gaps ms: min {min(gaps):.1f} median {statistics.median(gaps):.1f} max {max(gaps):.1f}"
            f"  under 2 ms: {sum(g < 2 for g in gaps)}  most common (1 ms bins): {common} ms x{n} of {len(gaps)}")


def pick(names, sub, kind):
    found = [n for n in names if sub is None or sub.lower() in n.lower()]
    if not found:
        raise SystemExit(f"no {kind} port matching {sub!r}; have {names}")
    return found[0]


def to_mid(events):
    """(tick, msg) pairs -> one-track MidiFile at 480 ticks per beat, default tempo 120 BPM."""
    mid = mido.MidiFile(ticks_per_beat=480)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    now = 0
    for t, m in sorted(events, key=lambda x: (x[0], x[1].type == "note_on")):  # offs before ons
        tr.append(m.copy(time=t - now))
        now = t
    return mid


def note(t, dur, n, ch=0, vel=90):
    return [(t, mido.Message("note_on", channel=ch, note=n, velocity=vel)),
            (t + dur, mido.Message("note_off", channel=ch, note=n))]


def sequence():
    ev = []
    for i, n in enumerate([60, 62, 64, 65, 67, 69, 71, 72]):  # C-major scale in quarter notes
        ev += note(i * 480, 400, n)
    for i in range(16):  # after a beat's rest: 16 16th notes, 120 ticks = 125 ms apart
        ev += note(9 * 480 + i * 120, 100, 72)
    return to_mid(ev)


def band(bars=8):
    ev = [(0, mido.Message("program_change", channel=1, program=33))]  # GM 34 Electric Bass (finger)
    bass = [36, 48, 36, 48, 43, 55, 43, 55]
    for b in range(bars):
        for e in range(8):  # 8th notes, 240 ticks
            t = (b * 8 + e) * 240
            ev += note(t, 60, 42, ch=9, vel=70)  # closed hi-hat
            if e in (0, 4):
                ev += note(t, 60, 36, ch=9, vel=100)  # kick
            if e in (2, 6):
                ev += note(t, 60, 38, ch=9, vel=100)  # snare
            ev += note(t, 200, bass[e], ch=1, vel=100)
    ev.append((bars * 1920, mido.MetaMessage("end_of_track")))  # full last bar, so the loop seam stays on beat
    return to_mid(ev)


def play(mid, name, out, loop=False):
    path = os.path.join(HERE, name)
    mid.save(path)
    log(f"# playing {name} ({mid.length:.2f} s){' on loop, Ctrl-C to stop' if loop else ''}")
    try:
        while True:
            for msg in mido.MidiFile(path).play():
                out.send(msg)
            if not loop:
                break
    except KeyboardInterrupt:
        log("# stopped")
    finally:
        for ch in range(16):
            out.send(mido.Message("control_change", channel=ch, control=123, value=0))
        log("# sent All Notes Off (CC 123) on 16 channels")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["ports", "listen", "scale", "band", "local", "reset"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("-p", "--port")
    a = ap.parse_args()
    if a.cmd == "ports":
        ins, outs = mido.get_input_names(), mido.get_output_names()
        log(f"# inputs ({len(ins)}): {ins}")
        log(f"# outputs ({len(outs)}): {outs}")
        return
    in_name = pick(mido.get_input_names(), a.port, "input")
    out_name = pick(mido.get_output_names(), a.port, "output")
    log(f"# {a.cmd} {a.arg or ''} in={in_name!r} out={out_name!r}")
    log(f"# {'t_ms':>8} {'gap_ms':>8} ch   type            bytes")
    with mido.open_input(in_name, callback=on_msg), mido.open_output(out_name) as out:
        try:
            if a.cmd == "scale":
                play(sequence(), "sequence.mid", out)
                time.sleep(0.5)
            elif a.cmd == "band":
                play(band(), "band.mid", out, loop=True)
                time.sleep(0.5)
            else:
                if a.cmd == "local":
                    out.send(mido.Message("control_change", control=122, value=0 if a.arg == "off" else 127))
                    log(f"# sent Local Control {a.arg} (CC 122 = {0 if a.arg == 'off' else 127}) on ch1")
                elif a.cmd == "reset":
                    out.send(mido.Message("sysex", data=[0x7E, 0x7F, 0x09, 0x01]))
                    log("# sent GM System On")
                log("# listening, Ctrl-C to stop")
                while True:
                    time.sleep(1)
        except KeyboardInterrupt:
            pass
        finally:
            stats()


if __name__ == "__main__":
    main()
