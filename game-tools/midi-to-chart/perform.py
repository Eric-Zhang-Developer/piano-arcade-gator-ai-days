#!/usr/bin/env python3
"""A chart's demo performance (spec: demo-performance): its pedal.json and its velocities, from the cited score.

Pedal, three sources, in order of preference:
  --midi    the score's MIDI export's CC64 (LilyPond renders \\sustainOn/Off that way), over the chart's bars or spans
  --ly      a LilyPond pedal line (a Dynamics or Staff context of skips with \\sustainOn/Off) the MIDI didn't render
  --harmony the per-harmony rule, for a score with no Ped. marks (an arrangement choice; decision demo-performance-pedal)
Velocity: --mark pp sets every note to that mark's level on the library's one ladder (decision demo-performance-dynamics),
for an excerpt under a single printed mark that the MIDI export didn't render.

  python3 perform.py pedal chart.json --midi song.mid --pickup 1 --bars 1-13
  python3 perform.py pedal chart.json --ly song.ly --context pedalOne --spans 0-12,0-11 --start-beat 1
  python3 perform.py pedal chart.json --harmony
  python3 perform.py velocity chart.json --mark pp
  python3 perform.py --self-test
Writes pedal.json next to the chart, or the chart in place with only velocity fields changed.
"""
import argparse
import json
import re
import sys
from fractions import Fraction
from pathlib import Path

LADDER = {"ppp": 16, "pp": 33, "p": 49, "mp": 64, "mf": 80, "f": 96, "ff": 112, "fff": 127}  # golden-demo's
DOWN_AFTER_S, UP_BEFORE_S = 0.06, 0.02  # the per-harmony rule's offsets, as golden-demo's


def segments(bars=None, pickup=0, spans=None, start_beat=0, bar_starts=None):
    """[(lo, hi, shift)] in quarter notes from the source's start: a source time t in [lo, hi) is chart beat t - lo + shift.
    The same mapping convert.py uses: --bars from bar_starts (quarter-note starts, bar 1 first), or --spans."""
    if spans:
        out, shift = [], Fraction(start_beat)
        for lo, hi in spans:
            out.append((lo, hi, shift))
            shift += hi - lo
        return out
    first, last = bars
    starts, lengths = bar_starts
    shift = lengths[0] - pickup if pickup and first == 1 else 0  # a pickup sits at the end of a silent bar
    return [(starts[first - 1], starts[last], shift)]


def clip(pairs, segs):
    """Source-time (down, up) pairs -> chart-beat pairs, cut to each segment, in chart order."""
    out = []
    for lo, hi, shift in segs:
        for d, u in pairs:
            a, b = max(d, lo), min(u, hi)
            if a < b:
                out.append((a - lo + shift, b - lo + shift))
    return sorted(out)


def pairs_of(events):
    """[(time, down?)] in time order -> [(down, up)]; a repeated down or up is ignored."""
    out, down = [], None
    for t, on in events:
        if on and down is None:
            down = t
        elif not on and down is not None:
            out.append((down, t))
            down = None
    return out


def midi_pedal(path):
    """CC64 across every track: [(down, up)] in quarter notes, and the bar starts convert.py would use."""
    import mido
    from convert import bar_starts

    mid = mido.MidiFile(path)
    events = []
    for track in mid.tracks:
        t = 0
        for msg in track:
            t += msg.time
            if msg.type == "control_change" and msg.control == 64:
                events.append((Fraction(t, mid.ticks_per_beat), msg.value >= 64))
    # At one instant an up goes before a down: LilyPond renders a re-pedal (\\PH\\PR) as both at the same tick.
    return pairs_of(sorted(events, key=lambda e: (e[0], e[1]))), mid


TOKEN = re.compile(r"\\repeat\s+(volta|unfold)\s+(\d+)\s*\{|\\alternative\s*\{|\{|\}|\\sustainOn|\\sustainOff"
                   r"|\\partial\s+\d+\.*|\\\w+|\b[sR](\d+)(\.*)(?:\*(\d+)(?:/(\d+))?)?")


