// /play draws every plugin on one shared overlay canvas. Drawing that erases (destination-out) to fade its own shapes
// would erase other plugins' pixels there too, so it goes through isolated(): drawn on a scratch canvas the overlay's
// size, then copied over. Without a DOM (unit tests) it draws on ctx directly, so a test sees the same fills.
let scratch: HTMLCanvasElement | null = null;

export function isolated(ctx: CanvasRenderingContext2D, draw: (g: CanvasRenderingContext2D) => void): void {
  if (typeof document === "undefined" || !ctx.canvas) {
    ctx.save();
    draw(ctx);
    ctx.restore();
    return;
  }
  scratch ??= document.createElement("canvas");
  const { width, height } = ctx.canvas;
  if (scratch.width !== width || scratch.height !== height) Object.assign(scratch, { width, height });
  const g = scratch.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, width, height);
  g.setTransform(ctx.getTransform());
  g.save();
  draw(g);
  g.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}
