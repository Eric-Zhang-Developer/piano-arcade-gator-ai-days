#!/usr/bin/env python3
"""Notation MIDI -> Piano Arcade chart JSON (spec: song-pack-1).

Takes a right-hand and an optional left-hand track (or channel), a bar range and a bpm; writes beats and durations in
quarter notes from beat 0 of the first chosen bar. Refuses a performance (notes off a 1/12-beat grid) and an empty
hand. Everything it changed (unisons merged, same-pitch overlaps trimmed) goes to stderr for the done note.

  python3 convert.py song.mid --rh 1 --lh 2 --bars 1-16 --bpm 80 --id ode-to-joy --title ... -o chart.json
  python3 convert.py --self-test
"""
import argparse
import json
import sys
from fractions import Fraction

import mido

GRID = 12  # steps per quarter note: covers 16ths and triplets


class Refused(Exception):
    pass


def bar_starts(mid, upto_bar):
    """Tick of each bar's start (1-based list index 0 = bar 1) and each bar's length in quarter notes."""
    sigs = []
    for track in mid.tracks:
        t = 0
        for msg in track:
            t += msg.time
            if msg.type == "time_signature":
                sigs.append((t, msg.numerator, msg.denominator))
    sigs = sorted(sigs) or [(0, 4, 4)]
    if sigs[0][0] != 0:
        sigs.insert(0, (0, 4, 4))
    tpb = mid.ticks_per_beat
    starts, lengths, tick = [], [], 0
    while len(starts) < upto_bar + 1:
        num, den = next((n, d) for (st, n, d) in reversed(sigs) if st <= tick)
        length = Fraction(num * 4, den)
        starts.append(tick)
        lengths.append(length)
        tick += int(length * tpb)
    return starts, lengths


def notes_of(mid, which, by_channel):
    """(on_tick, off_tick, pitch) for one track index, or one channel across all tracks."""
    tracks = mid.tracks if by_channel else [mid.tracks[which]]
    out = []
    for track in tracks:
        t, held = 0, {}
        for msg in track:
            t += msg.time
            if msg.type not in ("note_on", "note_off") or (by_channel and msg.channel != which):
                continue
            key = (msg.channel, msg.note)
            if msg.type == "note_on" and msg.velocity > 0:
                held.setdefault(key, []).append(t)
            elif held.get(key):
                out.append((held[key].pop(0), t, msg.note))
    return out


def convert(mid, rh, lh=None, bars=(1, 1), by_channel=False):
    """Returns (notes, beatsPerBar, log). Notes are dicts in time order with ids."""
    first, last = bars
    starts, lengths = bar_starts(mid, last)
    lo, hi = starts[first - 1], starts[last]
    tpb = mid.ticks_per_beat
    log = []
    hands = [("R", rh)] + ([("L", lh)] if lh is not None else [])
    picked = []
    for hand, which in hands:
        inside = [(on, off, p) for (on, off, p) in notes_of(mid, which, by_channel) if lo <= on < hi]
        if not inside:
            raise Refused(f"{hand} hand ({'channel' if by_channel else 'track'} {which}) has no notes in bars {first}-{last}")
        off_grid = [n for n in inside if (n[0] * GRID) % tpb or (min(n[1], hi) * GRID) % tpb]
        if off_grid:
            raise Refused(f"{len(off_grid)} of {len(inside)} {hand} notes are off the 1/{GRID}-beat grid: a performance, not notation")
        for on, off, p in inside:
            beat = Fraction(on - lo, tpb)
            dur = Fraction(min(off, hi) - on, tpb)  # a note held past the last bar ends at it
            if dur > 0:
                picked.append({"hand": hand, "pitch": p, "beat": beat, "duration": dur})
    picked.sort(key=lambda n: (n["beat"], n["pitch"], n["hand"]))
    notes = []
    for n in picked:
        same = [m for m in notes if m["pitch"] == n["pitch"] and m["beat"] == n["beat"]]
        if same:
            log.append(f"unison kept once: pitch {n['pitch']} at beat {n['beat']} ({same[0]['hand']} and {n['hand']})")
            same[0]["duration"] = max(same[0]["duration"], n["duration"])
            continue
        notes.append(n)
    last_of = {}
    for n in notes:
        prev = last_of.get(n["pitch"])
        if prev and prev["beat"] + prev["duration"] > n["beat"]:
            log.append(f"trimmed: pitch {n['pitch']} at beat {prev['beat']} now ends at beat {n['beat']}")
            prev["duration"] = n["beat"] - prev["beat"]
        last_of[n["pitch"]] = n
    out = [
        {"id": f"n{i + 1}", "pitch": n["pitch"], "beat": num(n["beat"]), "duration": num(n["duration"]), "hand": n["hand"]}
        for i, n in enumerate(notes)
    ]
    return out, num(lengths[first - 1]), log


