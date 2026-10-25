#!/usr/bin/env python3
"""A chart's demo performance (spec: demo-performance): its pedal.json and its velocities, from the cited score.

Pedal, three sources, in order of preference:
  --midi    the score's MIDI export's CC64 (LilyPond renders \\sustainOn/Off that way), over the chart's bars or spans
  --ly      a LilyPond pedal line (a Dynamics or Staff context of skips with \\sustainOn/Off) the MIDI didn't render
  --harmony the per-harmony rule, for a score with no Ped. marks (an arrangement choice; decision demo-performance-pedal)
Velocity, on the library's one ladder (decision demo-performance-dynamics): --mark pp sets every note to that mark's
level, for an excerpt under a single printed mark; --marks lists an excerpt's marks in chart beats, as read from the score:
  R@4=p        a level from beat 4 on, in that staff (L, R, or RL for a mark between the staves)
  RL@8-18~+16  a hairpin: ramps linearly from the level at 8 to it +16 (or -16) at 18, then holds
  R@19!        an accent or sf: one step (+16) on the notes starting at 19, in that staff, only
Before the first mark a staff is at mf. dynamics reads that list off the cited LilyPond instead: --right and --left name
the voices on each staff, and --midi with --bars (or --spans) places them, as convert.py placed the chart.

  python3 perform.py pedal chart.json --midi song.mid --pickup 1 --bars 1-13
  python3 perform.py pedal chart.json --ly song.ly --context pedalOne --spans 0-12,0-11 --start-beat 1
  python3 perform.py pedal chart.json --harmony
  python3 perform.py velocity chart.json --mark pp
  python3 perform.py velocity chart.json --marks "L@0=p,R@4=p,RL@8-18~+16,R@19!"
  python3 perform.py dynamics chart.json --ly song.ly --right top,middle --left bottom --midi song.mid --bars 22-31
  python3 perform.py --self-test
Writes pedal.json next to the chart, or the chart in place with only velocity fields changed.
"""
import argparse
import json
import re
import sys
from bisect import bisect_right
from collections import Counter
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


# A note, chord repeat, rest or skip, not inside a word (Staff.SustainPedal holds no note): name, octave marks, duration.
NOTE = re.compile(r"(?<![A-Za-z0-9._-])([a-h](?:isis|eses|is|es|ss|ff|s|f)?|[rRsq])(?![a-zA-Z])[',]*[!?]?")
DURATION = re.compile(r"(\d+)(\.*)(?:\*(\d+)(?:/(\d+))?)?")
DYNAMICS = {"ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "fz", "fp", "<", ">", "!", "cresc", "dim",
            "decresc", "accent"}
PEDAL = {"sustainOn": "down", "sustainOff": "up", "sustainDown": "down", "sustainUp": "up"}


