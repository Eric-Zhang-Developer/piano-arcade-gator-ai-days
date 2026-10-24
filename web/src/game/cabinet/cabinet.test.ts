import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Chart } from "../../contracts";
import { echoGuard } from "../hand-mode/hands";
import { cabinetSettings, chartLengthMs, demoResults, keyUrl, start, tick, timers } from "./loop";

const twinkle: Chart = JSON.parse(readFileSync(new URL("../../../public/songs/twinkle/chart.json", import.meta.url), "utf8"));
const t = timers(new URLSearchParams(), twinkle);

describe("the loop", () => {
  it("goes title, attract after 30 s idle, demo after 60 s, then title once the results have shown 10 s", () => {
    let s = start(0);
    expect(tick(s, 29_999, t)).toBe(s);
    s = tick(s, 30_000, t);
    expect(s.phase).toBe("attract");
    s = tick(s, 90_000, t);
    expect(s.phase).toBe("demo");
    s = demoResults(s, 120_000);
    expect(tick(s, 129_999, t).phase).toBe("demo");
    expect(tick(s, 130_000, t).phase).toBe("title");
  });

  it("the demo times out at the chart's length plus 15 s when no results come", () => {
    const demo = tick(tick(start(0), 30_000, t), 90_000, t);
    const max = chartLengthMs(twinkle) + 15_000;
    expect(max).toBe(48 * 600 + 15_000); // Twinkle's last note ends on beat 48, at 100 BPM
    expect(tick(demo, 90_000 + max - 1, t).phase).toBe("demo");
    expect(tick(demo, 90_000 + max, t).phase).toBe("title");
  });

  it("?title=3&attract=5 shortens the loop", () => {
    const short = timers(new URLSearchParams("title=3&attract=5"), twinkle);
    expect([short.titleMs, short.attractMs]).toEqual([3000, 5000]);
  });

  it("a laptop key exits to song select, a piano key to a game", () => {
    expect(keyUrl("laptop")).toBe("/");
    expect(keyUrl("piano")).toBe("/play?song=twinkle&cabinet=1");
  });
});

it("the echo guard drops a same-pitch note-on at +30 ms but not at +80 ms", () => {
  const guard = echoGuard(cabinetSettings.echoMs);
  guard.sent(60, 1000);
  expect(guard.isEcho(60, 1030)).toBe(true);
  expect(guard.isEcho(60, 1080)).toBe(false);
  expect(guard.isEcho(62, 1030)).toBe(false);
});