def num(f):
    """An exact Fraction as JSON: an int when whole, else a float rounded past any 1/12 step."""
    return int(f) if f.denominator == 1 else round(float(f), 6)


def self_test():
    # 3/4, 480 ticks per beat. Bar 1 is a pickup we skip; bars 2-3 are charted.
    mid = mido.MidiFile(ticks_per_beat=480)
    meta, rh, lh = mido.MidiTrack(), mido.MidiTrack(), mido.MidiTrack()
    mid.tracks += [meta, rh, lh]
    meta.append(mido.MetaMessage("time_signature", numerator=3, denominator=4, time=0))

    def play(track, events):  # (start_tick, length_ticks, pitch), in order, no overlaps
        t = 0
        for start, length, pitch in events:
            track.append(mido.Message("note_on", note=pitch, velocity=80, time=start - t))
            track.append(mido.Message("note_off", note=pitch, velocity=0, time=length))
            t = start + length

    bar = 1440
    play(rh, [(0, 480, 60), (bar, 480, 64), (bar + 480, 160, 65), (bar + 640, 160, 67), (bar + 800, 160, 69), (2 * bar, 1440, 72)])
    play(lh, [(bar, 1440, 48), (2 * bar, 960, 72)])  # 72 in both hands at bar 3: a unison
    notes, bpb, log = convert(mid, rh=1, lh=2, bars=(2, 3))
    got = [(n["pitch"], n["beat"], n["duration"], n["hand"]) for n in notes]
    third = round(1 / 3, 6)
    assert bpb == 3, bpb
    assert got == [
        (48, 0, 3, "L"),
        (64, 0, 1, "R"),
        (65, 1, third, "R"),
        (67, round(4 / 3, 6), third, "R"),
        (69, round(5 / 3, 6), third, "R"),
        (72, 3, 3, "L"),
    ], got
    assert [n["id"] for n in notes] == ["n1", "n2", "n3", "n4", "n5", "n6"]
    assert len(log) == 1 and log[0].startswith("unison"), log

    perf = mido.MidiFile(ticks_per_beat=480)
    perf.tracks.append(mido.MidiTrack())
    play(perf.tracks[0], [(0, 470, 60), (483, 470, 62)])
    for args, needle in [((perf, 0, None, (1, 1)), "off the 1/12-beat grid"), ((mid, 1, None, (5, 5)), "no notes")]:
        try:
            convert(*args)
            raise AssertionError(f"should refuse: {needle}")
        except Refused as e:
            assert needle in str(e), e
    print("self-test: ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("midi", nargs="?")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--rh", type=int, help="right-hand track index (or channel with --by-channel)")
    ap.add_argument("--lh", type=int, help="left-hand track index (or channel)")
    ap.add_argument("--by-channel", action="store_true", help="--rh/--lh are MIDI channels (0-15), not tracks")
    ap.add_argument("--bars", help="first-last, 1-based, inclusive (a pickup bar counts as bar 1)")
    ap.add_argument("--bpm", type=float)
    for k in ("id", "title", "composer", "catalog", "source"):
        ap.add_argument(f"--{k}")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    missing = [k for k in ("midi", "rh", "bars", "bpm", "id", "title", "composer", "source", "out") if getattr(a, k) is None]
    if missing:
        ap.error("missing: " + ", ".join(missing))
    first, last = (int(x) for x in a.bars.split("-"))
    try:
        notes, bpb, log = convert(mido.MidiFile(a.midi), a.rh, a.lh, (first, last), a.by_channel)
    except Refused as e:
        sys.exit(f"refused: {e}")
    chart = {"id": a.id, "title": a.title, "composer": a.composer}
    if a.catalog:
        chart["catalog"] = a.catalog
    chart |= {"source": a.source, "bpm": a.bpm, "beatsPerBar": bpb, "notes": notes}
    with open(a.out, "w") as f:
        json.dump(chart, f, indent=2, ensure_ascii=False)
        f.write("\n")
    for line in log:
        print(line, file=sys.stderr)
    lo, hi = min(n["pitch"] for n in notes), max(n["pitch"] for n in notes)
    print(f"{a.out}: {len(notes)} notes, bars {first}-{last}, beatsPerBar {bpb}, pitch {lo}-{hi}", file=sys.stderr)


if __name__ == "__main__":
    main()