def ly_voice(text, name, unfold=False, marks=(), trace=None):
    """A LilyPond voice or context, read for timing only: ([note onsets], [(onset, mark)]), in quarter notes from its start.

    Repeats play the way the score's MIDI plays them: a volta repeat once with its alternatives in turn, or with
    unfold=True (a MIDI made through \\unfoldRepeats) its body before each alternative. A mark is postfix: it belongs to
    the onset of the note, chord, rest or skip it follows. Marks read: dynamics, hairpins, accents, the sustain pedal, and any
    names in `marks` (a score's own pedal macros). Pitches, markup, scheme and strings are skipped. `trace`, if given, gets
    (text index, onset) for every note, chord, rest and skip read."""
    text = re.sub(r"%\{.*?%\}|%[^\n]*", "", text, flags=re.S)
    start = (re.search(r'\\new\s+\w+\s*=\s*"' + re.escape(name) + r'"\s*(?=\{)', text)  # a context with its music here
             or re.search(r"^\s*" + re.escape(name) + r"\s*=", text, re.M))  # or a variable
    if not start:
        raise SystemExit(f"no voice {name!r}")
    i = text.index("{", start.end())
    alias, called = {}, {}  # the score's variables: `pd = \sustainDown` stands for its command; music is read where called
    music_value = re.compile(r"(?:\\(?:relative|fixed)\s+[a-g](?:is|es|s)*[',]*\s*|\\transpose\s+\S+\s+\S+\s*)?\{")
    for m in re.finditer(r"^\s*([a-zA-Z]+)\s*=\s*", text, re.M):
        a = re.compile(r"\\([a-zA-Z]+)[ \t]*$", re.M).match(text, m.end())
        if a:
            alias[m.group(1)] = a.group(1)
        elif v := music_value.match(text, m.end()):  # not a header's string or a \markup or \override value
            called[m.group(1)] = v.end() - 1
    notes, out = [], []
    state = {"t": Fraction(0), "onset": Fraction(0), "dur": Fraction(1), "scale": Fraction(1), "tied": False}

    def skip_balanced(j, o, c):
        depth = 0
        for k in range(j, len(text)):
            depth += (text[k] == o) - (text[k] == c)
            if depth == 0:
                return k + 1
        return len(text)

    def skip_arg(j):  # one argument: a string, a scheme value, a braced block, or a word
        j = len(text[j:]) - len(text[j:].lstrip()) + j
        if text[j] == '"':
            return re.compile(r'"(?:\\.|[^"\\])*"').match(text, j).end()
        if text[j] == "#":
            return skip_scheme(j)
        if text[j] == "{":
            return skip_balanced(j, "{", "}")
        return re.compile(r"[^\s{}]+").match(text, j).end()

    def skip_scheme(j):
        j += 1
        while text[j] in "#'`":
            j += 1
        if text[j] == "(":
            return skip_balanced(j, "(", ")")
        if text[j] == '"':
            return skip_arg(j)
        return re.compile(r"[^\s{}]*").match(text, j).end()

    def length(j):  # the duration written at j, or the last one (LilyPond carries it); returns (length, index after)
        m = DURATION.match(text, j)
        if m:
            d = Fraction(4, int(m.group(1))) * sum(Fraction(1, 2 ** k) for k in range(len(m.group(2)) + 1))
            if m.group(3):
                d *= Fraction(int(m.group(3)), int(m.group(4) or 1))
            state["dur"], j = d, m.end()
        return state["dur"] * state["scale"], j

    def skip_markup(j):  # \markup's argument: its own commands, then a braced block, a string or a word
        while True:
            j = len(text[j:]) - len(text[j:].lstrip()) + j
            m = re.compile(r"\\[a-zA-Z-]+").match(text, j)
            if not m:
                return skip_arg(j)
            j = m.end()

    def event(d, sounding, at):  # a tied-into note sounds on, but isn't struck again
        state["onset"] = state["t"]
        if trace is not None:
            trace.append((at, state["t"]))
        if sounding and not state["tied"]:
            notes.append(state["t"])
        state["t"] += d
        state["tied"] = False

    def music(j, until="}", stop=()):  # read music from j to the closing `until` (the index after it), or to a `stop`
        while True:
            j = len(text[j:]) - len(text[j:].lstrip()) + j
            if j >= len(text):
                return j
            c = text[j]
            if until and text.startswith(until, j):
                return j + len(until)
            if any(text.startswith(s, j) for s in stop):
                return j
            if text.startswith("<<", j):
                j = simultaneous(j + 2)
                continue
            if c == "{":
                j = music(j + 1)
                continue
            if c == "<":  # a chord: its notes sound together, for the duration after the >
                at = j
                d, j = length(text.index(">", j) + 1)
                event(d, True, at)
                continue
            if c in '"':
                j = skip_arg(j)
                continue
            if c == "#":
                j = skip_scheme(j)
                continue
            if c == "\\":
                m = re.compile(r"\\([a-zA-Z]+|.)").match(text, j)
                w, j = m.group(1), m.end()
                w = alias.get(w, w)
                if w in ("<", ">", "!") or w in DYNAMICS or w in PEDAL or w in marks:
                    out.append((state["onset"], PEDAL.get(w, w)))
                elif w == "repeat":
                    kind, n = re.compile(r"\s*(\w+)\s+(\d+)").match(text, j).groups()
                    j = re.compile(r"\s*(\w+)\s+(\d+)").match(text, j).end()
                    j = len(text[j:]) - len(text[j:].lstrip()) + j
                    body = j
                    end = skip_balanced(j, "{", "}") if text[j] == "{" else skip_arg(j)
                    alt = re.compile(r"\s*\\alternative\s*\{").match(text, end)
                    alts = []
                    if alt:
                        k = alt.end()
                        while True:
                            k = len(text[k:]) - len(text[k:].lstrip()) + k
                            if text[k] == "}":
                                break
                            alts.append(k)
                            k = skip_balanced(k, "{", "}")
                        after = k + 1
                    else:
                        after = end
                    times = int(n) if kind == "unfold" or (unfold and not alts) else 1
                    if kind == "volta" and unfold and alts:
                        for a in alts:
                            music(body + 1)
                            music(a + 1)
                    else:
                        for _ in range(times):
                            music(body + 1) if text[body] == "{" else None
                        for a in alts:
                            music(a + 1)
                    j = after
                elif w in ("times", "tuplet"):
                    a2, b2 = re.compile(r"\s*(\d+)/(\d+)").match(text, j).groups()
                    j = re.compile(r"\s*(\d+)/(\d+)").match(text, j).end()
                    f = Fraction(int(a2), int(b2)) if w == "times" else Fraction(int(b2), int(a2))
                    state["scale"] *= f
                    j = len(text[j:]) - len(text[j:].lstrip()) + j
                    j = music(j + 1)
                    state["scale"] /= f
                elif w in ("grace", "acciaccatura", "appoggiatura", "afterGrace", "slashedGrace"):
                    t, scale = state["t"], state["scale"]
                    state["scale"] = Fraction(0)  # graces take no time
                    j = len(text[j:]) - len(text[j:].lstrip()) + j
                    if text[j] == "{":
                        j = music(j + 1)
                    else:
                        m = NOTE.match(text, j)
                        j = length(m.end())[1] if m else j
                    state["scale"], state["t"] = scale, t
                elif w in called and w != name:  # a variable's music, as if written here
                    music(called[w] + 1)
                elif w in ("markup", "mark", "bar", "clef", "set", "override", "once", "tempo", "key", "time", "partial",
                           "relative", "transpose", "change", "context", "new", "unset", "revert", "tweak",
                           "octaveCheck"):
                    if w == "markup":
                        j = skip_markup(j)
                    elif w in ("bar", "clef", "change", "octaveCheck"):  # one word; \octaveCheck's pitch takes no time
                        j = skip_arg(j)
                        if w == "change":
                            j = skip_arg(skip_arg(j))  # Staff = "name"
                    elif w == "key":
                        j = skip_arg(j)  # the pitch; \major follows as a command
                    elif w == "time":
                        j = re.compile(r"\s*[\d/,]+").match(text, j).end()
                    elif w == "partial":  # its duration carries to the next note, as any written duration does
                        j = length(len(text[j:]) - len(text[j:].lstrip()) + j)[1]
                    elif w == "relative":
                        m = NOTE.match(text, len(text[j:]) - len(text[j:].lstrip()) + j)
                        j = m.end() if m and text[j:].lstrip()[0] != "{" else j
                    elif w == "transpose":
                        j = skip_arg(skip_arg(j))
                    elif w in ("set", "override", "unset", "revert", "once", "tweak", "context", "new", "tempo", "mark"):
                        pass  # their arguments are words, strings, scheme or numbers: harmless when skipped one by one
                continue
            m = NOTE.match(text, j)
            if m:
                at = j
                d, j = length(m.end())
                event(d, m.group(1) not in ("r", "R", "s"), at)
                continue
            if c in "-^_" and text.startswith(">", j + 1):  # an accent, ->
                out.append((state["onset"], "accent"))
                j += 2
                continue
            state["tied"] |= c == "~"
            j += 1  # anything else: ties, slurs, beams, articulation, fingering, bar checks

    def simultaneous(j):  # from after <<, all from one time; the slowest sets the time after. Returns the index after >>
        t0, ends = state["t"], []
        if branch_has(j, "\\\\"):  # voices split by \\: each reads on to the next \\
            while True:
                j = music(j, "\\\\") if branch_has(j, "\\\\") else music(j, ">>")
                ends.append(state["t"])
                if text.startswith(">>", j - 2):
                    break
                state["t"] = t0
        else:  # each braced block or nested << >> (\context Voice = "1" { ... } too) starts at t0
            while True:
                j = len(text[j:]) - len(text[j:].lstrip()) + j
                if j >= len(text) or text.startswith(">>", j):
                    j += 2
                    break
                state["t"] = t0
                if text.startswith("<<", j):
                    j = simultaneous(j + 2)
                elif text[j] == "{":
                    j = music(j + 1)
                else:  # a header, \voiceOne, a lone note: read up to the next block
                    j = music(j, None, ("{", "<<", ">>"))
                ends.append(state["t"])
        state["t"] = max(ends, default=t0)
        return j

    def branch_has(j, sep):  # does a << >> branch end at a \\ before its >>?
        depth, k = 0, j
        while k < len(text):
            if text.startswith("<<", k):
                depth += 1
                k += 2
                continue
            if text.startswith(">>", k):
                if depth == 0:
                    return False
                depth -= 1
                k += 2
                continue
            if text.startswith(sep, k) and depth == 0:
                return True
            k += 1
        return False

    music(i + 1)
    return notes, out


