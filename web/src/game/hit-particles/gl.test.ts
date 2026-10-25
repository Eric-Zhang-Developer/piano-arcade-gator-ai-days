import { afterEach, describe, expect, it, vi } from "vitest";
import { DUST, hitParticleSettings as S } from "./pool";

// No WebGL in node: a renderer that records what's called on it, the rest of three as it is.
const made = vi.hoisted(() => [] as { dispose: () => void; forceContextLoss: () => void }[]);
vi.mock("three", async (real) => ({
  ...(await real<typeof import("three")>()),
  WebGLRenderer: class {
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    setPixelRatio() {}
    setClearColor() {}
    constructor() {
      made.push(this);
    }
  },
}));
// Every spawn the pool is asked for: kind, count, brightness.
const spawns = vi.hoisted(() => [] as { kind: number; n: number; bright: number }[]);
vi.mock("./pool", async (real) => {
  const pool = await real<typeof import("./pool")>();
  return {
    ...pool,
    particlePool: (...a: Parameters<typeof pool.particlePool>) => {
      const p = pool.particlePool(...a);
      const spawn = p.spawn;
      p.spawn = (kind, n, ...rest) => (spawns.push({ kind, n, bright: rest[4] }), spawn(kind, n, ...rest));
      return p;
    },
  };
});

describe("a hit's energy (touch-visible)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("full energy is today's burst; less scales dust and brightness; wispOnly is one wisp, no dust", async () => {
    vi.stubGlobal("document", { createElement: () => ({}) });
    const { hitParticles } = await import("./gl");
    const sparks = hitParticles()!;
    const burst = (...a: [number?, boolean?]) => {
      spawns.length = 0;
      sparks.hit(0, 20, 100, "PERFECT", "#ffffff", ...a);
      return spawns.map((s) => [s.kind === DUST ? "dust" : "wisp", +s.n.toFixed(3), +s.bright.toFixed(3)]);
    };
    const today = [["dust", S.dust.PERFECT, S.bright.PERFECT], ["wisp", S.wisps.PERFECT, S.bright.PERFECT]];
    expect(burst()).toEqual(today);
    expect(burst(1)).toEqual(today); // so a 10-note ff chord asks no more than today's, under the pool's own cap
    expect(burst(0.25)).toEqual([["dust", S.dust.PERFECT * 0.25, 0.25], ["wisp", S.wisps.PERFECT, 0.25]]);
    expect(burst(0.25, true)).toEqual([["dust", 0, 0.25], ["wisp", 1, 0.25]]);
  });
});

describe("hit particles let go of their WebGL context (#1318)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("dispose() frees the renderer and loses its context", async () => {
    vi.stubGlobal("document", { createElement: () => ({}) });
    const { hitParticles } = await import("./gl");
    const before = made.length;
    const sparks = hitParticles()!;
    sparks.dispose();
    expect(made).toHaveLength(before + 1);
    expect(made[before].dispose).toHaveBeenCalledOnce();
    expect(made[before].forceContextLoss).toHaveBeenCalledOnce();
  });
});
