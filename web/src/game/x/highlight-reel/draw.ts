// Highlight reel's picture (spike: highlight-reel): frame n of the reel, a pure function of n and the edit list. The
// highway at that frame's take time (replay-view's highwayAt, core's drawHighway), then broadcast overlays in the Duo
// look: the REPLAY bug, the speed tag while slowed, a lower third, a flash at each cut, and the title card.
import type { Chart, Results, Take } from "../../../contracts";
import { drawHighway, makeLayout } from "../../core/highway";
import { settings } from "../../core/settings";
import { canvasFonts, drawBrackets, drawPanel } from "../../duo-tokens";
import { highwayAt } from "../../replay-view";
import { bg, gold, ink, inkDim, panel, primary } from "../../ui-tokens";
import { highlightSettings as S, segmentAt, slowRateAt, takeTimeAt, type Edl } from "./cut";

export const reelSize = { width: 1920, height: 1080 };
export const drawSettings = {
  flashFrames: 10, // a cut's white flash fades over this
  margin: 56,
};

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// The reel's drawer for one take. drawFrame paints frame n on ctx (1920×1080). The highway is drawn on a fresh
// scratch canvas each frame: drawHighway keeps each context's key-release fades from its previous frame, and frame n
// must not depend on which frame came before (decision highlight-reel-picture).
export function reel(chart: Chart, take: Take, results: Results, edl: Edl) {
  const { width: W, height: H } = reelSize;
  const layout = makeLayout(chart, W, H, settings.perspective);
  const runLine = `${edl.run.count} ${edl.run.kind === "PERFECT" ? "PERFECT" : "HITS"} IN A ROW`;

  const highway = (ctx: Ctx2D, t: number) => {
    const scratch = new OffscreenCanvas(W, H).getContext("2d")!;
    drawHighway(scratch as unknown as CanvasRenderingContext2D, layout, chart, highwayAt(chart, take, results, t));
    ctx.drawImage(scratch.canvas, 0, 0);
  };

  const text = (ctx: Ctx2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") => {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  };

  const bug = (ctx: Ctx2D, n: number) => {
    const m = drawSettings.margin;
    drawPanel(ctx, m, m, 260, 72, panel);
    drawBrackets(ctx, m, m, 260, 72, { color: primary });
    text(ctx, "REPLAY", m + 26, m + 50, canvasFonts.display(34), ink);
    // a live dot that blinks once a second of reel time
    ctx.fillStyle = Math.floor(n / 30) % 2 ? primary : panel;
    ctx.beginPath();
    ctx.arc(m + 228, m + 37, 9, 0, Math.PI * 2);
    ctx.fill();
    const g = segmentAt(edl, n);
    const rate = g.kind === "slow" ? slowRateAt(n - g.fromFrame) : 1;
    if (rate < 0.95) {
      drawPanel(ctx, m + 276, m, 150, 72, panel);
      drawBrackets(ctx, m + 276, m, 150, 72, { color: gold });
      text(ctx, `${rate.toFixed(1)}×`, m + 351, m + 52, canvasFonts.numeral(44), gold, "center");
    }
  };

  const lowerThird = (ctx: Ctx2D) => {
    const m = drawSettings.margin;
    const y = layout.judgmentLineY - 150;
    drawPanel(ctx, m, y, 760, 110, panel);
    drawBrackets(ctx, m, y, 760, 110, { color: primary });
    text(ctx, chart.title, m + 28, y + 52, canvasFonts.display(38), ink);
    text(ctx, chart.composer.toUpperCase(), m + 28, y + 88, canvasFonts.data(20), inkDim);
  };

  const titleCard = (ctx: Ctx2D) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const [x, y, w, h] = [W / 2 - 600, H / 2 - 300, 1200, 600];
    drawPanel(ctx, x, y, w, h, panel);
    drawBrackets(ctx, x, y, w, h, { color: primary, arm: 28, lineWidth: 4 });
    text(ctx, chart.title, x + 80, y + 140, canvasFonts.display(72), ink);
    text(ctx, chart.composer.toUpperCase(), x + 80, y + 190, canvasFonts.data(26), inkDim);
    text(ctx, results.rank, x + w - 80, y + 420, canvasFonts.numeral(300), gold, "right");
    text(ctx, `${(results.accuracy * 100).toFixed(1)}%`, x + 80, y + 380, canvasFonts.numeral(110), ink);
    text(ctx, "ACCURACY", x + 84, y + 420, canvasFonts.data(22), inkDim);
    text(ctx, runLine, x + 80, y + h - 70, canvasFonts.display(40), primary);
  };

  return {
    drawFrame(ctx: Ctx2D, n: number) {
      const g = segmentAt(edl, n);
      if (g.kind === "title") titleCard(ctx);
      else {
        highway(ctx, takeTimeAt(edl, n));
        bug(ctx, n);
        lowerThird(ctx);
      }
      const since = n - g.fromFrame;
      if (g.fromFrame > 0 && since < drawSettings.flashFrames) {
        ctx.fillStyle = `rgba(255,255,255,${(1 - since / drawSettings.flashFrames) * 0.85})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
    frames: S.frames,
  };
}

// FNV-1a over a frame's RGBA bytes: equal frames, equal hash.
export function hashBytes(bytes: ArrayLike<number>): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