def ly_unfolded_marks(text, name, ref):
    """The marks of a line written once beside voices that repeat (Wild Horseman's dynamics, outside its \\repeat volta),
    placed everywhere `ref` plays that written point when its repeats are unfolded: a mark takes the offset of the last
    note, rest or skip of `ref` at or before it."""
    written, played = [], []
    ly_voice(text, ref, trace=written)
    ly_voice(text, ref, unfold=True, trace=played)
    plays, count, seen, points = {}, Counter(i for i, _ in written), Counter(), []
    for i, t in played:
        plays.setdefault(i, []).append(t)
    for i, t in written:  # a note read once as written but twice played (a volta body) maps to both plays
        u = plays.get(i, [])
        points.append((t, [u[seen[i]]] if len(u) == count[i] else u))
        seen[i] += 1
    points.sort(key=lambda p: p[0])
    out = []
    for t, m in ly_voice(text, name)[1]:
        k = bisect_right([w for w, _ in points], t) - 1
        out += [(t - points[k][0] + u, m) for u in points[k][1]] if k >= 0 else [(t, m)]
    return sorted(out, key=lambda e: e[0])


def ly_pedal(text, name, down="sustainOn", up="sustainOff"):
    """A score's pedal marks -> [(down, up)] in quarter notes: its \\sustainOn/Off (or Down/Up), or its own macros."""
    _, marks = ly_voice(text, name, marks=(down, up))
    return pairs_of([(t, m in ("down", down)) for t, m in marks if m in ("down", "up", down, up)])


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


