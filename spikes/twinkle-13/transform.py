"""Twinkle 13: transform Mozart's K. 265 (source/, see SOURCE.md) into the MIDI files in out/.

  .venv/bin/python transform.py          write every out/*.mid and print a line per file
  .venv/bin/python transform.py stats    per-section numbers behind analysis.md
  .venv/bin/python transform.py check    fail unless every out/*.mid fits the piano and leaves no note on

Every note comes from the source: the score (source/K265.xml) or the theme's Roman numerals
(source/M265_00_*_a.krn). The code moves, repeats, doubles, re-voices and arpeggiates them; it writes no melody.
Times are in quarter notes (Fraction); bars use the source's numbering: section k is bars 24k+1..24k+24.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction as F

import mido

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source")
OUT = os.path.join(HERE, "out")
STEP = dict(C=0, D=2, E=4, F=5, G=7, A=9, B=11)
LOWEST, HIGHEST, POLYPHONY = 21, 108, 192  # the DGX-660's 88 keys (A0-C8) and its polyphony
P, MF, FO, FF = 60, 80, 96, 112  # p, mf, f, ff as velocities


# ---------- source ----------

def parse_score(path=os.path.join(SRC, "K265.xml")):
    """-> notes [start, dur, pitch, hand] (hand 0 = right, 1 = left), bar_start {bar: beat}, bar_len {bar: beats}.

    Ties are merged. Grace notes are dropped (the source has 6; it has no trills or turns at all).
    """
    root = ET.parse(path).getroot()
    notes, bar_start, bar_len = [], {}, {}
    for hand, part in enumerate(root.findall("part")):  # P1 is the treble staff, P2 the bass staff
        div, beats, t0, tied = None, None, F(0), {}
        for m in part.findall("measure"):
            n = int(m.get("number"))
            for a in m.findall("attributes"):
                if a.findtext("divisions"):
                    div = int(a.findtext("divisions"))
                if a.find("time") is not None:
                    beats = F(int(a.find("time").findtext("beats")) * 4, int(a.find("time").findtext("beat-type")))
            bar_start.setdefault(n, t0)
            bar_len.setdefault(n, beats)
            pos, last, end = F(0), F(0), F(0)
            for e in m:
                if e.tag in ("backup", "forward"):
                    d = F(int(e.findtext("duration")), div)
                    pos += d if e.tag == "forward" else -d
                if e.tag != "note" or e.find("grace") is not None:
                    continue
                d = F(int(e.findtext("duration")), div)
                if e.find("chord") is None:
                    last = pos
                    pos += d
                end = max(end, pos)
                if e.find("rest") is not None:
                    continue
                p = e.find("pitch")
                pitch = (int(p.findtext("octave")) + 1) * 12 + STEP[p.findtext("step")] + int(float(p.findtext("alter") or 0))
                ties = {t.get("type") for t in e.findall("tie")}
                key = (hand, pitch)
                if "stop" in ties and key in tied:
                    note = tied.pop(key)
                    note[1] = t0 + last + d - note[0]
                else:
                    note = [t0 + last, d, pitch, hand]
                    notes.append(note)
                if "start" in ties:
                    tied[key] = note
            if end != beats:
                print(f"# bar {n} hand {hand}: filled {end} of {beats} beats", file=sys.stderr)
            t0 += beats
    return notes, bar_start, bar_len


def take(notes, bar_start, bar_len, bars, vel=None):
    """The notes of `bars` (an iterable of bar numbers, repeats allowed) laid end to end from beat 0.
    vel: {bar: velocity}, the last key at or before a bar wins (dynamics read from the scan, see SOURCE.md)."""
    out, t = [], F(0)
    for b in bars:
        s, e = bar_start[b], bar_start[b] + bar_len[b]
        v = vel[max(k for k in vel if k <= b)] if vel else MF
        out += [[t + n[0] - s, n[1], n[2], v, 0, n[3]] for n in notes if s <= n[0] < e]
        t += bar_len[b]
    return out, t


def parse_harmony():
    """The theme's Roman numerals (TAVERN annotator A) -> [(start, dur, numeral)] over its 24 bars (48 beats)."""
    out, t = [], F(0)
    for name in ("M265_00_01a_a.krn", "M265_00_02b_a.krn", "M265_00_03a_a.krn"):
        for line in open(os.path.join(SRC, name)):
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 2 or cols[1][:1] in "*=!." or not cols[1]:
                continue
            m = re.match(r"(\d+)(\.?)(.*)", cols[1])
            d = F(4, int(m.group(1))) * (F(3, 2) if m.group(2) else 1)
            out.append((t, d, m.group(3)))
            t += d
    return out


