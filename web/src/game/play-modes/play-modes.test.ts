import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { Judge, rankFor } from "../core/judge";
import { msPerBeat } from "../core/settings";
import { adaptUrl, songPhrases, start } from "../adaptive-chunks/next";
import { stepUrl } from "../chunk-practice/chunks";
import { practiceBarsUrl, saveNextFor } from "../duo-results/scores";
import { nextForUrl, readNextFor } from "../duo-select/next-for";
import { onsetsOf } from "../flow-mode/clock";
import { FlowJudge } from "../flow-mode/judge";
import { practiceUrl } from "../weak-bars";
import { reachedBy } from ".";
import { flowRank, graduates, heldTempo, inMode, ladderKey, playMode, reachLadder, readLadder, withMode } from "./modes";

const twinkle: Chart = JSON.parse(readFileSync("public/songs/twinkle/chart.json", "utf8"));
const q = (url: string) => new URLSearchParams(url.split("?")[1]);
const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("modes", () => {
  it("reads mode=wait as learn, mode=flow as flow, and anything else as perform", () => {
    expect(playMode(new URLSearchParams("mode=wait"))).toBe("learn");
    expect(playMode(new URLSearchParams("mode=flow"))).toBe("flow");
    expect(playMode(new URLSearchParams(""))).toBe("perform");
    expect(playMode(new URLSearchParams("mode=fast"))).toBe("perform");
  });

  it("withMode round-trips and keeps song, hands, from and to", () => {
    const p = new URLSearchParams("song=twinkle&hands=R&from=3&to=4&tempo=70");
    for (const m of ["learn", "flow", "perform"] as const) {
      const out = withMode(p, m);
      expect(playMode(out)).toBe(m);
      expect(Object.fromEntries(withMode(out, "perform"))).toEqual(Object.fromEntries(p));
      for (const k of ["song", "hands", "from", "to", "tempo"]) expect(out.get(k)).toBe(p.get(k));
    }
    expect(inMode(p, "flow").has("tempo")).toBe(false);
    expect(inMode(p, "learn").get("tempo")).toBe("70");
  });
});

describe("practice keeps the take's mode", () => {
  const run = { from: 3, to: 4 };
  const phrase = { from: 3, to: 4, noteIds: [] };
  const list = songPhrases(twinkle, null);
  const links = (take: string) => {
    const p = new URLSearchParams(take);
    const store = memory();
    saveNextFor(store, p, { song: "twinkle", ...run, hand: null, mode: playMode(p) });
    const next = readNextFor(store, "twinkle");
    return {
      practiceBars: q(practiceBarsUrl("twinkle", p, run)),
      nextFor: next && q(nextForUrl(next)),
      weakBars: q(practiceUrl(twinkle, p, phrase)),
      adapt: q(adaptUrl(p, list, start(list))),
    };
  };

  it("a Flow take's links keep mode=flow and drop tempo", () => {
    const l = links("song=twinkle&mode=flow");
    for (const [name, u] of Object.entries(l)) {
      expect(u, name).not.toBeNull();
      expect(u!.get("mode"), name).toBe("flow");
      expect(u!.has("tempo"), name).toBe(false);
    }
  });

  it("a Learn take's links keep mode=wait (the adaptive walk goes on in Flow)", () => {
    const l = links("song=twinkle&mode=wait");
    expect(l.practiceBars.get("mode")).toBe("wait");
    expect(l.weakBars.get("mode")).toBe("wait");
    expect(l.practiceBars.get("tempo")).toBe("70");
    expect(l.nextFor).toBeNull(); // a Learn take isn't scored, so it suggests nothing
    expect(l.adapt.get("mode")).toBe("flow");
  });

  it("a Perform take's links carry no mode and keep their tempo", () => {
    const l = links("song=twinkle");
    for (const [name, u] of Object.entries(l)) {
      expect(u!.has("mode"), name).toBe(false);
      expect(u!.get("tempo"), name).toBe(name === "weakBars" ? "80" : "70");
    }
  });

  it("chunk steps: learn is Learn, play is the take's mode, Flow after a Learn step", () => {
    const c = { from: 1, to: 4 };
    expect(q(stepUrl(new URLSearchParams("song=twinkle&mode=flow"), c, "learn")).get("mode")).toBe("wait");
    expect(q(stepUrl(new URLSearchParams("song=twinkle&mode=wait"), c, "play")).get("mode")).toBe("flow");
    expect(q(stepUrl(new URLSearchParams("song=twinkle"), c, "play")).has("mode")).toBe(false);
  });
});