MARK = re.compile(r"^(R|L|RL|LR)@([\d./]+)(?:=(\w+)|-([\d./]+)~([+-]\d+)|(!))$")


def mark_velocities(notes, marks):
    """Each note's velocity from --marks (see the docstring): its staff's level at its onset, +16 if accented, 1-127."""
    sets, ramps, accents = {"R": [], "L": []}, {"R": [], "L": []}, {"R": set(), "L": set()}
    for item in marks.split(","):
        m = MARK.match(item.strip())
        if not m:
            raise SystemExit(f"--marks: can't read {item!r}")
        hands, at = set(m.group(1)), Fraction(m.group(2))
        for h in hands:
            if m.group(3):
                sets[h].append((at, LADDER[m.group(3)]))
            elif m.group(4):
                ramps[h].append((at, Fraction(m.group(4)), int(m.group(5))))
            else:
                accents[h].add(at)

    def level(h, t):  # the latest set or finished ramp before t, or the ramp t falls inside
        lv, events = LADDER["mf"], sorted([(a, 0, v) for a, v in sets[h]] + [(a, 1, (b, d)) for a, b, d in ramps[h]])
        for a, kind, v in events:
            if a > t:
                break
            if kind == 0:
                lv = v
            else:
                b, d = v
                lv = lv + d * min(Fraction(1), (t - a) / (b - a)) if t < b else lv + d
        return lv

    for n in notes:
        t = Fraction(n["beat"]).limit_denominator(4096)
        accent = any(abs(t - a) < Fraction(1, 96) for a in accents[n["hand"]])
        n["velocity"] = max(1, min(127, round(level(n["hand"], t) + (16 if accent else 0))))


