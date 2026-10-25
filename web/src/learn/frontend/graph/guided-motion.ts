import type { Camera } from './projection';
export type Position = { x: number; y: number };
export type JourneyPlan = { source: Position; target: Position; bounds: { left: number; top: number; width: number; height: number }; href: string; title: string };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => n * n * (3 - 2 * n);
const mix = (a: number, b: number, n: number) => a + (b - a) * n;
function path(plan: JourneyPlan, t: number): Position {
  const { source: a, target: d } = plan, u = 1 - t;
  const b = { x: mix(a.x, d.x, .28), y: a.y - 72 }, c = { x: mix(a.x, d.x, .78), y: d.y - 125 };
  return { x: u*u*u*a.x + 3*u*u*t*b.x + 3*u*t*t*c.x + t*t*t*d.x, y: u*u*u*a.y + 3*u*u*t*b.y + 3*u*t*t*c.y + t*t*t*d.y };
}
export function journeyFrame(plan: JourneyPlan, elapsed: number) {
  const anticipation = clamp(elapsed / 100), t = ease(clamp((elapsed - 100) / 1000));
  const world = path(plan, t), tracking = path(plan, Math.max(0, t - .045 * Math.sin(Math.PI * t)));
  const { width, height, left, top } = plan.bounds;
  const desired = { x: mix(plan.source.x, width / 2, t) + Math.sin(Math.PI*t)*18, y: mix(plan.source.y, height / 2, t) - Math.sin(Math.PI*t)*35 };
  const scale = 1 + 2.2 * t;
  const camera: Camera = { scale, x: desired.x - ((tracking.x-width/2)*scale+width/2), y: desired.y - ((tracking.y-height/2)*scale+height/2) };
  const pet = { x: (world.x-width/2)*scale+width/2+camera.x+left, y: (world.y-height/2)*scale+height/2+camera.y+top-100*ease(clamp(t/.85)) + Math.sin(t*Math.PI*6)*3*Math.sin(Math.PI*t), scale: 1 + .14*Math.sin(Math.PI*t), tilt: -12*Math.sin(Math.PI*t), squash: elapsed < 100 ? 1-.1*Math.sin(anticipation*Math.PI) : 1 };
  return { camera, pet, progress: t, phase: elapsed < 100 ? 'anticipating' as const : elapsed < 1100 ? 'flying' as const : 'arriving' as const };
}
