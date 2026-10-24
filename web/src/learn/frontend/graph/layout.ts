import { skills, type Domain, type Skill } from './data';
export type Point = { x: number; y: number; node: Skill; depth: number };
export const mapSize = { width: 920, height: 600 };
/** Stable broad anchors and leaf-weighted outward fans, inspired by Spark's semantic map.
 * No learner state, randomness, force loop or node dragging participates in layout. */
export function layoutGraph(domain: Domain): Point[] {
  const nodes = skills.filter((node) => node.domain === domain);
  const roots = nodes.filter((node) => !node.parentId);
  const children = (id: string) => nodes.filter((node) => node.parentId === id);
  const weight = (id: string): number => Math.max(1, children(id).reduce((sum, n) => sum + weight(n.id), 0));
  const positions = [{ x: 230, y: 175, angle: -2.5 }, { x: 690, y: 175, angle: -.64 }, { x: 230, y: 425, angle: 2.5 }, { x: 690, y: 425, angle: .64 }];
  const result: Point[] = [];
  roots.forEach((root, index) => {
    const center = positions[index];
    result.push({ ...center, node: root, depth: 0 });
    const place = (parent: Skill, start: number, end: number, depth: number) => {
      const list = children(parent.id), total = list.reduce((sum, n) => sum + weight(n.id), 0);
      let cursor = start;
      list.forEach((node) => {
        const stop = cursor + (end - start) * weight(node.id) / total;
        const angle = (cursor + stop) / 2;
        const radius = depth === 1 ? 100 : 155;
        // Quantize SVG coordinates so server/client trig rounding cannot change hydration attributes.
        result.push({ x: Number((center.x + Math.cos(angle) * radius).toFixed(3)), y: Number((center.y + Math.sin(angle) * radius).toFixed(3)), node, depth });
        place(node, cursor, stop, depth + 1); cursor = stop;
      });
    };
    place(root, center.angle - 1.35, center.angle + 1.35, 1);
  });
  return result;
}
/** Directional keys select the closest node in the requested half-plane. */
export function neighbor(points: Point[], selected: string, key: string): string {
  const origin = points.find((p) => p.node.id === selected);
  if (!origin) return points[0]?.node.id ?? selected;
  const direction: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const d = direction[key]; if (!d) return selected;
  return points.filter((p) => (p.x - origin.x) * d[0] + (p.y - origin.y) * d[1] > 1)
    .map((p) => ({ p, cost: Math.hypot(p.x - origin.x, p.y - origin.y) + Math.abs((p.x - origin.x) * d[1] - (p.y - origin.y) * d[0]) * 1.2 }))
    .sort((a, b) => a.cost - b.cost)[0]?.p.node.id ?? selected;
}
