#!/usr/bin/env python3
"""verify.py's lock takeover: only a dead or pid-less stale holder loses it. Run: python3 .agents/scripts/test_verify_lock.py"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify import LOCK_STALE_S, holder_gone  # noqa: E402


class HolderGone(unittest.TestCase):
    def setUp(self):
        self.lock = Path(tempfile.mkdtemp()) / "verify.lock"
        self.lock.mkdir()

    def age(self, s):
        t = self.lock.stat().st_mtime - s
        os.utime(self.lock, (t, t))

    def test_a_live_holder_keeps_it_however_old(self):
        (self.lock / "pid").write_text(str(os.getpid()))
        self.age(LOCK_STALE_S * 10)
        self.assertFalse(holder_gone(self.lock))

    def test_a_dead_holder_loses_it_at_once(self):
        p = subprocess.Popen([sys.executable, "-c", ""])
        p.wait()
        (self.lock / "pid").write_text(str(p.pid))
        self.assertTrue(holder_gone(self.lock))

    def test_a_shell_holder_without_a_pid_keeps_it_until_stale(self):
        self.assertFalse(holder_gone(self.lock))
        self.age(LOCK_STALE_S + 1)
        self.assertTrue(holder_gone(self.lock))


if __name__ == "__main__":
    unittest.main()
