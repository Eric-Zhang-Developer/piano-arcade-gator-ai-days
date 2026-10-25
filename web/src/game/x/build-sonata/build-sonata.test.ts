// The Build Sonata's Validation (a) and (b), on a fixture log, plus the committed snapshot and chart.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateChart } from "../../../contracts";
import { parsePedal } from "../../pedal";
import { CHORD_TONES, buildSonata, counterAt, laneOf, parseSubject, scrub, VELOCITY_CAP, type Lane, type Snapshot, type SonataCommit } from "./sonata";

const NAMES = ["eric", "Eric-Zhang-Developer", "sharan", "iKnow24"];
const ASSIGNEES = { "core-loop": "eric-agent-1", progress: "sharan", "learning-ui": "" };

// 40 commits over a night: a feature, fixes, a revert, plan and contract work, a backend and a learning commit, and a
// red-main stretch from commit 20 to commit 25's fix.
const fixture = (): Snapshot => {
  const start = Date.parse("2026-10-24T00:00:00Z");
  const kinds: [string, string | null, string[]][] = [
    ["feat", "core-loop", ["web/src/game/core/judge.ts"]],
    ["fix", "core-loop", ["web/src/game/core/judge.ts"]],
    ["plan", null, ["specs/roadmap.md"]],
    ["feat", "progress", ["web/src/app/progress/page.tsx"]],
    ["fix", null, ["web/src/learn/coach.ts", "web/src/learn/x.ts"]],
    ["revert", "core-loop", ["web/src/game/core/judge.ts"]],
    ["contract", null, ["web/src/contracts/index.ts"]],
    ["chore", "learning-ui", ["tools/x.py"]],
  ];
  const commits: SonataCommit[] = Array.from({ length: 40 }, (_, i) => {
    const [type, scope, paths] = kinds[i % kinds.length];
    const lane = laneOf(type, scope, paths, ASSIGNEES);
    const subject = scrub(`${type}${scope ? `(${scope})` : ""}: change ${i} by @Eric-Zhang-Developer, eric@example.com (#${100 + i})`, NAMES, lane);
    return {
      hash: createHash("sha1").update(`commit ${i}`).digest("hex"),
      time: new Date(start + i * (i < 20 ? 60 : 10) * 60_000).toISOString(), // a slow evening, then a busy hour
      ...parseSubject(subject)!,
      lines: i * 37,
      lane,
      subject,
    };
  });
  return {
    generatedAt: "2026-10-25T00:00:00Z",
    count: commits.length,
    from: commits[0].time,
    to: commits.at(-1)!.time,
    commits,
    red: [{ number: 1, from: commits[20].time, to: new Date(Date.parse(commits[25].time) - 1000).toISOString() }],
  };
};