SCALE = [0, 2, 4, 5, 7, 9, 11]
DEGREE = {"I": 0, "ii": 1, "iii": 2, "IV": 3, "V": 4, "vi": 5, "viio": 6}


def chord(numeral):
    """'V7', 'Ib', 'Cc' (cadential 6-4) ... -> (pitch classes in C major, bass pitch class)."""
    m = re.fullmatch(r"(Cc|viio|iii|ii|IV|vi|V|I)(7?)([bc]?)", numeral)
    name, seventh, inv = m.groups()
    if name == "Cc":
        name, inv = "I", "c"
    i = DEGREE[name]
    pcs = [SCALE[(i + k) % 7] for k in (0, 2, 4, 6)[: 4 if seventh else 3]]
    return pcs, pcs[{"": 0, "b": 1, "c": 2}[inv]]


def harmony_at(harm, t):
    return next(h for s, d, h in harm if s <= t < s + d)


def minore(pitch):
    """C major -> C harmonic minor: E -> Eb, A -> Ab (Mozart's Var 8 move)."""
    return pitch - 1 if pitch % 12 in (4, 9) else pitch


# ---------- writing ----------

def write(name, notes, tempos, meters, ccs=(), programs=None):
    """notes [start, dur, pitch, vel, ch, ...]; tempos/meters [(beat, bpm)] / [(beat, num, den)];
    ccs [(beat, ch, control, value)]; programs {ch: GM program}. One track, 480 ticks per quarter."""
    tpq = 480
    tick = lambda b: int(round(b * tpq))
    ev = []
    for ch, prog in {0: 0, **(programs or {})}.items():
        ev.append((0, 0, mido.Message("program_change", channel=ch, program=prog)))
    for b, bpm in tempos:
        ev.append((tick(b), 0, mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm))))
    for b, num, den in meters:
        ev.append((tick(b), 0, mido.MetaMessage("time_signature", numerator=num, denominator=den)))
    for b, ch, c, v in ccs:
        ev.append((tick(b), 1, mido.Message("control_change", channel=ch, control=c, value=v)))
    # A re-struck key cuts the note before it, so an earlier note-off can't silence a later note-on.
    last = {}
    for n in sorted(notes, key=lambda n: (n[0], n[2])):
        s, e = tick(n[0]), tick(n[0] + n[1])
        key = (n[4], n[2])
        if key in last and last[key][0] == s:  # the same key struck twice at once: one note
            continue
        if key in last:
            ps, pe, pv = last[key]
            if pe > s:
                pe = max(ps + 1, s)
            ev += [(ps, 3, mido.Message("note_on", channel=key[0], note=key[1], velocity=pv)),
                   (pe, 2, mido.Message("note_off", channel=key[0], note=key[1]))]
        last[key] = (s, max(e, s + 1), max(1, min(127, int(n[3]))))
    for (ch, p), (s, e, v) in last.items():
        ev += [(s, 3, mido.Message("note_on", channel=ch, note=p, velocity=v)),
               (e, 2, mido.Message("note_off", channel=ch, note=p))]
    ev.sort(key=lambda x: (x[0], x[1]))  # at one tick: meta, then CCs, then offs, then ons
    mid = mido.MidiFile(ticks_per_beat=tpq)
    tr = mido.MidiTrack()
    mid.tracks.append(tr)
    now = 0
    for t, _, msg in ev:
        tr.append(msg.copy(time=t - now))
        now = t
    os.makedirs(OUT, exist_ok=True)
    mid.save(os.path.join(OUT, name))
    print(f"{name:28} {len(notes):5} notes  {mid.length:6.1f} s")


