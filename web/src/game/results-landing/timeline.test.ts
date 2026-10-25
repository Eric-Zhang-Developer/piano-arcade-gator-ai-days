import { expect, test } from "vitest";
import { endState, landingAt, landingSettings as s, planLanding, stampLandingScale, stampShake, tallyGrid, type LandingInput } from "./timeline";

const take = (bpm: number, over: Partial<LandingInput> = {}): LandingInput => ({
  bpm,
  mountChartMs: 12_345,
  counts: [40, 6, 3, 2],
  combo: 12,
  maxCombo: 30,
  ...over,
});
const frames = (plan: ReturnType<typeof planLanding>) => Array.from({ length: Math.ceil(plan.endMs / s.frameMs) + 2 }, (_, i) => i * s.frameMs);

test("T0 to the end state is at most 2.8 s at 60, 100 and 180 BPM, whatever the mount's phase", () => {
  for (const bpm of [60, 100, 180])
    for (const mountChartMs of [0, 1, 123, 999, 5_432.1]) expect(planLanding(take(bpm, { mountChartMs })).endMs).toBeLessThanOrEqual(2800);
});

test("the out ramps the highway's clock from rate 1 to 0 without a jump, and the clock never runs back", () => {
  const plan = planLanding(take(100));
  const f = frames(plan).filter((t) => t <= s.outMs + s.frameMs);
  const rate = f.map((t) => landingAt(t, plan).clockRate);
  expect(rate[0]).toBe(1);
  expect(landingAt(s.outMs, plan).clockRate).toBe(0);
  for (let i = 1; i < rate.length; i++) {
    expect(rate[i]).toBeLessThanOrEqual(rate[i - 1]);
    expect(rate[i - 1] - rate[i]).toBeLessThan(0.1); // a ramp: no frame drops more than a tenth
  }
  const clock = f.map((t) => landingAt(t, plan).clockMs);
  for (let i = 1; i < clock.length; i++) expect(clock[i]).toBeGreaterThanOrEqual(clock[i - 1]);
});

test("the tally's starts sit on the beat grid, halved until they fit, and the whole is at most 1.2 s", () => {
  expect(tallyGrid(60)).toBe(250); // 1000 → 500 → 250
  expect(tallyGrid(100)).toBe(150); // 600 → 300 → 150
  expect(tallyGrid(180)).toBeCloseTo(1000 / 6, 6); // 333 → 167
  expect(tallyGrid(30)).toBe(250); // 2000 → … → 250
  for (const bpm of [60, 100, 180]) {
    const plan = planLanding(take(bpm));
    expect(plan.tallyEndMs - plan.tallyAtMs).toBeLessThanOrEqual(1200);
    // the first start, in chart time, is a whole number of grid steps
    const mountToTally = plan.tallyAtMs - s.outMs;
    const k = (plan.mountChartMs + mountToTally) / plan.gridMs;
    expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
    expect(mountToTally).toBeLessThan(plan.gridMs);
  }
});

test("the counts tally from 0, never go down, and land exactly on the take's numbers", () => {
  const plan = planLanding(take(100));
  const seen = frames(plan).map((t) => landingAt(t, plan).counts);
  expect(seen[0]).toEqual([0, 0, 0, 0]);
  for (let i = 1; i < seen.length; i++) seen[i].forEach((v, k) => expect(v).toBeGreaterThanOrEqual(seen[i - 1][k]));
  expect(landingAt(plan.tallyEndMs, plan).counts).toEqual([40, 6, 3, 2]);
});

test("the stamp passes 1.08, then 0.97, then rests at exactly 1.0, inside about 180 ms", () => {
  const u = Array.from({ length: 1001 }, (_, i) => i / 1000);
  const scale = u.map(stampLandingScale);
  expect(scale[0]).toBeCloseTo(1.08, 10);
  expect(Math.min(...scale)).toBeCloseTo(0.97, 3);
  const low = scale.indexOf(Math.min(...scale));
  expect(low).toBeGreaterThan(0);
  expect(scale.slice(0, low).every((v, i) => i === 0 || v < scale[i - 1])).toBe(true); // straight down to the low
  expect(scale.slice(low).every((v, i, a) => i === 0 || v > a[i - 1])).toBe(true); // straight back up to 1
  expect(stampLandingScale(1)).toBe(1);
  expect(s.stampMs).toBe(180);
  const plan = planLanding(take(100));
  expect(landingAt(plan.stampAtMs + s.stampMs, plan).rank.scale).toBe(1);
});

test("the tint lasts one 60 fps frame, and the shake stays within 2 px and ends at 0", () => {
  const plan = planLanding(take(100));
  const tinted = frames(plan).filter((t) => landingAt(t, plan).rank.tint);
  expect(tinted.length).toBe(1);
  for (const v of Array.from({ length: 1001 }, (_, i) => stampShake(i / 1000))) expect(Math.abs(v)).toBeLessThanOrEqual(2);
  expect(stampShake(1)).toBe(0);
  expect(landingAt(plan.stampAtMs + s.stampMs, plan).rank.x).toBe(0);
});

test("the after starts 250 ms after the stamp", () => {
  const plan = planLanding(take(100));
  expect(plan.afterAtMs - plan.stampAtMs).toBe(250);
  expect(landingAt(plan.afterAtMs, plan).after).toBe(0);
  expect(landingAt(plan.afterAtMs + s.afterFadeMs, plan).after).toBe(1);
});

test("MAX COMBO shows nothing while the number flies, then ticks from the landed combo to the max", () => {
  const plan = planLanding(take(100));
  expect(landingAt(s.outMs + 10, plan).combo).toBeNull();
  expect(landingAt(s.outMs + s.slideMs, plan).combo).toBe(12);
  expect(landingAt(s.outMs + s.slideMs + s.comboTickMs, plan).combo).toBe(30);
  expect(plan.stampAtMs).toBeGreaterThanOrEqual(s.outMs + s.slideMs + s.comboTickMs); // the rank waits for the cells
});

test("reduced motion: the first frame is the end state", () => {
  const plan = planLanding(take(100, { reduced: true }));
  expect(landingAt(0, plan)).toEqual(endState(plan));
  expect(endState(plan)).toMatchObject({ mounted: true, clockRate: 0, counts: [40, 6, 3, 2], combo: 30, acc: 1, after: 1 });
  expect(endState(plan).rank).toEqual({ opacity: 1, scale: 1, x: 0, tint: false });
});

test("a frame is a function of t: the same t gives the same state", () => {
  const plan = planLanding(take(60));
  for (const t of [0, 200, 500, 1500, plan.stampAtMs + 5]) expect(landingAt(t, plan)).toEqual(landingAt(t, plan));
});