HAIRPIN = {"<": 1, "cresc": 1, ">": -1, "dim": -1, "decresc": -1}


def ly_marks(voices, segs, end):
    """{hand: [(source time, mark)]} as ly_voice reads them -> --marks items in chart beats, on decision
    demo-performance-dynamics's rules. A level or hairpin sets its own staff, and the other staff too unless that staff
    has its own at that beat; a hairpin (or cresc./dim.) runs to the next mark or \\! in its staff, or the excerpt's end;
    sf, sfz, fz and accents are their own staff's only; fp is an accent, then p. A level before the excerpt (or between its
    spans) holds from where the excerpt picks up."""
    def beats(t, level):  # a source time in every span that plays it; a level outside them, the next span's start
        got = [t - lo + shift for lo, hi, shift in segs if lo <= t < hi]
        return got or ([shift for lo, hi, shift in sorted(segs) if lo > t][:1] if level else [])

    sets, ramps, accents = {"R": {}, "L": {}}, {"R": [], "L": []}, {"R": [], "L": []}
    for h, marks in voices.items():
        opened = None
        order = lambda m: 0 if m == "!" else 2 if m in HAIRPIN else 1  # on one note: \\! ends, the level sets, < starts
        for b, _, _, m in sorted((b, order(m), i, m) for i, (t, m) in enumerate(sorted(marks, key=lambda x: x[0]))
                                 for b in beats(t, m in LADDER or m == "fp")):
            if opened and (m in LADDER or m in HAIRPIN or m in ("!", "fp")):
                if b > opened[0]:
                    ramps[h].append((opened[0], b, opened[1]))
                opened = None
            if m in LADDER or m == "fp":
                sets[h][b] = "p" if m == "fp" else m  # the last at a beat wins
            if m in ("sf", "sfz", "fz", "fp", "accent"):
                accents[h].append(b)
            if m in HAIRPIN:
                opened = (b, HAIRPIN[m])
        if opened and end > opened[0]:
            ramps[h].append((opened[0], end, opened[1]))
    out = []
    for h, o in (("R", "L"), ("L", "R")):
        own = set(sets[h]) | {r[0] for r in ramps[h]}
        out += [f"{h}@{b}={m}" for b, m in sorted({**{b: m for b, m in sets[o].items() if b not in own}, **sets[h]}.items())]
        out += [f"{h}@{x}-{y}~{16 * s:+d}" for x, y, s in sorted(ramps[h] + [r for r in ramps[o] if r[0] not in own])]
        out += [f"{h}@{b}!" for b in sorted(set(accents[h]))]
    return out