# ---------- the band (spike R5: drums on channel 10, bass on channel 2 sounded distinct) ----------

KICK, SNARE, HAT, RIDE, CRASH = 36, 38, 42, 51, 49


def band(notes, length, beats_per_bar, start=F(0), double_time=False):
    """Drums and a bass under `notes`. The bass plays the lowest left-hand note at each beat, in the bass octave."""
    out = []
    step = F(1, 4) if double_time else F(1, 2)
    t = F(0)
    while t < length:
        beat = int(t) % beats_per_bar
        if t == int(t):
            out.append([start + t, F(1, 4), KICK if beat == 0 else SNARE if beat == beats_per_bar - 1 or beats_per_bar == 2 else KICK, FO if beat == 0 else MF, 9])
            lows = [n for n in notes if n[5] == 1 and n[0] <= t < n[0] + n[1]]
            if lows:
                p = min(n[2] for n in lows)
                while p >= 40:
                    p -= 12
                while p < 28:
                    p += 12
                out.append([start + t, F(9, 10), p, FO, 1])
        out.append([start + t, F(1, 8), HAT, MF if t == int(t) else P, 9])
        t += step
    out.append([start, F(1), CRASH, FO, 9])
    return out


# ---------- the outputs ----------

def sections():
    notes, bar_start, bar_len = parse_score()

    def rng(a, b):
        return list(range(a, b + 1))

    theme_bars = rng(1, 8) * 2 + rng(9, 24) * 2
    v12_bars = rng(289, 296) * 2 + rng(297, 312) + rng(297, 311) + rng(313, 324)  # 1st ending 312, 2nd 313
    theme_vel = {1: MF, 9: P, 17: MF}
    v12_vel = {289: FO, 297: P, 305: FO, 319: P, 321: 68, 322: 78, 323: 88, 324: FF}
    return notes, bar_start, bar_len, theme_bars, v12_bars, theme_vel, v12_vel


def write_all():
    notes, bar_start, bar_len, theme_bars, v12_bars, theme_vel, v12_vel = sections()
    theme, tl = take(notes, bar_start, bar_len, theme_bars, theme_vel)
    v12, vl = take(notes, bar_start, bar_len, v12_bars, v12_vel)
    two, three = [(0, 2, 4)], [(0, 3, 4)]
    write("01-theme.mid", theme, [(0, 120)], two)
    write("02-var12.mid", v12, [(0, 120)], three)
    write("03-var12-band.mid", v12 + band(v12, vl, 3), [(0, 120)], three, programs={1: 33})
    write("04-var12-minore.mid", [[n[0], n[1], minore(n[2])] + n[3:] for n in v12], [(0, 120)], three)
    write("05-var12-harpsichord.mid", v12, [(0, 120)], three, programs={0: 6})
    harm = parse_harmony()
    melody = theme_melody(notes, bar_start)
    for name, parts in (("06-var13a-cathedral.mid", "ICV"), ("07-var13b-storm.mid", "SBV"), ("08-var13c-full-arc.mid", "ICSBV")):
        write(name, *var13(parts, notes, bar_start, bar_len, melody, harm), programs={1: 33})


def theme_melody(notes, bar_start):
    """The top right-hand note at each onset of the theme's 24 bars -> [start, dur, pitch]."""
    by_onset = {}
    for n in notes:
        if n[3] == 0 and n[0] < bar_start[25]:
            if n[0] not in by_onset or n[2] > by_onset[n[0]][2]:
                by_onset[n[0]] = n
    return [[n[0], n[1], n[2]] for _, n in sorted(by_onset.items())]


def tones(pcs, lo, hi):
    return [p for p in range(lo, hi + 1) if p % 12 in pcs]


# Var 13 movements. Each returns (notes, ccs, length, bpm or [(beat, bpm)], (num, den)); notes start at 0.

