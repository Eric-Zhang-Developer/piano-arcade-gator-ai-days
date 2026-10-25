import { describe, expect, test } from "vitest";
import { beforeAfter, flight, greenRuns, mainWait, mergesPerHour, peak, rate, stats, type CiSnapshot } from "./ci";

// since 05:00Z (01:00 EDT); the snapshot is 4 h later.
const base: CiSnapshot = {
  at: "2026-10-25T09:00:00Z",
  since: "2026-10-25T05:00:00Z",
  repo: "https://github.com/fixture/fixture",
  runs: [
    ["push", "main", null, 0, 1200, "success"],
    ["pull_request", "", 1, 600, 1600, "success"],
    ["pull_request", "", 2, 700, 900, "cancelled"],
  ],
  jobs: [
    [0, 1, 0, 0, 900, 1], // main: runs 0–900
    [0, 1, 0, 600, 1200, 1], // main: waits 0–600, runs to 1200
    [1, 1, 600, 600, 1600, 1],
    [1, 0, 600, 600, 700, 1], // not a browser job
    [2, 1, 700, null, 900, 0], // cancelled while queued
    [2, 1, 700, null, null, 0], // still queued at the snapshot
  ],
  marks: [{ n: 687, kind: "pr", label: "smoke", t: null }],
  merges: [100, 3700, 3800, 7300],
};

describe("flight", () => {
  const pts = flight(base, 300);
  const at = (t: number) => pts.find((p) => p.t === t)!;
  test("counts running and queued browser jobs at each step", () => {
    expect(at(0)).toEqual({ t: 0, running: 1, queued: 1, mainQueued: 1 });
    expect(at(600)).toEqual({ t: 600, running: 3, queued: 0, mainQueued: 0 });
    expect(at(900)).toEqual({ t: 900, running: 2, queued: 1, mainQueued: 0 });
  });
  test("a job still queued at the snapshot waits to the end", () => {
    expect(pts[pts.length - 1]).toMatchObject({ queued: 1 });
  });
  test("peak finds the most at once", () => {
    expect(peak(pts, "running")).toEqual({ value: 3, t: 600 });
    expect(peak(pts, "mainQueued", 600)).toBeNull();
  });
});

test("main's longest wait for a runner, in minutes", () => {
  expect(mainWait(base)).toEqual({ min: 10, t: 0 });
});

test("a green run is timed from its first job queued to its last completed", () => {
  const rerun: CiSnapshot = { ...base, jobs: [...base.jobs, [1, 1, 600, 900, null, 0]] };
  expect(greenRuns(base)).toEqual([{ t: 600, min: 16.7, pr: 1 }]);
  expect(greenRuns(rerun)).toEqual([]); // a job still running: not green yet
});

test("stats: median, p90 and max", () => {
  expect(stats([5, 1, 3])).toEqual({ n: 3, median: 3, p90: 5, max: 5 });
  expect(stats([])).toBeNull();
});

describe("before and after the smoke-only switch", () => {
  test("no switch yet: everything is before, after is measuring", () => {
    const r = beforeAfter(base);
    expect(r.beforeStats).toEqual({ n: 1, median: 16.7, p90: 16.7, max: 16.7 });
    expect(r.after).toBeNull();
  });
  test("after needs 3 hours and 3 green runs past the switch", () => {
    const runs: CiSnapshot["runs"] = [...base.runs, ["pull_request", "", 3, 2000, 2100, "success"], ["pull_request", "", 4, 2200, 2300, "success"], ["pull_request", "", 5, 2400, 2700, "success"]];
    const marks = [{ ...base.marks[0], t: 1800 }];
    const jobs: CiSnapshot["jobs"] = [...base.jobs, [3, 1, 2000, 2000, 2100, 1], [4, 1, 2200, 2200, 2300, 1], [5, 1, 2400, 2400, 2700, 1]];
    expect(beforeAfter({ ...base, runs, marks }).after).toBeNull(); // runs with no jobs aren't timed
    expect(beforeAfter({ ...base, runs, jobs, marks }).afterStats).toEqual({ n: 3, median: 1.7, p90: 5, max: 5 });
    expect(beforeAfter({ ...base, runs, jobs, marks, at: "2026-10-25T07:00:00Z" }).after).toBeNull(); // 1.5 h past the switch
    expect(beforeAfter({ ...base, runs: runs.slice(0, 5), jobs, marks }).after).toBeNull(); // only 2 green runs past it
  });
});

test("merges per New York hour, and the average rate", () => {
  const h = mergesPerHour(base);
  expect(h.map((x) => x.count)).toEqual([1, 2, 1, 0]);
  expect(h[0].label).toBe("1 AM");
  expect(rate(h, 3600, 4 * 3600)).toBe(1);
});