def source_time(beat, segs):
    """The inverse of segments(): a chart beat -> its time in the source, or None if no segment holds it."""
    for lo, hi, shift in segs:
        if shift <= beat < shift + (hi - lo):
            return beat - shift + lo
    return None


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
    notes = [{"hand": h, "beat": b} for h, b in [("L", 0), ("R", 4), ("R", 8), ("L", 13), ("R", 18), ("R", 19), ("R", 20)]]
    mark_velocities(notes, "L@0=p,R@4=p,RL@8-18~+16,R@19!,R@20=p")
    assert [n["velocity"] for n in notes] == [49, 49, 49, 57, 65, 81, 49], [n["velocity"] for n in notes]
    # From the score: the last level before the excerpt holds from its start and reaches the left staff; a < written
    # before its note's mp still starts from mp; each staff's hairpin at 1 stays its own, so the right's mp doesn't reach
    # the left; the left's fp is its accent and both staves' p; a spans' repeat repeats its marks.
    got = ly_marks({"R": [(0, "f"), (1, "p"), (3, "<"), (3, "mp"), (5, "!"), (6, "accent")], "L": [(3, ">"), (7, "fp")]},
                   [(2, 8, 0)], 6)
    assert got == ["R@0=p", "R@1=mp", "R@5=p", "R@1-3~+16", "R@4!", "L@0=p", "L@5=p", "L@1-5~-16", "L@5!"], got
    assert ly_marks({"R": [(1, "p")]}, [(0, 2, 0), (0, 2, 2)], 4) == ["R@1=p", "R@3=p", "L@1=p", "L@3=p"]
    assert ly_voice(r"v = { c4-> d\accent e^> f\sf }", "v")[1] == [(0, "accent"), (1, "accent"), (2, "accent"), (3, "sf")]
    # Happy Farmer: a << >> with no \\ holds simultaneous voices, a \context header's words included; a \\ still splits.
    ly = r'v = { c4 << { d4-> e-> } \context Voice = "1" { \voiceOne f2\sf } >> g4-> << { a4 } \\ { b8-> c } >> d4-> }'
    assert ly_voice(ly, "v")[1] == [(1, "accent"), (2, "accent"), (1, "sf"), (3, "accent"), (4, "accent"), (5, "accent")]
    # The Fantaisie-Impromptu: a staff calls its parts by name, and `pd` stands for \sustainDown.
    ly = "pd = \\sustainDown\npart = \\relative c'' { c4\\p\\pd d-> }\nup = { r1 \\part e4\\f }"
    assert ly_voice(ly, "up")[1] == [(4, "p"), (4, "down"), (5, "accent"), (6, "f")], ly_voice(ly, "up")[1]
    assert ly_voice(r"v = { c4 \slashedGrace d8 e4-> \slashedGrace{f16[ g]} a4\f }", "v")[1] == [(1, "accent"), (2, "f")]
    assert ly_voice(r"v = { c1 \octaveCheck c e4-> }", "v")[1] == [(4, "accent")]  # Rachmaninoff's: a check, not a note
    assert ly_voice(r"v = { h16 his as g c4\fz }", "v")[1] == [(1, "fz")]  # the Revolutionary's German names: h is B
    assert ly_marks({"R": [(0, "f"), (1, "fz")]}, [(0, 2, 0)], 2) == ["R@0=f", "R@1!", "L@0=f"]  # fz: as sf
    assert ly_voice(r"v = { \partial 8 c\( d4-> }", "v")[1] == [(Fraction(1, 2), "accent")]  # its lower's pickup: an eighth
    # Wild Horseman: the dynamics line is written once beside a volta (pickup, 2 bars, 2 alternatives of a bar); unfolded,
    # the body's marks land in both passes and the alternatives' and the coda's after them.
    ly = r"""up = { \partial 4 c4 \repeat volta 2 { d2 e2 } \alternative { { f2 } { g2 } } a2 b2 }
      dyn = { s4\mf s2\sf s2 s2\p s2\f s2 s2\sf }"""
    assert ly_voice(ly, "dyn", unfold=True) == ly_voice(ly, "dyn")  # it has no repeat of its own
    # Played: c 0, d 1 and 7, e 3 and 9, f 5, g 11, a 13, b 15.
    assert ly_unfolded_marks(ly, "dyn", "up") == [(0, "mf"), (1, "sf"), (5, "p"), (7, "sf"), (11, "f"), (15, "sf")]
    print("self-test: pass")