def m_musicbox(melody, harm, **_):
    """Var 11's Adagio and its ornaments, further: the melody up two octaves in octaves, over 64th-note
    arpeggios of the theme's harmony sweeping four octaves, one per beat, too fast and wide for a left hand."""
    out, ccs = [], []
    for s, d, p in melody:
        if s >= 16:
            break
        out += [[s, d, p + 12, 70, 0, 0], [s, d, p + 24, 62, 0, 0]]
    for beat in range(16):
        h = harmony_at(harm, beat)
        pcs, bass = chord(h)
        run = tones(pcs, 48, 96)
        if beat % 2:
            run = run[::-1]
        for i, p in enumerate(run[:16]):
            out.append([beat + F(i, 16), F(1, 4), p, 40 + i, 0, 1])
        out.append([F(beat), F(1), tones([bass], 36, 47)[0], 58, 0, 1])
        ccs += [(beat, 0, 64, 0), (beat + F(1, 32), 0, 64, 127)]
    ccs.append((16, 0, 64, 0))
    return out, ccs, F(16), 54, (2, 4)


def m_canon(melody, **_):
    """Vars 8 and 9 imitate between the hands; here the first phrase is a four-voice canon across four octaves,
    a voice entering every two bars (the theme's own harmony lines it up)."""
    out = []
    for k, shift in enumerate((12, 0, -12, -24)):
        for s, d, p in melody:
            if s < 16:
                out.append([s + 4 * k, d, p + shift, 84 - 6 * k, 0, 0 if shift >= 0 else 1])
    return out, [], F(28), 100, (2, 4)


def m_storm(melody, harm, **_):
    """Var 8's minor and Var 7's runs, further: the theme's last 16 bars in C minor; every beat the melody in
    octaves, a 32nd-note cascade down two octaves through the chord, and a left-hand tremolo in octaves."""
    out = []
    for s, d, p in melody:
        if s >= 16:
            out += [[s - 16, d, minore(p) + 12, 104, 0, 0], [s - 16, d, minore(p), 96, 0, 0]]
    for beat in range(16, 48):
        pcs, bass = chord(harmony_at(harm, beat))
        pcs = [minore(x) % 12 for x in pcs]
        top = max(n[2] for n in melody if n[0] <= beat) + 12
        run = [x for x in tones(pcs, top - 24, top - 1)][::-1][:7]
        for i, x in enumerate(run):
            out.append([beat - 16 + F(i + 1, 8), F(1, 8), x, 78 - 3 * i, 0, 0])
        lo = tones([minore(bass) % 12], 28, 39)[0]
        for i in range(8):
            out.append([beat - 16 + F(i, 8), F(1, 8), lo + 12 * (i % 2), 72, 0, 1])
    return out, [], F(32), 132, (2, 4)


def m_band(notes, bar_start, bar_len, **_):
    """Var 12's 3/4 move, with the band: its first eight bars at a faster tempo, both hands doubled an octave
    out, drums and bass under it."""
    v12, length = take(notes, bar_start, bar_len, list(range(289, 297)) * 2, {289: FO})
    out = v12 + [[n[0], n[1], n[2] + (12 if n[5] == 0 else -12), n[3] - 16, 0, n[5]] for n in v12
                 if n[5] == 0 or n[2] - 12 >= LOWEST]
    return out + band(v12, length, 3, double_time=True), [], length, 152, (3, 4)


def m_apotheosis(melody, harm, **_):
    """The theme's return (its last eight bars) in chords from the bottom of the keyboard to the top, each beat
    struck after a 64th-note sweep up through the chord; broadening to a final C major chord over seven octaves."""
    out, ccs = [], []
    phrase = [n for n in melody if n[0] >= 32]
    for s, d, p in phrase:
        t = s - 32
        pcs, bass = chord(harmony_at(harm, s))
        top = p + 12
        voicing = tones([bass], 24, 35)[:1] + tones(pcs, 36, top - 1) + [p, top]
        out += [[t, d, x, 100, 0, 0 if x >= 60 else 1] for x in voicing]
        sweep = tones(pcs, 48, top - 1)[-12:]
        for i, x in enumerate(sweep):
            out.append([t - F(len(sweep) - i, 32), F(1, 32), x, 60 + 3 * i, 0, 0])
        ccs += [(t, 0, 64, 0), (t + F(1, 32), 0, 64, 127)]
    end = phrase[-1][0] - 32
    out = [n for n in out if n[0] < end] + [[end, F(6), x, FF, 0, 0] for x in tones([0, 4, 7], 24, 108)]
    ccs.append((end + 6, 0, 64, 0))
    bpm = [(0, 84)] + [(end - 4 + F(i, 2), 84 - 4 * i) for i in range(8)]
    return out, ccs, end + 7, bpm, (2, 4)