def ly_pedal(text, context):
    """A LilyPond pedal line -> [(down, up)] in quarter notes from its start, read the way notation MIDI plays it: a volta
    repeat once with its alternatives in turn, an unfold repeat N times. A \\sustainOn/Off is postfix: it sounds at the
    onset of the skip it follows."""
    start = re.search(r'\\new\s+\w+\s*=\s*"' + re.escape(context) + r'"\s*\{', text)
    if not start:
        raise SystemExit(f"no context {context!r}")
    tokens = TOKEN.finditer(text, start.end())

    def block():  # until the matching }: a list of items, each ("skip", length) | ("on"|"off",) | ("rep", n, items)
        items = []
        for m in tokens:
            s = m.group(0)
            if s == "}":
                return items
            if m.group(1):
                items.append(("rep", int(m.group(2)) if m.group(1) == "unfold" else 1, block()))
            elif s.startswith("\\alternative") or s == "{":
                items.append(("rep", 1, block()))
            elif s == "\\sustainOn":
                items.append(("on",))
            elif s == "\\sustainOff":
                items.append(("off",))
            elif m.group(3):
                length = Fraction(4, int(m.group(3)))
                length *= sum(Fraction(1, 2 ** k) for k in range(len(m.group(4)) + 1))  # dots
                if m.group(5):
                    length *= Fraction(int(m.group(5)), int(m.group(6) or 1))
                items.append(("skip", length))
        return items

    events, t, onset = [], Fraction(0), Fraction(0)

    def walk(items):
        nonlocal t, onset
        for it in items:
            if it[0] == "skip":
                onset, t = t, t + it[1]
            elif it[0] == "rep":
                for _ in range(it[1]):
                    walk(it[2])
            else:  # a postfix mark: it sounds at the onset of the skip it follows
                events.append((onset, it[0] == "on"))

    walk(block())
    return pairs_of(events)