// A steady player at the chart's own (already slowed) tempo, skipping the onset `skip`: Twinkle's 41 of 42 is 98%.
function flowTake(tempo: number, skip = -1) {
  const judge = new FlowJudge(twinkle, () => {}, { startRate: 1, tempo });
  const mpb = msPerBeat(twinkle.bpm);
  const onsets = onsetsOf(twinkle);
  const presses = onsets.flatMap((o, k) => (k === skip ? [] : o.ids.map((id) => ({ pitch: twinkle.notes.find((n) => n.id === id)!.pitch, at: o.ms }))));
  let i = 0;
  const end = onsets.at(-1)!.ms + 2 * mpb;
  for (let t = onsets[0].ms - 2 * mpb; t <= end; t += 16) {
    for (; i < presses.length && presses[i].at <= t; i++) judge.press(presses[i].pitch, judge.clock.now(presses[i].at), i, presses[i].at);
    judge.clock.update(t);
    judge.advance(judge.clock.now(t));
  }
  return { judge, results: judge.finish(judge.clock.now(end)) };
}

describe("Flow is honest about tempo", () => {
  it("held tempo is the median rate × ?tempo, in whole percent", () => {
    expect(heldTempo([1, 0.7, 0.72, 0.74], 1)).toBe(73);
    expect(heldTempo([1, 1, 1], 0.72)).toBe(72);
    expect(heldTempo([])).toBeNull();
    expect(flowTake(0.72).judge.heldTempo).toBe(72);
  });

  it("graduates at 85% held and steady, not at 84% or a bit uneven", () => {
    expect(graduates("steady", 85)).toBe(true);
    expect(graduates("steady", 84)).toBe(false);
    expect(graduates("a bit uneven", 95)).toBe(false);
    expect(graduates("steady", null)).toBe(false);
  });

  it("a 98% Flow take at 89% held ranks B; at 90%, S", () => {
    const at89 = flowTake(0.89, 5).results;
    expect(at89.judgments.filter((j) => j.judgment === "MISS")).toHaveLength(1);
    expect(at89.rank).toBe("B");
    expect(flowTake(0.9, 5).results.rank).toBe("S");
    expect(flowRank("C", 50)).toBe("C"); // the cap only lowers
    expect(flowRank(rankFor(0.5, true), 60)).toBe("B"); // core's full-combo floor and the cap meet at B
  });

  it("a Perform take's rank is unchanged", () => {
    const judge = new Judge(twinkle);
    const mpb = msPerBeat(twinkle.bpm);
    twinkle.notes.forEach((n, i) => judge.press(n.pitch, n.beat * mpb, i));
    expect(judge.finish(twinkle.notes.at(-1)!.beat * mpb + 500).rank).toBe("S");
  });
});

describe("the ladder's furthest step", () => {
  it("only goes up, and reads junk as nothing", () => {
    const s = memory();
    expect(readLadder(s, "twinkle")).toBeNull();
    reachLadder(s, "twinkle", "flow");
    reachLadder(s, "twinkle", "learn");
    expect(readLadder(s, "twinkle")).toBe("flow");
    reachLadder(s, "twinkle", "perform");
    expect(readLadder(s, "twinkle")).toBe("perform");
    s.setItem(ladderKey("x"), "expert");
    expect(readLadder(s, "x")).toBeNull();
    expect(readLadder({ getItem: () => { throw new Error("blocked"); } }, "twinkle")).toBeNull();
  });

  it("a Learn take reaches Learn; a Flow take, Flow once it graduates; a Perform take, Perform if it's a record", () => {
    const p = (s: string) => new URLSearchParams(s);
    expect(reachedBy(p("song=twinkle&mode=wait&from=1&to=4"), null)).toBe("learn");
    expect(reachedBy(p("song=twinkle&mode=flow"), { deviations: [0, 0.02], held: 90 })).toBe("flow");
    expect(reachedBy(p("song=twinkle&mode=flow"), { deviations: [0, 0.02], held: 70 })).toBeNull();
    expect(reachedBy(p("song=twinkle"), null)).toBe("perform");
    expect(reachedBy(p("song=twinkle&tempo=70"), null)).toBeNull();
    expect(reachedBy(p("song=twinkle&bot=perfect"), null)).toBeNull();
    expect(reachedBy(p("song=twinkle&mode=wait&demo=1"), null)).toBeNull();
  });
});