MOVEMENTS = {"I": m_musicbox, "C": m_canon, "S": m_storm, "B": m_band, "V": m_apotheosis}


def var13(parts, notes, bar_start, bar_len, melody, harm):
    """Concatenate movements (a letter each, see MOVEMENTS) with a beat's breath between them."""
    out, ccs, tempos, meters, t = [], [], [], [], F(0)
    for k in parts:
        n, c, length, bpm, meter = MOVEMENTS[k](notes=notes, bar_start=bar_start, bar_len=bar_len, melody=melody, harm=harm)
        lead = F(1, 2) if k == "V" else F(0)  # the apotheosis' first sweep starts before its downbeat
        t += lead
        out += [[x[0] + t] + x[1:] for x in n]
        ccs += [(b + t, ch, cc, v) for b, ch, cc, v in c]
        tempos += [(b + t, v) for b, v in bpm] if isinstance(bpm, list) else [(t, bpm)]
        meters.append((t, *meter))
        t += length + 1
    return out, tempos, meters, ccs


# ---------- stats for analysis.md ----------

def stats():
    notes, bar_start, bar_len, *_ = sections()
    print("section    bars     meter  notes  notes/bar  shortest  RH range   LH range   chords")
    for k in range(13):
        a, b = 24 * k + 1, 24 * k + 24 + (12 if k == 12 else 0)
        sec = [n for n in notes if bar_start[a] <= n[0] < bar_start[b] + bar_len[b]]
        name = "Theme" if k == 0 else f"Var {k}"
        rh, lh = [n[2] for n in sec if n[3] == 0], [n[2] for n in sec if n[3] == 1]
        onsets = {}
        for n in sec:
            onsets.setdefault((n[3], n[0]), []).append(n)
        chords = sum(len(v) > 1 for v in onsets.values())
        name_of = lambda p: "CDEFGAB"[[0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][p % 12]] + ("#" if p % 12 in (1, 3, 6, 8, 10) else "") + str(p // 12 - 1)
        print(f"{name:9} {a:3}-{b:<3}  {bar_len[a]}/4 {len(sec):6}  {len(sec) / (b - a + 1):9.1f}"
              f"  1/{int(4 / min(n[1] for n in sec)):<6}  {name_of(min(rh))}-{name_of(max(rh)):5} {name_of(min(lh))}-{name_of(max(lh)):5}  {chords}")


def check():
    for path in sorted(os.listdir(OUT)):
        sounding, most = set(), 0
        for msg in mido.MidiFile(os.path.join(OUT, path)):
            if msg.type not in ("note_on", "note_off"):
                continue
            key = (msg.channel, msg.note)
            if msg.type == "note_on" and msg.velocity:
                assert key not in sounding, f"{path}: {key} struck while still on"
                assert msg.channel == 9 or LOWEST <= msg.note <= HIGHEST, f"{path}: key {msg.note} isn't on the piano"
                sounding.add(key)
                most = max(most, len(sounding))
            else:
                assert key in sounding, f"{path}: {key} released but never struck"
                sounding.remove(key)
        assert not sounding, f"{path}: left on {sorted(sounding)}"
        assert most <= POLYPHONY, f"{path}: {most} notes at once"
        print(f"ok  {path:28} at most {most} notes at once")


if __name__ == "__main__":
    {"stats": stats, "check": check}.get(sys.argv[1] if sys.argv[1:] else "", write_all)()
