import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Brackets, Button, DataCell, MonoLabel, Panel, canvasFonts, drawBrackets, drawPanel } from ".";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
// Every element the kit draws with a frame or a fill: its inline style says border-radius:0.
const sharp = (markup: string, kit: string) => {
  const tags = [...markup.matchAll(new RegExp(`<[^>]*data-kit="${kit}"[^>]*>`, "g"))].map((m) => m[0]);
  expect(tags.length, kit).toBeGreaterThan(0);
  for (const t of tags) expect(t, kit).toMatch(/border-radius:0/);
  return tags;
};

describe("the Duo kit's DOM pieces", () => {
  it("Panel: a hairline on the panel color, and a paper variant for sheet music", () => {
    const [dark] = sharp(html(<Panel>x</Panel>), "panel");
    expect(dark).toMatch(/background:var\(--pa-panel\)/);
    expect(dark).toMatch(/border:1px solid var\(--pa-line\)/);
    const [paper] = sharp(html(<Panel paper>x</Panel>), "panel");
    expect(paper).toMatch(/background:var\(--pa-paper\)/);
    expect(paper).toMatch(/color:var\(--pa-paper-ink\)/);
  });

  it("Brackets: four sharp corners, in primary or the hairline color", () => {
    const corners = sharp(html(<Brackets>x</Brackets>), "corner");
    expect(corners).toHaveLength(4);
    for (const c of corners) expect(c).toMatch(/var\(--pa-primary\)/);
    expect(html(<Brackets tone="line">x</Brackets>)).toMatch(/var\(--pa-line\)/);
  });

  it("Button: primary is the blue fill, secondary a hairline, both sharp with a focus ring", () => {
    const [p] = sharp(html(<Button>PLAY</Button>), "button-primary");
    expect(p).toMatch(/background:var\(--pa-primary\)/);
    const [s] = sharp(html(<Button kind="secondary">PRACTICE</Button>), "button-secondary");
    expect(s).toMatch(/background:transparent/);
    expect(s).toMatch(/border:1px solid var\(--pa-line\)/);
    for (const b of [p, s]) expect(b).toMatch(/class="[^"]*button/);
    const css = readFileSync(new URL("./kit.module.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.button:focus-visible\s*{[^}]*outline: 2px solid var\(--pa-ink\)/);
  });

  it("DataCell: a monospace caps label over a condensed numeral; tone colors the number only", () => {
    const m = html(<DataCell label="Perfect" value={42} tone="#ffe27a" />);
    sharp(m, "cell");
    expect(m).toMatch(/data-kit="mono"[^>]*font-family:var\(--pa-font-data\)[^>]*text-transform:uppercase/);
    expect(m).toMatch(/data-kit="numeral"[^>]*font-stretch:75%[^>]*color:#ffe27a/);
    expect(m).toMatch(/data-kit="mono"[^>]*color:var\(--pa-ink-dim\)/);
  });

  it("MonoLabel: small caps with wide tracking", () => {
    expect(html(<MonoLabel>Bar 14 / 32</MonoLabel>)).toMatch(/letter-spacing:0.14em;text-transform:uppercase/);
  });
});

// A context that records what it draws.
function recorder() {
  const ops: [string, ...number[]][] = [];
  const ctx = {
    strokeStyle: "" as unknown,
    fillStyle: "" as unknown,
    lineWidth: 1,
    lineCap: "round" as string,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    stroke: () => ops.push(["stroke"]),
    moveTo: (x: number, y: number) => ops.push(["moveTo", x, y]),
    lineTo: (x: number, y: number) => ops.push(["lineTo", x, y]),
    fillRect: (...a: number[]) => ops.push(["fillRect", ...a]),
    strokeRect: (...a: number[]) => ops.push(["strokeRect", ...a]),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops, state: ctx };
}

describe("the Duo kit's canvas twins", () => {
  it("drawBrackets draws four corners inside its box", () => {
    const { ctx, ops, state } = recorder();
    drawBrackets(ctx, 100, 50, 200, 80);
    expect(state.strokeStyle).toBe("#2b9bff"); // --pa-primary, typed here so an unset token fails
    const corners = ops.filter(([op]) => op === "moveTo");
    expect(corners).toHaveLength(4);
    const points = ops.filter(([op]) => op === "moveTo" || op === "lineTo").map(([, x, y]) => [x, y]);
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(50);
      expect(y).toBeLessThanOrEqual(130);
    }
    // Each corner's vertex is the box's corner, moved in by half the stroke.
    const vertices = ops.filter(([op], i) => op === "lineTo" && ops[i - 1][0] === "moveTo").map(([, x, y]) => `${x},${y}`);
    expect(vertices).toEqual(["101,51", "299,51", "299,129", "101,129"]);
  });

  it("drawBrackets takes duo-hud's style object: color, arm and lineWidth, with arms clamped to the box", () => {
    const { ctx, ops, state } = recorder();
    drawBrackets(ctx, 0, 0, 40, 20, { color: "#fff", arm: 100, lineWidth: 1 });
    expect([state.strokeStyle, state.lineWidth, state.lineCap]).toEqual(["#fff", 1, "butt"]);
    const [, x0] = ops.find(([op]) => op === "moveTo")!;
    expect(x0).toBe(0.5 + 9.5); // the arm, clamped to half the inner box's height: (19.5 - 0.5) / 2
  });

  it("drawPanel fills the box and frames it with a hairline inside it", () => {
    const { ctx, ops, state } = recorder();
    drawPanel(ctx, 0, 0, 40, 20);
    expect(ops).toEqual([
      ["fillRect", 0, 0, 40, 20],
      ["strokeRect", 0.5, 0.5, 39, 19],
    ]);
    expect([state.fillStyle, state.strokeStyle]).toEqual(["#0a0d15", "rgba(125, 132, 150, 0.25)"]); // --pa-panel, --pa-line
  });

  it("font strings: a condensed display numeral and the monospace data face, with fallbacks off the page", () => {
    expect(canvasFonts.numeral(64)).toBe("800 condensed 64px system-ui, sans-serif");
    expect(canvasFonts.data(16)).toBe("500 16px ui-monospace, monospace");
  });
});
