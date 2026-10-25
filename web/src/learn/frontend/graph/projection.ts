import type { Point } from './layout';

/** Current orthographic SVG view. Geography stays in world coordinates, including z. */
export const mapSize = { width: 1440, height: 700 };
export type ScreenPoint = Point & { screenX: number; screenY: number };
/** `lift` moves the graph down by up to that many pixels, using only vertical room the fit leaves spare. */
export function projectGraph(points: Point[], width = mapSize.width, height = mapSize.height, lift = 0): ScreenPoint[] {
  if (!points.length) return [];
  const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x));
  const top = Math.min(...points.map(point => point.y)), bottom = Math.max(...points.map(point => point.y));
  const scale = Math.min((width - 100) / Math.max(1, right - left), (height - 100) / Math.max(1, bottom - top));
  const shift = Math.min(lift, Math.max(0, (height - 100 - (bottom - top) * scale) / 2));
  return points.map(point => ({ ...point, screenX: Number(((point.x - (left + right) / 2) * scale + width / 2).toFixed(3)), screenY: Number(((point.y - (top + bottom) / 2) * scale + height / 2 + shift).toFixed(3)) }));
}
export function curve(from: ScreenPoint, to: ScreenPoint, reciprocal = false) {
  const dx = to.screenX - from.screenX, dy = to.screenY - from.screenY, distance = Math.hypot(dx, dy) || 1;
  const bend = reciprocal ? Math.min(180, Math.max(160, distance * .4)) : Math.min(28, distance * .07);
  const x = (from.screenX + to.screenX) / 2 - dy / distance * bend;
  const y = (from.screenY + to.screenY) / 2 + dx / distance * bend;
  const trim = (point: ScreenPoint) => { const vx = x - point.screenX, vy = y - point.screenY, length = Math.hypot(vx, vy) || 1, inset = point.depth ? 5 : 13; return { x: point.screenX + vx / length * inset, y: point.screenY + vy / length * inset }; };
  const a = trim(from), b = trim(to), q = (n: number) => Number(n.toFixed(3));
  return `M${q(a.x)},${q(a.y)} Q${q(x)},${q(y)} ${q(b.x)},${q(b.y)}`;
}

/**
 * Spark's overview budget: keep broad structure readable and show deeper generations as previews. Nodes in `priority`
 * (the student's painted ones, say) claim their place before unpainted ones of the same depth.
 */
export function presentation(allPoints: ScreenPoint[], selectedId: string | null, width = mapSize.width, height = mapSize.height, priority: ReadonlySet<string> = new Set()) {
  const points = allPoints.filter(point => point.screenX > 12 && point.screenX < width - 12 && point.screenY > 18 && point.screenY < height - 18);
  let foregroundDepth = 1;
  for (const depth of [...new Set(points.map(point => point.depth))].sort((a, b) => a - b)) {
    if (points.filter(point => point.depth <= depth).length > 60) break;
    foregroundDepth = Math.max(foregroundDepth, depth);
  }
  const candidates = points.map((point, order) => ({ point, order })).sort((a, b) => Number(b.point.node.id === selectedId) - Number(a.point.node.id === selectedId) || Number(priority.has(b.point.node.id)) - Number(priority.has(a.point.node.id)) || a.point.depth - b.point.depth || a.order - b.order);
  const placed: ScreenPoint[] = [], preview = new Set<string>();
  for (const { point } of candidates) {
    if (placed.length >= 72) break;
    const radius = point.depth === 0 ? 9 : point.depth === 1 ? 4.5 : 2.8;
    if (placed.some(other => Math.hypot(point.screenX - other.screenX, point.screenY - other.screenY) < radius + (other.depth ? 3.5 : 9) + 3)) continue;
    placed.push(point);
    if (point.depth > foregroundDepth && point.node.id !== selectedId) preview.add(point.node.id);
  }
  return { visible: new Set(placed.map(point => point.node.id)), preview };
}

export function branchCurve(from: ScreenPoint, to: ScreenPoint) {
  const dx = to.screenX - from.screenX, dy = to.screenY - from.screenY, q = (n: number) => Number(n.toFixed(3));
  return `M${q(from.screenX)},${q(from.screenY)} Q${q((from.screenX + to.screenX) / 2 - dy * .08)},${q((from.screenY + to.screenY) / 2 + dx * .08)} ${q(to.screenX)},${q(to.screenY)}`;
}