describe("traceability (a)", () => {
  const snap = fixture();
  const { chart, notes } = buildSonata(snap);
  it("one note per merged commit, each mapped to exactly one hash", () => {
    expect(chart.notes.length).toBe(snap.commits.length);
    expect(new Set(notes.map((n) => n.hash)).size).toBe(snap.commits.length);
    for (const n of chart.notes) expect(snap.commits.filter((c) => n.id.startsWith(c.hash.slice(0, 7)))).toHaveLength(1);
  });
  it("parses a squash subject and the night's first merge commits", () => {
    expect(parseSubject("feat(core-loop): play Twinkle (#36)")).toEqual({ type: "feat", scope: "core-loop", pr: 36 });
    expect(parseSubject("Merge pull request #9 from someone/plan-game-lane")).toEqual({ type: "plan", scope: null, pr: 9 });
    expect(parseSubject("Merge pull request #1 from someone/agent-brigade-setup")).toEqual({ type: "other", scope: null, pr: 1 });
    expect(parseSubject("Initial commit")).toBeNull();
  });
  it("the counter ends at the snapshot's count", () => {
    expect(counterAt(chart.notes, Infinity)).toBe(snap.count);
  });
  it("lanes: scoped by the spec's assignee, unscoped by path, plan and contract to the bell", () => {
    const lane = (type: string, scope: string | null, paths: string[]): Lane => laneOf(type, scope, paths, ASSIGNEES);
    expect(lane("feat", "core-loop", [])).toBe("game");
    expect(lane("feat", "progress", ["web/src/game/x.ts"])).toBe("backend"); // the assignee wins over the paths
    expect(lane("fix", null, ["web/src/learn/a.ts", "web/src/learn/b.ts", "web/src/game/c.ts"])).toBe("learning");
    expect(lane("chore", "learning-ui", ["supabase/migrations/x.sql"])).toBe("backend"); // no assignee: by path
    for (const t of ["plan", "contract", "docs"]) expect(lane(t, "core-loop", [])).toBe("bell");
  });
  it("a handle that contains a name is replaced whole, not around the name", () => {
    expect(scrub("Merge pull request #1 from Eric-Zhang-Developer/setup, eric-agent-1", NAMES, "game")).toBe(
      "Merge pull request #1 from game/setup, game-agent-1",
    );
  });
  it("no name, handle or email from the scrub list in the snapshot or the chart", () => {
    const text = JSON.stringify(snap) + JSON.stringify(chart);
    for (const n of NAMES) expect(text).not.toMatch(new RegExp(`\\b${n}\\b`, "i"));
    expect(text).not.toMatch(/@example\.com/);
  });
});

describe("musicality (b)", () => {
  const { chart, pedal, notes } = buildSonata(fixture());
  it("every note is a chord tone of its chord, or a labeled passing tone", () => {
    for (const n of notes) {
      if (n.kind === "pass") expect(n.id).toMatch(/-pass$/);
      else expect(CHORD_TONES[n.chord]).toContain(n.pitch % 12);
    }
  });
  it("a red stretch is in the minor (vi), and its fix resolves it to I", () => {
    const red = notes.filter((n) => n.red && n.chord !== "V" && n.chord !== "I");
    expect(red.length).toBeGreaterThan(0);
    for (const n of red) expect(n.chord).toBe("vi");
    const firstAfter = notes.find((n, i) => i > 0 && !n.red && notes.slice(0, i).some((m) => m.red));
    expect(firstAfter?.kind).toBe("resolve");
    expect(firstAfter?.chord).toBe("I");
  });
  it("ends V–I with the pedal down", () => {
    const chords = [...new Set(notes.map((n) => `${Math.floor(n.beat / 4)}:${n.chord}`))].slice(-2).map((s) => s.split(":")[1]);
    expect(chords).toEqual(["V", "I"]);
    const lastBeat = Math.max(...chart.notes.map((n) => n.beat));
    expect(pedal.some(([d, u]) => d <= lastBeat && u >= lastBeat)).toBe(true);
  });
  it("pitches in 21–108, velocities under the cap, a valid chart and pedal", () => {
    for (const n of chart.notes) {
      expect(n.pitch).toBeGreaterThanOrEqual(21);
      expect(n.pitch).toBeLessThanOrEqual(108);
      expect(n.velocity!).toBeLessThanOrEqual(VELOCITY_CAP);
    }
    expect(validateChart(chart)).toEqual([]);
    expect(parsePedal({ pedal })).not.toBeNull();
  });
});

describe("the committed snapshot", () => {
  const snap = JSON.parse(readFileSync(new URL("./snapshot.json", import.meta.url), "utf8")) as Snapshot;
  const chart = JSON.parse(readFileSync(new URL("../../../../public/songs/x/build-sonata/chart.json", import.meta.url), "utf8"));
  it("the chart is the snapshot's, note for note", () => {
    expect(buildSonata(snap).chart).toEqual(chart);
    expect(chart.notes).toHaveLength(snap.count);
  });
  it("holds no scrubbed name and no email", () => {
    const text = readFileSync(new URL("./snapshot.json", import.meta.url), "utf8");
    for (const n of NAMES) expect(text).not.toMatch(new RegExp(`\\b${n}\\b`, "i"));
    expect(text).not.toMatch(/Zhang|Developer/); // no piece of a handle either
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });
});
