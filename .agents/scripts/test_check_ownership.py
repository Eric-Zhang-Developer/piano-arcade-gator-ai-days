#!/usr/bin/env python3
"""check_ownership's title rules on made-up specs. Run: python3 .agents/scripts/test_check_ownership.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_ownership  # noqa: E402
from lib import DEFAULTS  # noqa: E402

CFG = {**DEFAULTS, "ownership": {"frozen": ["AGENTS.md", ".agents/"], "open": ["NOW.md"]}}


def spec(slug, assignee, *owns):
    return {"assignee": assignee, "owns": list(owns), "_path": f"specs/features/{slug}/spec.md"}


SPECS = {
    "hud": spec("hud", "eric", "web/src/game/hud/"),
    "juice": spec("juice", "eric-agent-1", "web/src/game/juice/"),
    "attract": spec("attract", "eric-foreman-agent", "web/src/app/attract/"),
    "old-game": spec("old-game", "eric", "web/src/app/"),  # done, and broader than takes below
    "takes": spec("takes", "sharan", "web/src/app/api/takes/"),
    "nobody": spec("nobody", "", "tools/rip/"),
}
DONE = {"old-game"}


def ok(title, path):
    return check_ownership.allowed(title, CFG, SPECS, {}, DONE)[0](path)


class Lane(unittest.TestCase):
    def test_own_owns_still_pass(self):
        self.assertTrue(ok("feat(hud): x", "web/src/game/hud/a.ts"))

    def test_feat_reaches_another_feature_in_the_same_lane(self):
        self.assertTrue(ok("feat(hud): x", "web/src/game/juice/a.ts"))  # eric-agent-1 is eric
        self.assertTrue(ok("feat(juice): x", "web/src/app/attract/page.tsx"))  # eric-foreman-agent is eric

    def test_fix_and_its_kin_reach_the_lane_too(self):
        self.assertTrue(ok("fix(hud): x", "web/src/game/juice/a.ts"))
        self.assertTrue(ok("refactor(hud): x", "web/src/game/juice/a.ts"))

    def test_done_features_in_the_lane_count(self):
        self.assertTrue(ok("feat(hud): x", "web/src/app/page.tsx"))

    def test_another_lane_stays_closed(self):
        self.assertFalse(ok("feat(hud): x", "web/src/app/api/takes/route.ts"))  # even under old-game's web/src/app/
        self.assertFalse(ok("feat(takes): x", "web/src/game/hud/a.ts"))

    def test_no_assignee_means_no_widening(self):
        self.assertFalse(ok("feat(nobody): x", "web/src/game/hud/a.ts"))
        self.assertFalse(ok("feat(hud): x", "tools/rip/a.py"))

    def test_frozen_and_unowned_paths_unchanged(self):
        self.assertFalse(ok("feat(hud): x", "AGENTS.md"))
        self.assertFalse(ok("feat(hud): x", "supabase/migrations/1.sql"))
        self.assertTrue(ok("feat(hud): x", "NOW.md"))

    def test_a_lane_mates_spec_folder_and_done_note_stay_closed(self):
        self.assertFalse(ok("feat(hud): x", "specs/features/juice/spec.md"))
        self.assertFalse(ok("feat(hud): x", "changes/juice.md"))


if __name__ == "__main__":
    unittest.main()
