# Minimal Standard MIDI File read/write, no dependencies: for writing band arrangements the player plays.
import struct


def _vlq(data, i):
    v = 0
    while True:
        b = data[i]
        i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def read(path):
    """Returns (ticks_per_quarter, notes, meta): notes are dicts tick, dur, pitch, vel, ch, track."""
    data = open(path, "rb").read()
    assert data[:4] == b"MThd"
    fmt, ntrk, tpq = struct.unpack(">HHH", data[8:14])
    i = 14
    notes, meta = [], []
    for t in range(ntrk):
        assert data[i : i + 4] == b"MTrk", data[i : i + 4]
        ln = struct.unpack(">I", data[i + 4 : i + 8])[0]
        j, end = i + 8, i + 8 + ln
        tick, status, on = 0, 0, {}
        while j < end:
            d, j = _vlq(data, j)
            tick += d
            b = data[j]
            if b & 0x80:
                status = b
                j += 1
            if status == 0xFF:
                typ = data[j]
                ln2, j = _vlq(data, j + 1)
                meta.append((tick, typ, data[j : j + ln2]))
                j += ln2
            elif status in (0xF0, 0xF7):
                ln2, j = _vlq(data, j)
                j += ln2
            else:
                kind, ch = status & 0xF0, status & 0x0F
                if kind in (0xC0, 0xD0):
                    j += 1
                    continue
                a, b2 = data[j], data[j + 1]
                j += 2
                if kind == 0x90 and b2 > 0:
                    on.setdefault((ch, a), []).append((tick, b2))
                elif kind in (0x80, 0x90):
                    st = on.get((ch, a))
                    if st:
                        t0, v = st.pop(0)
                        notes.append(dict(tick=t0, dur=tick - t0, pitch=a, vel=v, ch=ch, track=t))
        i = end
    notes.sort(key=lambda n: (n["tick"], n["pitch"]))
    return tpq, notes, meta


def _w_vlq(v):
    out = [v & 0x7F]
    v >>= 7
    while v:
        out.append((v & 0x7F) | 0x80)
        v >>= 7
    return bytes(reversed(out))


def write(path, tpq, tracks):
    """tracks: list of event lists [(tick, bytes)], already including meta/program events. Format 1."""
    chunks = [b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), tpq)]
    for evs in tracks:
        evs = sorted(evs, key=lambda e: (e[0], 0 if e[1][0] & 0xF0 == 0x80 else 1))
        body, last = b"", 0
        for tick, msg in evs:
            body += _w_vlq(tick - last) + msg
            last = tick
        body += _w_vlq(0) + b"\xff\x2f\x00"
        chunks.append(b"MTrk" + struct.pack(">I", len(body)) + body)
    open(path, "wb").write(b"".join(chunks))
