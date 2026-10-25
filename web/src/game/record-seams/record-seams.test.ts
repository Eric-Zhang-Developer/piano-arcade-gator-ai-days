import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { msPerBeat } from "../core/settings";
import { clickDrift, duckGain, gainAt, introFit, makeFixture, planTail, seamSettings, tailEnvelope, type TailPlan } from ".";
import { SeamTag, tagText } from "./tag";

const RATE = 48_000;
const frameMs = 1000 / RATE;
const barMsAt = (bpm: number) => 4 * msPerBeat(bpm);

// The rendered tail, plan gain × fixture, as dBFS in 10 ms windows, floored at -60: the biggest fall over any 50 ms.
function worstDrop(plan: TailPlan, offsetMs = 1500, songMs = 40_000) {
  const fx = makeFixture({ sampleRate: RATE, offsetMs, songMs });
  const env = tailEnvelope(plan);
  const fromI = Math.round(((plan.kind === "none" ? 0 : plan.startMs) + offsetMs) * RATE / 1000);
  const toI = Math.min(fx.samples.length, Math.round(((plan.kind === "none" ? 0 : plan.endMs) + offsetMs) * RATE / 1000));
  const win = RATE / 100;
  const db: number[] = [];
  for (let i = fromI; i + win <= toI; i += win) {
    let sum = 0;
    for (let j = i; j < i + win; j++) {
      const x = fx.samples[j] * gainAt(env, (j * 1000) / RATE - offsetMs);
      sum += x * x;
    }
    db.push(Math.max(seamSettings.floorDb, 20 * Math.log10(Math.sqrt(sum / win) || 1e-9)));
  }
  let worst = 0;
  for (let k = 0; k + 5 < db.length; k++) worst = Math.max(worst, db[k] - db[k + 5]);
  return worst;
}

describe("record-seams: the L-cut", () => {
  it("fades over two bars to a bar line, within one audio frame at 48 kHz", () => {
    for (const bpm of [120, 123, 97]) {
      const barMs = barMsAt(bpm);
      const plan = planTail({ endMs: 7.3 * barMs, bpm, beatsPerBar: 4, naturalEndMs: 40 * barMs });
      expect(plan.kind).toBe("fade");
      if (plan.kind !== "fade") return;
      expect(plan.fadeStartMs).toBeCloseTo(8 * barMs, 6); // the first bar line at or after songEnd
      expect(Math.abs(plan.endMs - 10 * barMs)).toBeLessThan(frameMs);
      expect(plan.bar).toBe(11); // the line at 10 bars starts bar 11
      const env = tailEnvelope(plan);
      expect(gainAt(env, plan.endMs - frameMs)).toBeGreaterThan(0);
      expect(gainAt(env, plan.endMs)).toBe(0);
    }
  });

  it("a songEnd right on a bar line fades from that line", () => {
    const plan = planTail({ endMs: 8000, bpm: 120, beatsPerBar: 4, naturalEndMs: 60_000 });
    expect(plan).toMatchObject({ kind: "fade", fadeStartMs: 8000, endMs: 12_000, bar: 7 });
  });

  it("plays out when the record ends within 12 s of songEnd, fades otherwise, and does nothing when it's over", () => {
    const at = (naturalEndMs: number) => planTail({ endMs: 10_000, bpm: 120, beatsPerBar: 4, naturalEndMs }).kind;
    expect(at(10_000 + seamSettings.playOutMs)).toBe("play-out");
    expect(at(10_000 + seamSettings.playOutMs + 1)).toBe("fade");
    expect(at(10_500)).toBe("play-out");
    expect(at(10_000)).toBe("none");
    expect(at(9_000)).toBe("none");
  });

  it("Golden plays out: the record ends about 6 s after the last note (spec's measurements)", () => {
    // 123 bpm; the last note ends at chart 188.9 s; golden.mp3 is 198.8 s with offsetMs 3784, so it ends at chart 195.0 s.
    const plan = planTail({ endMs: 189_500, bpm: 123, beatsPerBar: 4, naturalEndMs: 198_800 - 3784 });
    expect(plan).toEqual({ kind: "play-out", startMs: 189_500, endMs: 195_016 });
  });

  it("ducks by 6 dB over 200 ms and holds there until the fade", () => {
    const plan = planTail({ endMs: 9100, bpm: 120, beatsPerBar: 4, naturalEndMs: 60_000 });
    const env = tailEnvelope(plan);
    expect(gainAt(env, 9000)).toBe(1); // before songEnd: the take level
    expect(gainAt(env, 9200)).toBeCloseTo((1 + duckGain) / 2, 6);
    expect(20 * Math.log10(gainAt(env, 9300))).toBeCloseTo(-6, 1);
    expect(gainAt(env, 9999)).toBeCloseTo(duckGain, 9);
    expect(20 * Math.log10(gainAt(env, 12_000) / duckGain)).toBeCloseTo(-30, 6); // halfway down, in dB
  });

  it("no drop of more than 20 dB within 50 ms on the fixture, fade or play-out", () => {
    const fade = planTail({ endMs: 9100, bpm: 120, beatsPerBar: 4, naturalEndMs: 41_500 });
    expect(fade.kind).toBe("fade");
    expect(worstDrop(fade)).toBeLessThanOrEqual(20);
    const playOut = planTail({ endMs: 36_000, bpm: 120, beatsPerBar: 4, naturalEndMs: 41_500 });
    expect(playOut.kind).toBe("play-out");
    expect(worstDrop(playOut)).toBeLessThanOrEqual(20);
    // … where a linear-gain fade, the obvious one, would chop its last frames
    const env = tailEnvelope(fade);
    const end = fade.kind === "fade" ? fade.endMs : 0;
    expect(20 * Math.log10(gainAt(env, end - 50) / gainAt(env, end - 0.5))).toBeLessThan(1);
  });
});

describe("record-seams: the J-cut", () => {
  it("Golden's intro fits inside the count-in: 3784 ms against 8 beats at 123 bpm", () => {
    const fit = introFit(123, 8, 3784);
    expect(Math.round(fit.leadMs)).toBe(3902);
    expect(fit.joinsMidIntro).toBe(false);
    expect(introFit(123, 8, 4200).joinsMidIntro).toBe(true); // the Gap: /play's lead can't grow (#600)
  });

  it("the fixture's beats run from the file's start on the chart's grid", () => {
    const fx = makeFixture({ sampleRate: RATE, bpm: 120, offsetMs: 4000, songMs: 2000 });
    expect(fx.beatsMs.slice(0, 9)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000]);
    expect(clickDrift([-4000, -3500, -500], 4000, fx.beatsMs)).toBe(0);
    expect(clickDrift([-4000], 4004, fx.beatsMs)).toBe(4);
  });
});

describe("record-seams: the tag", () => {
  const view = { kind: "fade" as const, bar: 81, startPerf: 0, endPerf: 3900, barMs: 1951, barPhaseMs: 300 };
  it("says what the record will do, with Stop music on the kit", () => {
    expect(tagText(view)).toBe("Fades at bar 81");
    expect(tagText({ kind: "play-out", bar: null })).toBe("Plays out");
    const html = renderToStaticMarkup(createElement(SeamTag, { view, onStop: () => {} }));
    expect(html).toMatch(/role="status" data-testid="seam-tag"/);
    expect(html).toMatch(/<button data-kit="button-secondary"[^>]*data-testid="stop-music"[^>]*>Stop music<\/button>/);
    expect(html).toContain("clamp(16px, 1.25vw, 24px)");
    expect(html).toMatch(/data-testid="seam-pulse" style="animation-duration:1951ms/);
  });
});
