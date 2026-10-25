import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("hit particles let go of their WebGL context (#1318)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("dispose() frees the renderer and loses its context", async () => {
    vi.stubGlobal("document", { createElement: () => ({}) });
    const { hitParticles } = await import("./gl");
    const sparks = hitParticles()!;
    sparks.dispose();
    expect(made).toHaveLength(1);
    expect(made[0].dispose).toHaveBeenCalledOnce();
    expect(made[0].forceContextLoss).toHaveBeenCalledOnce();
  });
});
