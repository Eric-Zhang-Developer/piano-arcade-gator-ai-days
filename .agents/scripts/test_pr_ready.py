#!/usr/bin/env python3
"""pr_ready's check verdict on statusCheckRollup fixtures. Run: python3 .agents/scripts/test_pr_ready.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pr_ready  # noqa: E402

pr_ready.unresolved_threads = lambda root, pr: 0  # no gh: only the checks decide
ZERO = "0001-01-01T00:00:00Z"  # what GitHub reports for a time that hasn't happened yet


def run(name, status, conclusion, started, completed=ZERO, workflow="ci"):
    return {"__typename": "CheckRun", "name": name, "workflowName": workflow, "status": status,
            "conclusion": conclusion, "startedAt": started, "completedAt": completed}


def code(*checks):
    pr = {"state": "OPEN", "isDraft": False, "mergeable": "MERGEABLE", "url": "https://github.com/o/r/pull/1",
          "number": 1, "statusCheckRollup": list(checks)}
    return pr_ready.verdict(None, pr)[0]


OLD, NEW = "2026-10-24T15:50:25Z", "2026-10-24T15:51:24Z"


class Rollup(unittest.TestCase):
    def test_an_unexpanded_matrix_name_is_ignored_when_its_workflow_ran(self):
        # A title edit cancels the first run before its matrix expands; GitHub keeps that job as
        # "browser (${{ matrix.shard }})" failed, forever (#726, #811).
        stale = run("browser (${{ matrix.shard }})", "COMPLETED", "FAILURE", OLD, OLD)
        self.assertEqual(code(stale, run("ci", "COMPLETED", "SUCCESS", NEW, NEW), run("browser (1)", "COMPLETED", "SUCCESS", NEW, NEW)), 0)

    def test_an_unexpanded_matrix_name_alone_still_counts(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", NEW, NEW), run("browser (${{ matrix.shard }})", "COMPLETED", "FAILURE", OLD, OLD)), 7)

    def test_no_checks_yet_waits(self):
        # Right after a PR is marked ready, GitHub has attached no checks yet; #745 merged then, before its CI ran.
        self.assertEqual(code(), 8)

    def test_other_checks_but_no_ci_yet_waits(self):
        self.assertEqual(code(run("plan", "COMPLETED", "SUCCESS", OLD, NEW, workflow="plan")), 8)

    def test_a_newer_success_supersedes_an_older_cancelled_run(self):
        # A PR body edit fires `edited`; the concurrency group cancels the run already going (#433).
        self.assertEqual(code(run("ci", "COMPLETED", "CANCELLED", OLD, NEW), run("ci", "COMPLETED", "SUCCESS", NEW)), 0)

    def test_a_newer_failure_after_an_older_success_fails(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", OLD, OLD), run("ci", "COMPLETED", "FAILURE", NEW)), 7)

    def test_a_newer_pending_run_waits(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", OLD, OLD), run("ci", "IN_PROGRESS", "", NEW)), 8)

    def test_a_queued_run_with_no_times_yet_counts_as_newest(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", OLD, OLD), run("ci", "QUEUED", "", ZERO)), 8)

    def test_a_run_cancelled_before_it_started_dates_by_its_completion(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", OLD, OLD), run("ci", "COMPLETED", "CANCELLED", ZERO, NEW)), 7)

    def test_single_entries_are_unchanged(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", OLD)), 0)
        self.assertEqual(code(run("ci", "COMPLETED", "FAILURE", OLD)), 7)
        self.assertEqual(code(run("ci", "IN_PROGRESS", "", OLD)), 8)
        self.assertEqual(code({"context": "deploy", "state": "PENDING"}), 8)

    def test_each_check_is_judged_on_its_own(self):
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", NEW), run("browser (1)", "COMPLETED", "FAILURE", OLD)), 7)
        self.assertEqual(code(run("ci", "COMPLETED", "SUCCESS", NEW), run("ci", "COMPLETED", "FAILURE", OLD, workflow="other")), 7)


if __name__ == "__main__":
    unittest.main()
