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


def bar_starts(mid, upto_bar, pickup=0):
    """Tick of each bar's start (list index 0 = bar 1) and the meter there, in quarter notes. With a pickup (in ticks),
    bar 1 is the pickup and bar 2 starts after it."""
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
        tick += pickup if pickup and len(starts) == 1 else int(length * tpb)
    return starts, lengths


def volumes(mid):
    """channel -> [(tick, CC7 value)] in tick order, across all tracks: the score's dynamics, where an exporter (LilyPond)
    writes them as channel volume rather than note velocity."""
    out = {}
    for track in mid.tracks:
        t = 0
        for msg in track:
            t += msg.time
            if msg.type == "control_change" and msg.control == 7:
                out.setdefault(msg.channel, []).append((t, msg.value))
    return {ch: sorted(v) for ch, v in out.items()}


def notes_of(mid, which, by_channel):
    """(on_tick, off_tick, pitch, velocity, volume) for one track index, or one channel across all tracks. volume is
    the CC7 value in force on the note's channel at its note-on, or None if none was set yet."""
    tracks = mid.tracks if by_channel else [mid.tracks[which]]
    vol = volumes(mid)
    in_force = lambda ch, t: next((v for at, v in reversed(vol.get(ch, [])) if at <= t), None)
    out = []
    for track in tracks:
        t, held = 0, {}
        for msg in track:
            t += msg.time
            if msg.type not in ("note_on", "note_off") or (by_channel and msg.channel != which):
                continue
            key = (msg.channel, msg.note)
            if msg.type == "note_on" and msg.velocity > 0:
                held.setdefault(key, []).append((t, msg.velocity, in_force(msg.channel, t)))
            elif held.get(key):
                on, velocity, volume = held[key].pop(0)
                out.append((on, t, msg.note, velocity, volume))
    return out


def outer_voice(notes, voice):
    """The top (or bottom) voice of a staff: a note stays unless another note sounding at its onset is higher (lower)."""
    if voice == "all":
        return notes
    other = (lambda q, p: q > p) if voice == "top" else (lambda q, p: q < p)
    return [n for n in notes if not any(m is not n and m[0] <= n[0] < m[1] and other(m[2], n[2]) for m in notes)]


def convert(mid, rh, lh=None, bars=(1, 1), by_channel=False, rh_voice="all", lh_voice="all", pickup=0, spans=None, start_beat=0):
    """Returns (notes, beatsPerBar, log). Notes are dicts in time order with ids. pickup is in quarter notes.

    spans, in place of bars: (from, to) ranges in quarter notes from the file's start, played one after another from
    beat start_beat. That writes out repeats and volta endings, which notation MIDI plays only once."""
    tpb = mid.ticks_per_beat
    snap = lambda t: Fraction(round(Fraction(t, tpb) * GRID), GRID)  # ticks -> quarter notes on the grid
    if spans:
        segments = [(int(Fraction(a) * tpb), int(Fraction(b) * tpb)) for a, b in spans]
        shift, meter, where = Fraction(start_beat), bar_starts(mid, 1)[1][0], f"spans {spans}"
    else:
        first, last = bars
        pickup_ticks = int(Fraction(pickup) * tpb)
        starts, lengths = bar_starts(mid, last, pickup_ticks)
        segments = [(starts[first - 1], starts[last])]
        # A charted pickup sits at the end of a silent bar, so beat 0 stays a downbeat (beat-track's kick, bar lines).
        shift = lengths[0] - Fraction(pickup_ticks, tpb) if pickup_ticks and first == 1 else 0
        meter, where = lengths[first], f"bars {first}-{last}"  # the meter of the first full bar
    log = []
    hands = [("R", rh, rh_voice)] + ([("L", lh, lh_voice)] if lh is not None else [])
    picked = []
    for lo, hi in segments:
        for hand, which, voice in hands:
            inside = [n for n in notes_of(mid, which, by_channel) if lo <= n[0] < hi]
            # Notation MIDI plays a grace note as a sliver just before its main note: off the grid and under 1/8 beat.
            grace = [n for n in inside if (n[0] * GRID) % tpb and (n[1] - n[0]) * 8 <= tpb]
            for on, _, p, _, _ in grace:
                log.append(f"grace note skipped: {hand} pitch {p} before beat {snap(on - lo) + shift}")
            inside = outer_voice([n for n in inside if n not in grace], voice)
            # Onsets must sit on the grid; releases are snapped, since engravers' MIDI shortens some by a tick.
            off_grid = [n for n in inside if (n[0] * GRID) % tpb]
            if off_grid:
                raise Refused(f"{len(off_grid)} of {len(inside)} {hand} notes start off the 1/{GRID}-beat grid: a performance, not notation")
            snapped = 0
            for on, off, p, velocity, volume in inside:
                beat = Fraction(on - lo, tpb)
                end = snap(min(off, hi) - lo)  # a note held past the segment's end ends at it
                snapped += end != Fraction(min(off, hi) - lo, tpb)
                if end > beat:
                    picked.append({"hand": hand, "pitch": p, "beat": beat + shift, "duration": end - beat, "velocity": velocity, "volume": volume})
            if snapped:
                log.append(f"{snapped} {hand} releases snapped to the 1/{GRID}-beat grid")
        shift += Fraction(hi - lo, tpb)
    for hand, which, _ in hands:
        if not any(n["hand"] == hand for n in picked):
            raise Refused(f"{hand} hand ({'channel' if by_channel else 'track'} {which}) has no notes in {where}")
    picked.sort(key=lambda n: (n["beat"], n["pitch"], n["hand"]))
    notes = []
    for n in picked:
        same = [m for m in notes if m["pitch"] == n["pitch"] and m["beat"] == n["beat"]]
        if same:
            log.append(f"unison kept once: pitch {n['pitch']} at beat {n['beat']} ({same[0]['hand']} and {n['hand']})")
            same[0]["duration"] = max(same[0]["duration"], n["duration"])
            same[0]["velocity"] = max(same[0]["velocity"], n["velocity"])
            same[0]["volume"] = max(same[0]["volume"] or 0, n["volume"] or 0) or None
            continue
        notes.append(n)
    last_of = {}
    for n in notes:
        prev = last_of.get(n["pitch"])
        if prev and prev["beat"] + prev["duration"] > n["beat"]:
            log.append(f"trimmed: pitch {n['pitch']} at beat {prev['beat']} now ends at beat {n['beat']}")
            prev["duration"] = n["beat"] - prev["beat"]
        last_of[n["pitch"]] = n
    # Dynamics (decided on #181): note-on velocities if they vary; else the CC7 volume in force at each note-on if that
    # varies and every note has one; else none, and the chart marks no dynamics.
    if len({n["velocity"] for n in notes}) > 1:
        log.append("velocity: from note-on velocities")
        loudness = lambda n: n["velocity"]
    elif all(n["volume"] is not None for n in notes) and len({n["volume"] for n in notes}) > 1:
        log.append("velocity: from CC7 volume (the note-on velocities are all equal)")
        loudness = lambda n: min(127, max(1, n["volume"]))
    else:
        log.append("velocity: none (neither note-on velocities nor CC7 volume vary): the chart marks no dynamics")
        loudness = None
    out = [
        {"id": f"n{i + 1}", "pitch": n["pitch"], "beat": num(n["beat"]), "duration": num(n["duration"]), "hand": n["hand"]}
        | ({"velocity": loudness(n)} if loudness else {})
        for i, n in enumerate(notes)
    ]
    return out, num(meter), log


