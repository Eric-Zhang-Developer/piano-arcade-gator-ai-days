"""Level forge, phase 1 (spec: level-forge): the four steps an agent runs to turn a public-domain source into a level,
plus the accuracy diff. Each prints one JSON object. Their refusals are code, so they hold whoever calls them.

  forge.py download --forge F <url>             a .mid/.midi/.ly/.zip from Mutopia or IMSLP, at most 5 MB; its tracks
  forge.py convert --forge F <file> <convert.py flags...> --id ID ...   runs midi-to-chart; the chart stays in scratch
  forge.py check --forge F <id>                 the library's rules (songs/rules.ts) on that chart, via vitest
  forge.py save --forge F <id>                  only a chart this forge converted and checked, unchanged, with an open
                                                license in its source: to web/public/songs/local/<id>/chart.json
  forge.py diff <forged chart.json> <committed chart.json>    share of committed notes matched (pitch, hand, beat)
  forge.py --self-test                          the refusals, with no network

Run it with the converter's venv (game-tools/midi-to-chart/.venv/bin/python), which has mido. A forge's files live in
web/public/songs/local/.forge/<F>/ (gitignored with local/): downloads, <id>.chart.json and state.json.
"""

import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from fractions import Fraction

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOCAL = os.path.join(ROOT, "web", "public", "songs", "local")
SONGS = os.path.join(ROOT, "web", "public", "songs")
CONVERT = os.path.join(ROOT, "game-tools", "midi-to-chart", "convert.py")
HOSTS = ("mutopiaproject.org", "imslp.org")
EXTENSIONS = (".mid", ".midi", ".ly", ".zip")
MAX_BYTES = 5 * 1024 * 1024
# Decision 003: open licenses only. Matched case-insensitively against the chart's source line.
OPEN_LICENSES = ("public domain", "cc0", "creative commons attribution", "cc by", "cc-by")


class Refused(Exception):
    pass


def out(obj, code=0):
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(code)


def forge_dir(forge):
    if not forge or "/" in forge or forge.startswith("."):
        raise Refused(f"forge name {forge!r}: letters, digits and dashes only")
    d = os.path.join(LOCAL, ".forge", forge)
    os.makedirs(d, exist_ok=True)
    return d


def load_state(d):
    p = os.path.join(d, "state.json")
    return json.load(open(p)) if os.path.exists(p) else {"downloads": [], "converted": {}, "checked": {}}


def save_state(d, s):
    json.dump(s, open(os.path.join(d, "state.json"), "w"), indent=2)


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


# ---------- download ----------


def allowed(url):
    u = urllib.parse.urlparse(url)
    host = (u.hostname or "").lower()
    if u.scheme != "https" or not any(host == h or host.endswith("." + h) for h in HOSTS):
        raise Refused(f"host {host or url!r}: only {' and '.join(HOSTS)} over https")
    name = os.path.basename(urllib.parse.unquote(u.path))
    if not name.lower().endswith(EXTENSIONS):
        raise Refused(f"file {name!r}: only {', '.join(EXTENSIONS)}")
    return name


def fetch(url, opener=urllib.request.urlopen):
    with opener(urllib.request.Request(url, headers={"User-Agent": "piano-arcade-forge"}), timeout=30) as r:
        size = r.headers.get("Content-Length")
        if size and int(size) > MAX_BYTES:
            raise Refused(f"{int(size)} bytes: over the 5 MB limit")
        data = r.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise Refused("over the 5 MB limit")
        return data


def tracks(path):
    import mido

    return [{"index": i, "name": t.name, "notes": sum(m.type == "note_on" and m.velocity > 0 for m in t)} for i, t in enumerate(mido.MidiFile(path).tracks)]


def download(forge, url, opener=urllib.request.urlopen):
    name = allowed(url)
    d = forge_dir(forge)
    data = fetch(url, opener)
    path = os.path.join(d, name)
    open(path, "wb").write(data)
    files = [path]
    if name.lower().endswith(".zip"):
        files = []
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for m in z.namelist():
                base = os.path.basename(m)
                if base.lower().endswith((".mid", ".midi", ".ly")):
                    p = os.path.join(d, base)
                    open(p, "wb").write(z.read(m))
                    files.append(p)
    s = load_state(d)
    s["downloads"].append({"url": url, "files": [os.path.relpath(f, ROOT) for f in files]})
    save_state(d, s)
    listing = []
    for f in files:
        entry = {"file": os.path.relpath(f, ROOT), "bytes": os.path.getsize(f)}
        entry.update({"tracks": tracks(f)} if f.lower().endswith((".mid", ".midi")) else {"note": "LilyPond source: the converter reads MIDI only"})
        listing.append(entry)
    return {"ok": True, "url": url, "files": listing}