def harmony_pedal(chart):
    """The per-harmony rule on the chart's left hand, in beats (golden-demo's, findings 2026-10-25): a harmony is the pitch
    classes struck in a half bar (a whole bar unless beatsPerBar is 4); a pair starts at a window striking a new set, at
    the left hand's first strike in a bar, or after a left-hand rest of a bar or more. Down just after, up just before
    the next pair; a rest of a bar or more lifts it at the rest."""
    bpb = Fraction(chart["beatsPerBar"]).limit_denominator(64)
    window = bpb / 2 if bpb == 4 else bpb
    beat_s = Fraction(60) / Fraction(chart["bpm"]).limit_denominator(1000)
    down_after, up_before = Fraction(DOWN_AFTER_S) / beat_s, Fraction(UP_BEFORE_S) / beat_s
    lh = sorted((n for n in chart["notes"] if n["hand"] == "L"), key=lambda n: n["beat"])
    if not lh:
        return []
    fr = lambda x: Fraction(x).limit_denominator(4096)
    windows = {}
    for n in lh:
        windows.setdefault(fr(n["beat"]) // window, []).append(n)
    starts, last_set, last_end = [], None, None
    for w in sorted(windows):
        ns = windows[w]
        on = min(fr(n["beat"]) for n in ns)
        pcs = {n["pitch"] % 12 for n in ns}
        first_in_bar = (w * window) % bpb == 0
        if pcs != last_set or first_in_bar or (last_end is not None and on - last_end >= bpb):
            starts.append(on)
        last_set = pcs
        last_end = max([last_end or 0] + [fr(n["beat"]) + fr(n["duration"]) for n in ns])
    end = max(fr(n["beat"]) + fr(n["duration"]) for n in chart["notes"])
    sounding = []
    for a, e in sorted((fr(n["beat"]), fr(n["beat"]) + fr(n["duration"])) for n in lh):
        if sounding and a <= sounding[-1][1]:
            sounding[-1][1] = max(sounding[-1][1], e)
        else:
            sounding.append([a, e])
    pairs = []
    for k, s in enumerate(starts):
        up = starts[k + 1] - up_before if k + 1 < len(starts) else end
        for i, (_, e) in enumerate(sounding):
            rest_end = sounding[i + 1][0] if i + 1 < len(sounding) else end
            if s < e < up and rest_end - e >= bpb:
                up = e
                break
        if s + down_after < up:
            pairs.append((s + down_after, up))
    return pairs


def write_pedal(chart_path, pairs):
    chart = json.loads(Path(chart_path).read_text())
    end = max(Fraction(n["beat"]) + Fraction(n["duration"]) for n in chart["notes"])
    rows = [[round(float(d), 4), round(float(min(u, end)), 4)] for d, u in pairs if d < end]
    out = Path(chart_path).with_name("pedal.json")
    out.write_text(json.dumps({"pedal": rows}) + "\n")
    print(f"{out}: {len(rows)} pairs", file=sys.stderr)


def self_test():
    ly = r'''\new Dynamics = "ped" { \repeat volta 2 { \partial 8 s8 s4\sustainOn s16. s32\sustainOff }
      \alternative { { s4 } { s4.\sustainOn } } \repeat unfold 2 { s4. } s4 s16. s32\sustainOff }'''
    # Pickup 0.5, then a bar (on at 0.5, off at 1.875); alternatives of 1 and 1.5 (on at 3); two unfolded bars (4.5-7.5);
    # a last bar (off at 8.875). The volta body plays once, as notation MIDI plays it.
    assert ly_pedal(ly, "ped") == [(Fraction(1, 2), Fraction(15, 8)), (3, Fraction(71, 8))], ly_pedal(ly, "ped")
    assert clip([(0, 3), (5, 6)], [(2, 6, 10)]) == [(10, 11), (13, 14)]
    assert pairs_of(sorted([(0, True), (2, True), (2, False), (3, False)], key=lambda e: (e[0], e[1]))) == [(0, 2), (2, 3)]
    assert segments(bars=(1, 2), pickup=1, bar_starts=([0, 1, 5], [1, 4, 4])) == [(0, 5, 0)]
    assert segments(bars=(1, 2), pickup=Fraction(1), bar_starts=([0, 1, 5], [4, 4, 4])) == [(0, 5, 3)]
    chart = {"bpm": 120, "beatsPerBar": 4, "notes": [  # 0.5 s a beat: down 0.12 beats after, up 0.04 before
        {"hand": "L", "pitch": 48, "beat": 0, "duration": 2}, {"hand": "L", "pitch": 43, "beat": 2, "duration": 2},
        {"hand": "L", "pitch": 43, "beat": 8, "duration": 4}, {"hand": "R", "pitch": 72, "beat": 0, "duration": 12}]}
    got = [(float(d), float(u)) for d, u in harmony_pedal(chart)]
    assert got == [(0.12, 1.96), (2.12, 4.0), (8.12, 12.0)], got  # the second lifts at the bar's rest
    print("self-test: pass")


def main():
    if "--self-test" in sys.argv:
        return self_test()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["pedal", "velocity"])
    ap.add_argument("chart")
    ap.add_argument("--midi")
    ap.add_argument("--ly")
    ap.add_argument("--context")
    ap.add_argument("--harmony", action="store_true")
    ap.add_argument("--bars")
    ap.add_argument("--pickup", type=Fraction, default=0)
    ap.add_argument("--spans")
    ap.add_argument("--start-beat", type=Fraction, default=0)
    ap.add_argument("--mark", choices=list(LADDER))
    a = ap.parse_args()
    if a.what == "velocity":
        chart = json.loads(Path(a.chart).read_text())
        for n in chart["notes"]:
            n["velocity"] = LADDER[a.mark]
        Path(a.chart).write_text(json.dumps(chart, indent=2, ensure_ascii=False) + "\n")
        return
    spans = [tuple(Fraction(x) for x in s.split("-")) for s in a.spans.split(",")] if a.spans else None
    bars = tuple(int(x) for x in a.bars.split("-")) if a.bars else None
    if a.harmony:
        return write_pedal(a.chart, harmony_pedal(json.loads(Path(a.chart).read_text())))
    if a.midi:
        pairs, mid = midi_pedal(a.midi)
        from convert import bar_starts

        if bars:
            ticks, lengths = bar_starts(mid, bars[1], int(a.pickup * mid.ticks_per_beat))
            starts = ([Fraction(t, mid.ticks_per_beat) for t in ticks], lengths)
        segs = segments(bars, a.pickup, spans, a.start_beat, starts if bars else None)
    else:
        pairs = ly_pedal(Path(a.ly).read_text(), a.context)
        segs = segments(None, 0, spans, a.start_beat)
    write_pedal(a.chart, clip(pairs, segs))


if __name__ == "__main__":
    main()
