import { describe, expect, it } from "vitest";
import { pillSettings } from "../note-pills";
import { bg, handL, handR } from "../ui-tokens";
import { candidates } from "../x/hand-palette/candidates";
import {
  SpriteCache,
  bodyColor,
  chordGroups,
  drawChordHairlines,
  drawNote,
  edgePx,
  emission,
  hairlineAlpha,
  lod,
  luminance,
  materialSettings,
  mix,
  ratio,
  rgb,
  rimColor,
  rimFloor,
  texturePhase,
  type NoteState,
} from ".";

// A 2D context that records each call as "<name> <fillStyle|strokeStyle> <globalAlpha> <args>".
const recorder = () => {
  const calls: string[] = [];
  const t: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const ctx = new Proxy(t, {
    get: (o, k) =>
      k in o
        ? o[k]
        : (...a: unknown[]) => {
            if (k === "createLinearGradient") return { addColorStop() {} };
            const style = k === "stroke" ? o.strokeStyle : o.fillStyle;
            calls.push(`${String(k)} ${String(style)} ${o.globalAlpha} ${a.filter((v) => typeof v === "number").join(",")}`);
          },
    set: (o, k, v) => ((o[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
};
const L = { project: (x: number) => x, judgmentLineY: 600 };
const pill = { x: 100, width: 30, radius: 2 };
const surfaces = () => {
  const made: unknown[] = [];
  return { made, cache: new SpriteCache((w, h) => (made.push([w, h]), { width: w, height: h, getContext: () => null })) };
};
const note = (s: Partial<NoteState> = {}): NoteState => ({
  top: 300,
  bottom: 500,
  hand: handR,
  isBlack: false,
  brightness: 0.6,
  msToHit: 100,
  held: false,
  miss: false,
  missColor: "#6b5560",
  long: true,
  beatMs: 500,
  pxPerMs: 0.3,
  headPx: 10,
  glowMs: 400,
  heldGlow: 0.35,
  field: bg,
  pixelRatio: 1,
  detail: lod(10),
  reduced: false,
  ...s,
});
const texture = `rgba(255,255,255,${materialSettings.textureAlpha})`;

describe("contrast: a pill at its dimmest stays perceivable (WCAG 1.4.11)", () => {
  const hands = [
    ["today R", handR],
    ["today L", handL],
    ...Object.values(candidates).flatMap((c) => [[`${c.id} R`, c.palette.R], [`${c.id} L`, c.palette.L]]),
  ];
  it.each(hands)("%s: its rim is 3:1 against the field at note-pills' farBrightness", (_, hand) => {
    const a = Math.max(pillSettings.farBrightness, rimFloor(hand, bg));
    expect(ratio(mix([0, 0, 0], rimColor(hand), a), rgb(bg))).toBeGreaterThanOrEqual(3);
  });
  it("the body keeps the approach dimming, so the rim carries the 3:1 (decision note-material-contrast)", () => {
    // Today's body at 35% is under 3:1; this pins the reason the rim has its own floor.
    expect(ratio(mix([0, 0, 0], rgb(handR), pillSettings.farBrightness), rgb(bg))).toBeLessThan(3);
  });
  it("draws the rim at the floor on a far note", () => {
    const { ctx, calls } = recorder();
    drawNote(ctx, L, pill, note({ brightness: pillSettings.farBrightness, msToHit: 2000 }), 0, surfaces().cache);
    const rim = calls.find((c) => c.startsWith("stroke "))!;
    expect(Number(rim.split(" ")[2])).toBeCloseTo(Math.max(pillSettings.farBrightness, rimFloor(handR, bg)));
  });
});

describe("the emission ramp", () => {
  it("starts about 300 ms out and is full at the line", () => {
    expect(emission(materialSettings.emissionMs, false)).toBe(0);
    expect(emission(materialSettings.emissionMs - 1, false)).toBeGreaterThan(0);
    expect(emission(0, false)).toBe(1);
    expect(emission(-50, false)).toBe(1);
  });
  it("is absent under reduced motion", () => {
    expect(emission(0, true)).toBe(0);
    const { ctx, calls } = recorder();
    drawNote(ctx, L, pill, note({ msToHit: 0, reduced: true }), 0, surfaces().cache);
    expect(calls.some((c) => c.includes(`rgba(255,255,255,${materialSettings.emissionWhite}`))).toBe(false);
  });
});

describe("the long-note texture", () => {
  it("is locked to the beat: its phase is 0 on every beat and moves one spacing per beat", () => {
    for (const beat of [0, 1, 7, 100]) expect(texturePhase(beat * 500, 500)).toBeCloseTo(0);
    expect(texturePhase(250, 500)).toBeCloseTo(0.5);
    expect(texturePhase(-125, 500)).toBeCloseTo(0.75);
  });
  it("draws on a long note, not under reduced motion, not on a short one", () => {
    const count = (s: Partial<NoteState>) => {
      const { ctx, calls } = recorder();
      drawNote(ctx, L, pill, note(s), 0, surfaces().cache);
      return calls.filter((c) => c.startsWith(`fillRect ${texture}`)).length;
    };
    expect(count({})).toBeGreaterThan(0);
    expect(count({ reduced: true })).toBe(0);
    expect(count({ long: false })).toBe(0);
  });
});

describe("the specular edge", () => {
  it.each([1, 2])("is one device pixel at dpr %i", (dpr) => {
    expect(edgePx(dpr) * dpr).toBe(1);
    const { ctx, calls } = recorder();
    drawNote(ctx, L, pill, note({ pixelRatio: dpr }), 0, surfaces().cache);
    const edge = calls.find((c) => c.startsWith(`fillRect rgba(255,255,255,${materialSettings.edgeAlpha})`))!;
    expect(Number(edge.split(" ")[3].split(",")[3])).toBe(1 / dpr);
  });
});

describe("chords", () => {
  it("groups notes that start together", () => {
    expect(chordGroups([0, 500, 0, 500.4, 1000])).toEqual([[0, 2], [1, 3]]);
  });
  it("the hairline passes the calm rule: never brighter than the dimmest note", () => {
    for (const hand of [handR, handL]) {
      const dim = mix([0, 0, 0], bodyColor(hand, true), pillSettings.farBrightness);
      const a = hairlineAlpha(dim, bg);
      expect(a).toBeGreaterThan(0);
      expect(luminance(mix(rgb(bg), [255, 255, 255], a))).toBeLessThanOrEqual(luminance(dim));
    }
  });
  it("draws one hairline per chord", () => {
    const { ctx, calls } = recorder();
    const body = mix([0, 0, 0], rgb(handR), 0.5);
    const end = (startMs: number, x0: number) => ({ startMs, x0, x1: x0 + 20, y: 300, body });
    drawChordHairlines(ctx, L, [end(0, 0), end(0, 40), end(500, 80)], bg, 1);
    expect(calls).toHaveLength(1);
  });
});

describe("the bloom sprites", () => {
  it("are built once per size bucket, not per frame", () => {
    const { ctx } = recorder();
    const { cache, made } = surfaces();
    for (let f = 0; f < 120; f++) drawNote(ctx, L, pill, note({ msToHit: 300 - f }), f * 16, cache);
    expect(cache.builds).toBe(1);
    expect(made).toHaveLength(1);
  });
  it("draw only near the line", () => {
    const draws = (msToHit: number) => {
      const { ctx, calls } = recorder();
      drawNote(ctx, L, pill, note({ msToHit }), 0, surfaces().cache);
      return calls.filter((c) => c.startsWith("drawImage")).length;
    };
    expect(draws(1000)).toBe(0);
    expect(draws(200)).toBe(1);
  });
});

describe("level of detail", () => {
  it("drops the texture, then the bloom, past its thresholds", () => {
    expect(lod(materialSettings.lodTexture)).toEqual({ texture: true, bloom: true });
    expect(lod(materialSettings.lodTexture + 1)).toEqual({ texture: false, bloom: true });
    expect(lod(materialSettings.lodBloom + 1)).toEqual({ texture: false, bloom: false });
    const { ctx, calls } = recorder();
    drawNote(ctx, L, pill, note({ msToHit: 100, detail: lod(materialSettings.lodBloom + 1) }), 0, surfaces().cache);
    expect(calls.some((c) => c.startsWith("drawImage") || c.startsWith(`fillRect ${texture}`))).toBe(false);
  });
});

describe("black keys and held notes", () => {
  it("a black-key note's body is deeper", () => {
    expect(luminance(bodyColor(handR, true))).toBeLessThan(luminance(bodyColor(handR, false)));
  });
  it("a held note burns a line at the hit line", () => {
    const { ctx, calls } = recorder();
    drawNote(ctx, L, pill, note({ held: true, bottom: 600 }), 0, surfaces().cache);
    expect(calls.some((c) => c.startsWith("fillRect") && c.endsWith(`,${600 - materialSettings.burnPx},30,${materialSettings.burnPx}`))).toBe(true);
  });
  it("a missed note is one flat fill", () => {
    const { ctx, calls } = recorder();
    drawNote(ctx, L, pill, note({ miss: true }), 0, surfaces().cache);
    expect(calls.filter((c) => /^(fill|fillRect|stroke|drawImage) /.test(c))).toEqual([`fill #6b5560 1 `]);
  });
});