# ---------- convert ----------


def arg(args, flag):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else None


def convert(forge, args):
    d = forge_dir(forge)
    if not args:
        raise Refused("convert needs a downloaded file and convert.py's flags")
    file, flags = os.path.abspath(args[0]), args[1:]
    s = load_state(d)
    mine = {os.path.join(ROOT, f) for dl in s["downloads"] for f in dl["files"]}
    if file not in mine:
        raise Refused(f"{args[0]}: not a file this forge downloaded")
    cid = arg(flags, "--id")
    if not cid or not cid.replace("-", "").isalnum():
        raise Refused("--id: letters, digits and dashes")
    if "-o" in flags or "--out" in flags:
        raise Refused("-o: the forge chooses where the chart goes")
    dest = os.path.join(d, f"{cid}.chart.json")
    p = subprocess.run([sys.executable, CONVERT, file, *flags, "-o", dest], capture_output=True, text=True)
    if p.returncode != 0 or not os.path.exists(dest):
        return {"ok": False, "step": "convert", "stderr": p.stderr.strip()[-2000:]}
    s["converted"][cid] = sha(dest)
    s["checked"].pop(cid, None)
    save_state(d, s)
    chart = json.load(open(dest))
    return {"ok": True, "id": cid, "notes": len(chart["notes"]), "bpm": chart["bpm"], "beatsPerBar": chart["beatsPerBar"], "stderr": p.stderr.strip()[-2000:]}


# ---------- check ----------


def library_ids():
    ids = {}
    for dirpath, _, names in os.walk(SONGS):
        if ".forge" in dirpath.split(os.sep):
            continue
        if "chart.json" in names:
            try:
                ids[json.load(open(os.path.join(dirpath, "chart.json")))["id"]] = os.path.relpath(dirpath, SONGS)
            except (ValueError, KeyError):
                pass
    return ids


def check(forge, cid):
    d = forge_dir(forge)
    s = load_state(d)
    path = os.path.join(d, f"{cid}.chart.json")
    if cid not in s["converted"] or not os.path.exists(path):
        raise Refused(f"{cid}: this forge hasn't converted it")
    env = dict(os.environ, FORGE_CHART=path, FORGE_ID=cid)
    report_path = os.path.join(d, "check.json")  # web's vitest config writes the json reporter to a file
    if os.path.exists(report_path):
        os.remove(report_path)
    p = subprocess.run(
        ["pnpm", "-s", "-C", os.path.join(ROOT, "web"), "exec", "vitest", "run", "src/app/api/forge/check.test.ts", "--reporter=json", f"--outputFile={report_path}"],
        capture_output=True, text=True, env=env,
    )
    try:
        report = json.load(open(report_path))
        results = [a for f in report["testResults"] for a in f["assertionResults"]]
    except (OSError, ValueError, KeyError):
        return {"ok": False, "step": "check", "error": "vitest gave no report", "stderr": p.stderr.strip()[-2000:]}
    rules = [{"rule": a["title"], "pass": a["status"] == "passed", "messages": [m[:500] for m in a.get("failureMessages", [])]} for a in results]
    taken = library_ids().get(json.load(open(path))["id"])
    if taken and taken != f"local/{cid}":
        rules.append({"rule": "the id is new to the library", "pass": False, "messages": [f"songs/{taken} already has it"]})
    ok = bool(rules) and all(r["pass"] for r in rules)
    if ok:
        s["checked"][cid] = sha(path)
        save_state(d, s)
    return {"ok": ok, "id": cid, "rules": rules}


# ---------- save ----------


def save(forge, cid):
    d = forge_dir(forge)
    s = load_state(d)
    path = os.path.join(d, f"{cid}.chart.json")
    if not os.path.exists(path) or s["converted"].get(cid) != sha(path):
        raise Refused(f"{cid}: not the chart this forge's convert wrote")
    if s["checked"].get(cid) != sha(path):
        raise Refused(f"{cid}: hasn't passed check as it is now")
    source = json.load(open(path)).get("source", "")
    urls = [dl["url"] for dl in s["downloads"]]
    if not any(u in source for u in urls):
        raise Refused(f"source names no URL this forge downloaded from ({', '.join(urls) or 'none'})")
    if not any(l in source.lower() for l in OPEN_LICENSES):
        raise Refused("source quotes no open license (decision 003: public domain, CC0, CC BY, CC BY-SA)")
    dest = os.path.join(LOCAL, cid, "chart.json")
    if os.path.exists(dest):
        raise Refused(f"songs/local/{cid} already exists")
    os.makedirs(os.path.dirname(dest))
    shutil.copyfile(path, dest)
    return {"ok": True, "id": cid, "saved": os.path.relpath(dest, ROOT), "play": f"/play?song=local/{cid}"}


