"""Restyle runs (spec: restyle-spike), written by the worker session that did them (eric-agent-4).

python3 spikes/restyle/restyle.py <restyle id> writes web/public/songs/local/<id>/chart.json from the source chart.
Every restyle keeps the source melody's pitches in order (the lock) and moves only their beats. The left hand is new:
one chord per segment, picked from the key's diatonic triads by the source's own pitches in that segment (both hands,
weighted by duration). No published arrangement is recalled; each style's left hand is a textbook figure (808 bass,
oom-pah-pah, stride, a rocking fifth) over those chords.
"""

import json
import sys
from pathlib import Path

SONGS = Path(__file__).resolve().parents[2] / "web/public/songs"


def melody(chart):
    top = {}
    for n in chart["notes"]:
        if n["hand"] == "R" and (n["beat"] not in top or n["pitch"] > top[n["beat"]]["pitch"]):
            top[n["beat"]] = n
    return [top[b] for b in sorted(top)]


# Ties go to the earlier: tonic, subdominant, dominant first. Minor's V is major (harmonic minor), so D# counts.
MAJOR = [(0, "I"), (5, "IV"), (7, "V"), (9, "vi"), (2, "ii")]
MINOR = [(0, "i"), (5, "iv"), (7, "V"), (8, "VI"), (3, "III")]


def triad(tonic, degree, minor_key, name):
    root = (tonic + degree) % 12
    third = 3 if name.islower() else 4
    return [root, (root + third) % 12, (root + 7) % 12]


def chord_for(notes, tonic, minor_key):
    """The diatonic triad covering the most duration of these notes' pitch classes. The left hand counts double: in
    these sources it's the accompaniment, so it spells the chord."""
    weight = [0.0] * 12
    for n in notes:
        weight[n["pitch"] % 12] += n["duration"] * (2 if n["hand"] == "L" else 1)
    best = None
    for degree, name in MINOR if minor_key else MAJOR:
        tones = triad(tonic, degree, minor_key, name)
        score = sum(weight[pc] for pc in tones)
        if best is None or score > best[0] + 1e-9:
            best = (score, tones)
    return best[1]


def in_range(pc, lo, hi):
    """The lowest pitch of class pc at or above lo, if it's <= hi."""
    p = lo + (pc - lo) % 12
    return p if p <= hi else p - 12


def segment(chart, start, end):
    return [n for n in chart["notes"] if start <= n["beat"] < end]


def remap(mel, warp, bar_in, bar_out):
    """Each melody note's onset and end through warp(position in its source bar) -> position in bar_out beats."""
    out = []
    for n in mel:
        bar, pos = divmod(n["beat"], bar_in)
        beat = bar * bar_out + warp(pos)
        end_src = n["beat"] + n["duration"]
        eb, ep = divmod(end_src, bar_in)
        end = eb * bar_out + warp(ep)
        out.append((n, round(beat, 6), round(end, 6)))
    # Monophonic: a note ends by the next onset.
    return [(n, b, min(e, out[i + 1][1]) if i + 1 < len(out) else e) for i, (n, b, e) in enumerate(out)]


def piecewise(points):
    """A warp through (source pos, new pos) breakpoints, linear between them."""

    def warp(x):
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            if x0 <= x <= x1:
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
        raise ValueError(x)

    return warp


def chart_out(src, style, rh, lh, bpm, bpb, velocity):
    notes = [{"id": f"r{i + 1}", "pitch": n["pitch"], "beat": b, "duration": round(e - b, 6), "hand": "R", "velocity": velocity}
             for i, (n, b, e) in enumerate(rh)]
    notes += [{"id": f"l{i + 1}", "pitch": p, "beat": round(b, 6), "duration": round(d, 6), "hand": "L", "velocity": v}
              for i, (p, b, d, v) in enumerate(lh)]
    notes.sort(key=lambda n: (n["beat"], n["hand"] != "R", n["pitch"]))
    return {
        "id": f"{src['id']}-{style}",
        "title": f"{src['title']} ({style.capitalize()})",
        "composer": src["composer"],
        "catalog": f"restyled from {src['title']}",
        "source": (f"Restyled as {style} by a Claude Code session from library chart {src['id']}. Melody pitches locked "
                   f"to it (restyle-spike); rhythm, meter and left hand are the session's. Melody source: {src['source']}"),
        "bpm": bpm,
        "beatsPerBar": bpb,
        "notes": notes,
    }


def last_end(rh):
    return max(e for _, _, e in rh)


# --- the four runs ---------------------------------------------------------------------------------------------