def main():
    if "--self-test" in sys.argv:
        return self_test()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("what", choices=["pedal", "velocity", "dynamics"])
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
    ap.add_argument("--marks")
    ap.add_argument("--right", help="dynamics: the LilyPond voices on the right hand's staff, comma-separated")
    ap.add_argument("--left", help="dynamics: the voices on the left hand's staff")
    ap.add_argument("--unfold", action="store_true", help="the MIDI plays repeats out (made with \\unfoldRepeats)")
    ap.add_argument("--down", default="sustainOn", help="pedal --ly: the score's own pedal-down command, if a macro")
    ap.add_argument("--up", default="sustainOff", help="pedal --ly: its pedal-up command")
    a = ap.parse_args()
    if a.what == "velocity":
        chart = json.loads(Path(a.chart).read_text())
        if a.marks:
            mark_velocities(chart["notes"], a.marks)
        else:
            for n in chart["notes"]:
                n["velocity"] = LADDER[a.mark]
        Path(a.chart).write_text(json.dumps(chart, indent=2, ensure_ascii=False) + "\n")
        return
    spans = [tuple(Fraction(x) for x in s.split("-")) for s in a.spans.split(",")] if a.spans else None
    bars = tuple(int(x) for x in a.bars.split("-")) if a.bars else None
    if a.harmony:
        return write_pedal(a.chart, harmony_pedal(json.loads(Path(a.chart).read_text())))
    if a.what == "dynamics":
        return dynamics(a, bars, spans)
    if a.midi and not a.ly:
        pairs, _ = midi_pedal(a.midi)
        segs, _ = midi_segments(a.midi, bars, a.pickup, spans, a.start_beat)
    else:
        pairs = ly_pedal(Path(a.ly).read_text(), a.context, a.down, a.up)
        segs = midi_segments(a.midi, bars, a.pickup, spans, a.start_beat)[0] if bars else segments(None, 0, spans, a.start_beat)
    write_pedal(a.chart, clip(pairs, segs))


def midi_segments(midi, bars, pickup, spans, start_beat):
    """segments() with --bars measured on the score's MIDI, as convert.py measured them."""
    import mido
    from convert import bar_starts

    mid = mido.MidiFile(midi)
    starts = None
    if bars:
        ticks, lengths = bar_starts(mid, bars[1], int(pickup * mid.ticks_per_beat))
        starts = ([Fraction(t, mid.ticks_per_beat) for t in ticks], lengths)
    return segments(bars, pickup, spans, start_beat, starts), mid


def dynamics(a, bars, spans):
    """Velocities from the score's marks, placed by its LilyPond voices. Refuses unless every chart note maps back to a
    note-on of its pitch in the MIDI, so a wrong bar range can't put marks on the wrong notes."""
    segs, mid = midi_segments(a.midi, bars, a.pickup, spans, a.start_beat)
    onsets = set()
    for track in mid.tracks:
        t = 0
        for msg in track:
            t += msg.time
            if msg.type == "note_on" and msg.velocity:
                onsets.add((Fraction(t, mid.ticks_per_beat), msg.note))
    text = Path(a.ly).read_text()
    def marks_of(v, names):  # with --unfold, a line with no repeat of its own repeats with the first voice that has one
        own = ly_voice(text, v, unfold=a.unfold)
        if a.unfold and own == ly_voice(text, v):
            ref = next((r for r in names if ly_voice(text, r, unfold=True) != ly_voice(text, r)), None)
            if ref:
                return ly_unfolded_marks(text, v, ref)
        return own[1]

    voices = {h: [m for v in names.split(",") for m in marks_of(v, names.split(","))]
              for h, names in (("R", a.right), ("L", a.left)) if names}
    chart = json.loads(Path(a.chart).read_text())
    end = max(Fraction(n["beat"]) + Fraction(n["duration"]) for n in chart["notes"])
    marks = ",".join(ly_marks(voices, segs, end))
    times = [source_time(Fraction(n["beat"]).limit_denominator(48), segs) for n in chart["notes"]]
    off = [n["id"] for n, t in zip(chart["notes"], times) if t is None or (t, n["pitch"]) not in onsets]
    if off:
        raise SystemExit(f"{len(off)} of {len(times)} notes aren't note-ons in the MIDI at their mapped time (first {off[:5]})")
    print(f"--marks {marks}", file=sys.stderr)
    mark_velocities(chart["notes"], marks)
    Path(a.chart).write_text(json.dumps(chart, indent=2, ensure_ascii=False) + "\n")
    levels = sorted({n["velocity"] for n in chart["notes"]})
    print(f"{a.chart}: {len(times)} notes, velocities {levels[0]}–{levels[-1]} ({len(levels)} levels)", file=sys.stderr)


if __name__ == "__main__":
    main()