def num(f):
    """An exact Fraction as JSON: an int when whole, else a float rounded past any 1/12 step."""
    return int(f) if f.denominator == 1 else round(float(f), 6)


def self_test():
    # 3/4, 480 ticks per beat. Bar 1 is a pickup we skip; bars 2-3 are charted.
    mid = mido.MidiFile(ticks_per_beat=480)
    meta, rh, lh = mido.MidiTrack(), mido.MidiTrack(), mido.MidiTrack()
    mid.tracks += [meta, rh, lh]
    meta.append(mido.MetaMessage("time_signature", numerator=3, denominator=4, time=0))

    def play(track, events):  # (start_tick, length_ticks, pitch[, velocity]), in order, no overlaps
        t = 0
        for start, length, pitch, *velocity in events:
            track.append(mido.Message("note_on", note=pitch, velocity=velocity[0] if velocity else 80, time=start - t))
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
    log = [line for line in log if not line.startswith("velocity:")]
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
    # Two voices on one staff: the top voice keeps the long C and the B that starts under nothing higher; the alto's
    # E (under C) and its own D (under B) go. The bottom voice is the mirror.
    duet = mido.MidiFile(ticks_per_beat=480)
    a, b = mido.MidiTrack(), mido.MidiTrack()
    duet.tracks += [a, b]
    play(a, [(0, 960, 72), (960, 960, 71)])  # soprano: C half, B half
    play(b, [(0, 480, 64), (480, 480, 67), (960, 960, 62)])  # alto: E, G, D (G starts under C: alto)
    merged = mido.merge_tracks(duet.tracks)
    staff = mido.MidiFile(ticks_per_beat=480)
    staff.tracks.append(merged)
    top, _, _ = convert(staff, rh=0, bars=(1, 1), rh_voice="top")
    bottom, _, _ = convert(staff, rh=0, bars=(1, 1), rh_voice="bottom")
    assert [n["pitch"] for n in top] == [72, 71], top
    assert [n["pitch"] for n in bottom] == [64, 67, 62], bottom
    # A 1-quarter pickup in 4/4 with a grace note and a release a tick short: the pickup lands on beat 3, the grace
    # note goes, the release snaps.
    pk = mido.MidiFile(ticks_per_beat=480)
    pk.tracks.append(mido.MidiTrack())
    play(pk.tracks[0], [(0, 480, 67), (480 + 1920 - 30, 30, 74), (480 + 1920, 159, 72)])
    notes, bpb, log = convert(pk, rh=0, bars=(1, 3), pickup=1)
    assert bpb == 4 and [(n["pitch"], n["beat"], n["duration"]) for n in notes] == [(67, 3, 1), (72, 8, round(1 / 3, 6))], notes
    assert any("grace" in line for line in log) and any("snapped" in line for line in log), log
    # Spans write out a volta repeat: body (C D), first ending (D), body again (C), second ending (E).
    sp = mido.MidiFile(ticks_per_beat=480)
    sp.tracks.append(mido.MidiTrack())
    play(sp.tracks[0], [(0, 480, 60), (480, 480, 62), (960, 480, 64)])  # C D E: body C D, first ending D, second E
    notes, bpb, _ = convert(sp, rh=0, spans=[(0, 2), (0, 1), (2, 3)])
    assert bpb == 4 and [(n["pitch"], n["beat"]) for n in notes] == [(60, 0), (62, 1), (60, 2), (64, 3)], notes
    # Each note's velocity is its note-on's (dynamics); a unison keeps the louder.
    dy = mido.MidiFile(ticks_per_beat=480)
    r, l = mido.MidiTrack(), mido.MidiTrack()
    dy.tracks += [r, l]
    play(r, [(0, 480, 60, 40), (480, 480, 64, 100)])
    play(l, [(480, 480, 64, 70)])
    notes, _, _ = convert(dy, rh=0, lh=1, bars=(1, 1))
    assert [(n["pitch"], n["velocity"]) for n in notes] == [(60, 40), (64, 100)], notes
    # Equal note-on velocities, two CC7 levels: the volume in force at each note-on becomes its velocity (0 clamps to 1).
    cc = mido.MidiFile(ticks_per_beat=480)
    cc.tracks.append(mido.MidiTrack())
    t0 = cc.tracks[0]
    t0.append(mido.Message("control_change", control=7, value=50, time=0))
    t0.append(mido.Message("note_on", note=60, velocity=90, time=0))
    t0.append(mido.Message("note_off", note=60, velocity=0, time=480))
    t0.append(mido.Message("control_change", control=7, value=0, time=0))
    t0.append(mido.Message("note_on", note=62, velocity=90, time=0))
    t0.append(mido.Message("note_off", note=62, velocity=0, time=480))
    notes, _, log = convert(cc, rh=0, bars=(1, 1))
    assert [n["velocity"] for n in notes] == [50, 1] and any("CC7" in line for line in log), (notes, log)
    # Neither varies: no velocity on any note.
    flat = mido.MidiFile(ticks_per_beat=480)
    flat.tracks.append(mido.MidiTrack())
    play(flat.tracks[0], [(0, 480, 60, 90), (480, 480, 62, 90)])
    notes, _, log = convert(flat, rh=0, bars=(1, 1))
    assert all("velocity" not in n for n in notes) and any("none" in line for line in log), (notes, log)
    print("self-test: ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("midi", nargs="?")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--rh", type=int, help="right-hand track index (or channel with --by-channel)")
    ap.add_argument("--lh", type=int, help="left-hand track index (or channel)")
    ap.add_argument("--rh-voice", choices=["all", "top"], default="all", help="top: only the staff's highest voice")
    ap.add_argument("--lh-voice", choices=["all", "bottom"], default="all", help="bottom: only the staff's lowest voice")
    ap.add_argument("--by-channel", action="store_true", help="--rh/--lh are MIDI channels (0-15), not tracks")
    ap.add_argument("--bars", help="first-last, 1-based, inclusive (a pickup bar counts as bar 1)")
    ap.add_argument("--spans", help="in place of --bars: a-b,c-d,... in quarter notes from the file start, played in order")
    ap.add_argument("--start-beat", type=Fraction, default=0, help="with --spans: the chart beat of the first span's start")
    ap.add_argument("--pickup", type=Fraction, default=0, help="length of a pickup bar in quarter notes (bar 1 is then the pickup)")
    ap.add_argument("--bpm", type=float)
    for k in ("id", "title", "composer", "catalog", "source"):
        ap.add_argument(f"--{k}")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    missing = [k for k in ("midi", "rh", "bpm", "id", "title", "composer", "source", "out") if getattr(a, k) is None]
    if missing or not (a.bars or a.spans):
        ap.error("missing: " + ", ".join(missing or ["--bars or --spans"]))
    spans = [tuple(Fraction(x) for x in r.split("-")) for r in a.spans.split(",")] if a.spans else None
    bars = tuple(int(x) for x in a.bars.split("-")) if a.bars else (1, 1)
    try:
        notes, bpb, log = convert(
            mido.MidiFile(a.midi), a.rh, a.lh, bars, a.by_channel, a.rh_voice, a.lh_voice, a.pickup, spans, a.start_beat
        )
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
    end = max(n["beat"] + n["duration"] for n in notes)
    print(f"{a.out}: {len(notes)} notes, {a.spans or a.bars}, beatsPerBar {bpb}, pitch {lo}-{hi}, ends at beat {end:g} ({end * 60 / a.bpm:.0f} s)", file=sys.stderr)


if __name__ == "__main__":
    main()
