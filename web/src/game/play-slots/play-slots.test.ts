import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { Judge, noteTimeMs } from "../core/judge";
import { nextPause, pauseClock, type PauseAction, type PauseMode } from ".";

describe("pauseClock", () => {
  it("stands still while paused: pause at t, 5 s of wall time, resume -> still t", () => {
    const c = pauseClock(1000);
    expect(c.now(3000)).toBe(2000);
    c.pause(3000);
    expect(c.paused).toBe(true);
    expect(c.now(8000)).toBe(2000);
    c.resume(8000);
    expect(c.paused).toBe(false);
    expect(c.now(8000)).toBe(2000);
    expect(c.now(8500)).toBe(2500);
    expect(c.toPerf(2500)).toBe(8500); // a chart time maps past the pause
  });

  it("adds up several pauses, and a second pause or resume in a row changes nothing", () => {
    const c = pauseClock(0);
    c.pause(100);
    c.pause(200);
    c.resume(300);
    c.resume(400);
    c.pause(500);
    c.resume(1500);
    expect(c.now(2000)).toBe(2000 - 200 - 1000);
  });

  it("misses no note that was due during the pause", () => {
    const chart: Chart = {
      id: "t", title: "t", composer: "t", source: "t", bpm: 120, beatsPerBar: 4,
      notes: [0, 1, 2, 3].map((beat) => ({ id: `n${beat}`, pitch: 60 + beat, beat, duration: 1, hand: "R" as const })),
    };
    const missed: string[] = [];
    const judge = new Judge(chart, (e) => e.type === "noteMiss" && missed.push(e.noteId));
    const c = pauseClock(0);
    judge.press(60, 0, 0); // beat 0, on time
    // Pause just before beat 1's note (500 ms), stay paused 5 s while frames keep coming, then resume.
    c.pause(450);
    for (let perf = 450; perf <= 5450; perf += 16) judge.advance(c.now(perf));
    c.resume(5450);
    // Every note is played on time on the paused-aware clock.
    for (const n of chart.notes.slice(1)) {
      const t = noteTimeMs(chart, n);
      judge.advance(t);
      judge.press(n.pitch, c.now(c.toPerf(t)), 0);
    }
    expect(missed).toEqual([]);
    expect(judge.finish(5000).counts.PERFECT).toBe(4);
  });
});

describe("nextPause", () => {
  const run = (actions: PauseAction[], from: PauseMode = "playing") => actions.reduce(nextPause, from);

  it("Esc pauses, Esc again counts down, then play goes on", () => {
    expect(run(["esc"])).toBe("menu");
    expect(run(["esc", "esc"])).toBe("countdown");
    expect(run(["esc", "esc", "countdownDone"])).toBe("playing");
    expect(run(["esc", "resume", "countdownDone"])).toBe("playing");
  });

  it("Esc during the countdown waits for it", () => {
    expect(run(["esc", "esc", "esc"])).toBe("countdown");
  });

  it("Quit and Retry from the menu end the take; mid-play they do nothing", () => {
    expect(run(["esc", "quit"])).toBe("quit");
    expect(run(["esc", "retry"])).toBe("quit");
    expect(run(["quit"])).toBe("playing");
    expect(run(["esc", "quit", "esc"])).toBe("quit");
  });
});
