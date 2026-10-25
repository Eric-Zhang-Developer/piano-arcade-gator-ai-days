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
    "shell": spec("shell", "", "web/src/app/layout.tsx"),  # in flight, no lane: the lane rule alone keeps it closed
    "song-pack-9": spec("song-pack-9", "eric", "web/public/songs/x/"),
}
DONE = {"old-game"}


def ok(title, path, stat=None):
    return check_ownership.allowed(title, CFG, SPECS, {}, DONE, stat=stat)[0](path)


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


LAYOUT = "web/src/app/layout.tsx"


class Mount(unittest.TestCase):
    def test_a_small_mount_passes_for_the_game_lane(self):
        self.assertTrue(ok("feat(hud): x", LAYOUT, {LAYOUT: (4, 2)}))
        self.assertTrue(ok("fix(juice): x", LAYOUT, {LAYOUT: (1, 0)}))

    def test_over_the_limit_falls_back_to_the_owner_rule(self):
        self.assertFalse(ok("feat(hud): x", LAYOUT, {LAYOUT: (5, 0)}))
        self.assertFalse(ok("feat(hud): x", LAYOUT, {LAYOUT: (1, 3)}))
        self.assertFalse(ok("feat(hud): x", LAYOUT))  # no numstat, no mount

    def test_another_lane_gets_no_mount(self):
        self.assertFalse(ok("feat(takes): x", LAYOUT, {LAYOUT: (1, 0)}))
        self.assertFalse(ok("feat(nobody): x", LAYOUT, {LAYOUT: (1, 0)}))

    def test_only_the_three_paths(self):
        self.assertFalse(ok("feat(hud): x", "web/src/contracts/chart.ts", {"web/src/contracts/chart.ts": (1, 0)}))
        self.assertFalse(ok("feat(hud): x", "supabase/a.sql", {"supabase/a.sql": (1, 0)}))


class Credits(unittest.TestCase):
    def test_a_song_pack_appends_credits(self):
        self.assertTrue(ok("feat(song-pack-9): x", "CREDITS.md", {"CREDITS.md": (12, 0)}))

    def test_a_credits_deletion_fails(self):
        self.assertFalse(ok("feat(song-pack-9): x", "CREDITS.md", {"CREDITS.md": (3, 1)}))

    def test_other_features_still_need_docs(self):
        self.assertFalse(ok("feat(hud): x", "CREDITS.md", {"CREDITS.md": (1, 0)}))


if __name__ == "__main__":
    unittest.main()