export type Camera = { scale: number; x: number; y: number };
export const overviewCamera: Camera = { scale: 1, x: 0, y: 0 };
export function viewPoints(points: ScreenPoint[], camera: Camera, width: number, height: number): ScreenPoint[] {
  return points.map(point => ({ ...point, screenX: Number(((point.screenX - width / 2) * camera.scale + width / 2 + camera.x).toFixed(3)), screenY: Number(((point.screenY - height / 2) * camera.scale + height / 2 + camera.y).toFixed(3)) }));
}
export type GraphLabel = { id: string; x: number; y: number; width: number; height: number; root: boolean; text: string };
/**
 * Spark's screen-space caption candidates and collision clearance, without moving geography. Nodes in `named` (the
 * student's painted ones, say) get a caption at any zoom when one fits without covering another node.
 */
export function placeLabels(points: ScreenPoint[], visible: Set<string>, preview: Set<string>, selectedId: string | null, hover: string | null, scale: number, width: number, height: number, named: ReadonlySet<string> = new Set()): GraphLabel[] {
  const nodes = points.filter(point => visible.has(point.node.id));
  const labels: GraphLabel[] = [];
  const priority = (point: ScreenPoint) => point.node.id === selectedId ? 100 : point.depth === 0 ? 4 : named.has(point.node.id) ? 3 : point.depth === 1 ? 2 : 1;
  for (const point of [...nodes].sort((a,b) => priority(b) - priority(a))) {
    const chosen = point.node.id === selectedId || point.node.id === hover;
    if (!chosen && !named.has(point.node.id) && (preview.has(point.node.id) || point.depth > 0 && scale < 1.7 || point.depth > 1 && scale < 2.5)) continue;
    const root = point.depth === 0, size = root ? 18 : 16, text = point.node.short;
    const labelWidth = text.length * size * .55 + 8, labelHeight = size + 6, x = point.screenX, y = point.screenY;
    const candidates = root ? [{x:x-labelWidth/2,y:y-labelHeight-18},{x:x-labelWidth/2,y:y+18},{x:x-labelWidth/2,y:y-labelHeight-52},{x:x-labelWidth/2,y:y+52},{x:x+22,y:y-labelHeight/2},{x:x-labelWidth-22,y:y-labelHeight/2}] : [{x:x+22,y:y-labelHeight/2},{x:x-labelWidth-22,y:y-labelHeight/2},{x:x-labelWidth/2,y:y-labelHeight-18},{x:x-labelWidth/2,y:y+18}];
    const available = candidates.filter(c => c.x >= 12 && c.y >= 12 && c.x + labelWidth <= width - 12 && c.y + labelHeight < height - 18 && !labels.some(box => c.x < box.x + box.width + 12 && c.x + labelWidth + 12 > box.x && c.y < box.y + box.height + 8 && c.y + labelHeight + 8 > box.y));
    const collisions = (c:{x:number;y:number}) => nodes.filter(other => other.screenX > c.x - 12 && other.screenX < c.x + labelWidth + 12 && other.screenY > c.y - 12 && other.screenY < c.y + labelHeight + 12).length;
    const at = available.find(c => collisions(c) === 0) ?? (root || chosen ? available.sort((a,b) => collisions(a)-collisions(b))[0] : undefined);
    if (at) labels.push({id:point.node.id,x:at.x,y:at.y,width:labelWidth,height:labelHeight,root,text});
  }
  return labels;
}

export type AnchoredLabel = GraphLabel & { offsetX: number; offsetY: number };
/** Keep a caption attached to its node while the prepared-entry camera moves. */
export function anchorLabels(labels: GraphLabel[], points: ScreenPoint[]): AnchoredLabel[] {
  const nodes = new Map(points.map(point => [point.node.id, point]));
  return labels.flatMap(label => {
    const node = nodes.get(label.id);
    return node ? [{ ...label, offsetX: label.x - node.screenX, offsetY: label.y - node.screenY }] : [];
  });
}
export function followLabels(labels: AnchoredLabel[], points: ScreenPoint[]): GraphLabel[] {
  const nodes = new Map(points.map(point => [point.node.id, point]));
  return labels.flatMap(label => {
    const node = nodes.get(label.id);
    return node ? [{ ...label, x: node.screenX + label.offsetX, y: node.screenY + label.offsetY }] : [];
  });
}