# ---------- diff ----------


def diff(forged_path, committed_path):
    forged, committed = json.load(open(forged_path)), json.load(open(committed_path))
    end = min(max(n["beat"] + n["duration"] for n in c["notes"]) for c in (forged, committed))
    tol = Fraction(1, 12)
    a = [n for n in committed["notes"] if n["beat"] < end]
    b = [n for n in forged["notes"] if n["beat"] < end]
    used = set()
    matched = 0
    for n in a:
        for i, m in enumerate(b):
            if i not in used and m["pitch"] == n["pitch"] and m["hand"] == n["hand"] and abs(Fraction(m["beat"]).limit_denominator(48) - Fraction(n["beat"]).limit_denominator(48)) <= tol:
                used.add(i)
                matched += 1
                break
    return {
        "beats": float(end),
        "committed": len(a),
        "forged": len(b),
        "matched": matched,
        "share": round(matched / len(a), 4) if a else 0,
        "forged_unmatched": len(b) - len(used),
        "same_source": forged.get("source", "").split(",")[0].strip() == committed.get("source", "").split(",")[0].strip(),
    }


# ---------- self-test ----------


def self_test():
    class Fake:
        def __init__(self, size):
            self.headers = {"Content-Length": str(size)}

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self, n):
            return b"\0" * min(n, int(self.headers["Content-Length"]))

    def refused(f):
        try:
            f()
        except Refused as e:
            return str(e)
        raise AssertionError("not refused")

    assert "only mutopiaproject.org" in refused(lambda: allowed("https://example.com/a.mid"))
    assert "only mutopiaproject.org" in refused(lambda: allowed("http://www.mutopiaproject.org/a.mid"))
    assert "only mutopiaproject.org" in refused(lambda: allowed("https://mutopiaproject.org.evil.com/a.mid"))
    assert "only .mid" in refused(lambda: allowed("https://www.mutopiaproject.org/ftp/a/a.pdf"))
    assert allowed("https://www.mutopiaproject.org/ftp/BeethovenLv/ode/ode.mid") == "ode.mid"
    assert allowed("https://imslp.org/files/a.MIDI") == "a.MIDI"
    assert "5 MB" in refused(lambda: download("self-test", "https://www.mutopiaproject.org/x/big.mid", opener=lambda *a, **k: Fake(MAX_BYTES + 1)))
    d = forge_dir("self-test")
    s = {"downloads": [], "converted": {"typed": "0" * 64}, "checked": {"typed": "0" * 64}}
    save_state(d, s)
    open(os.path.join(d, "typed.chart.json"), "w").write('{"id": "typed", "notes": []}')
    assert "not the chart this forge's convert wrote" in refused(lambda: save("self-test", "typed"))
    assert "not a file this forge downloaded" in refused(lambda: convert("self-test", ["/etc/hosts", "--id", "x"]))
    assert "forge name" in refused(lambda: forge_dir("../x"))
    shutil.rmtree(d)
    print("self-test: ok (host, scheme, extension, 5 MB, save of a chart convert didn't write, convert of a file not downloaded)")


def main(argv):
    if argv[:1] == ["--self-test"]:
        return self_test()
    if not argv:
        out({"ok": False, "error": __doc__}, 2)
    cmd, rest = argv[0], argv[1:]
    try:
        if cmd == "diff":
            out(diff(rest[0], rest[1]))
        forge = arg(rest, "--forge")
        if forge is None:
            raise Refused("--forge <name> is required")
        i = rest.index("--forge")
        rest = rest[:i] + rest[i + 2 :]
        if cmd == "download":
            out(download(forge, rest[0]))
        if cmd == "convert":
            out(convert(forge, rest))
        if cmd == "check":
            r = check(forge, rest[0])
            out(r, 0 if r["ok"] else 1)
        if cmd == "save":
            out(save(forge, rest[0]))
        raise Refused(f"unknown step {cmd!r}")
    except Refused as e:
        out({"ok": False, "step": cmd, "refused": str(e)}, 1)


if __name__ == "__main__":
    main(sys.argv[1:])