def twinkle_trap(src):
    # Half-time trap at 140: each 4-beat bar keeps its length, its notes pushed onto a dotted-eighth grid.
    mel = melody(src)
    rh = remap(mel, piecewise([(0, 0), (1, 0.75), (2, 1.5), (3, 2.5), (4, 4)]), 4, 4)
    lh = []
    bars = int(-(-last_end(rh) // 4))
    for bar in range(bars):
        for half, at, length, v in ((0, 0, 1.5, 100), (2, 2.5, 1, 90)):  # an 808's boom ... boom, a chord each half bar
            tones = chord_for(segment(src, bar * 4 + half, bar * 4 + half + 2), 0, False)  # C major
            lh.append((in_range(tones[0], 36, 47), bar * 4 + at, length, v))
    return chart_out(src, "trap", rh, lh, 140, 4, 85)


def ode_to_joy_waltz(src):
    # Each 4/4 bar becomes two 3/4 bars: long-short, long-short, so the quarters lilt.
    mel = melody(src)
    rh = remap(mel, piecewise([(0, 0), (1, 2), (2, 3), (3, 5), (4, 6)]), 4, 6)
    lh = []
    bars = int(-(-last_end(rh) // 3))
    for bar in range(bars):
        s = bar * 3 / 6 * 4  # this waltz bar's half of the source bar
        tones = chord_for(segment(src, s, s + 2), 7, False)  # G major
        root = in_range(tones[0], 36, 47)
        upper = sorted(in_range(t, 50, 61) for t in tones[1:])
        lh.append((root, bar * 3, 1, 75))  # oom
        for k in (1, 2):  # pah pah
            lh += [(p, bar * 3 + k, 0.75, 55) for p in upper]
    return chart_out(src, "waltz", rh, lh, 132, 3, 80)


def minuet_g_ragtime(src):
    # Each 3/4 bar becomes two 2/4 bars, beats stretched long-short-long (1.5, 1, 1.5): a cakewalk's lurch.
    mel = melody(src)
    rh = remap(mel, piecewise([(0, 0), (1, 1.5), (2, 2.5), (3, 4)]), 3, 4)
    lh = []
    bars = int(-(-last_end(rh) // 2))
    for bar in range(bars):
        s = bar // 2 * 3  # one chord per source bar: the minuet's harmony moves by the bar
        tones = chord_for(segment(src, s, s + 3), 7, False)  # G major
        root = in_range(tones[0], 31, 42)
        chord = sorted(in_range(t, 52, 63) for t in tones)
        # Stride: bass on 1, chord on the "and", fifth below the bass's octave on 2, chord again.
        fifth = in_range(tones[2], 31, 42)
        lh.append((root, bar * 2, 0.45, 85))
        lh += [(p, bar * 2 + 0.5, 0.4, 60) for p in chord]
        lh.append((fifth, bar * 2 + 1, 0.45, 80))
        lh += [(p, bar * 2 + 1.5, 0.4, 60) for p in chord]
    return chart_out(src, "ragtime", rh, lh, 96, 2, 80)


def fur_elise_lullaby(src):
    # Slow and even: the source's rhythm kept, two 3/8 bars made one rocking 6/8 bar at 48, everything soft.
    mel = melody(src)
    rh = remap(mel, lambda x: x, 1.5, 1.5)
    lh = []
    bars = int(-(-last_end(rh) // 3))
    for half in range(bars * 2):  # each source bar (1.5 beats) gets its own chord, rocked root then fifth
        s = half * 1.5
        tones = chord_for(segment(src, s, s + 1.5), 9, True)  # A minor
        root = in_range(tones[0], 33, 44)
        fifth = in_range(tones[2], 40, 51)
        lh += [(root, s, 1.4, 45), (fifth, s + 0.75, 0.65, 36)]
    return chart_out(src, "lullaby", rh, lh, 48, 3, 55)


RUNS = {
    "twinkle-trap": ("twinkle", twinkle_trap),
    "ode-to-joy-waltz": ("ode-to-joy", ode_to_joy_waltz),
    "minuet-g-ragtime": ("minuet-g", minuet_g_ragtime),
    "fur-elise-lullaby": ("fur-elise", fur_elise_lullaby),
}

if __name__ == "__main__":
    rid = sys.argv[1]
    sid, fn = RUNS[rid]
    src = json.loads((SONGS / sid / "chart.json").read_text())
    out = SONGS / "local" / rid / "chart.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    chart = fn(src)
    out.write_text(json.dumps(chart, indent=1) + "\n")
    print(f"{rid}: {sum(n['hand'] == 'R' for n in chart['notes'])} melody notes, "
          f"{sum(n['hand'] == 'L' for n in chart['notes'])} left-hand notes -> {out}")
