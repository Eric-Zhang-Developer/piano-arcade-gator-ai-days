import type { Curriculum, Node, Region } from '../mastery/schema';
import { skills, type Domain } from './data';
import { shortTitle } from './student';

/** Subject geography, independent of the learner overlay and any rendering technology. */
export type WorldPosition = { x: number; y: number; z: number };
/** What the layout needs of a node: its place in a tree and its caption. */
export type GraphNode = { id: string; short: string; title: string; parentId?: string };
export type Point = WorldPosition & { node: GraphNode; depth: number; fanAngle: number };
export type RootRelationship = { from: string; to: string; kind: 'supports' | 'applies' | 'explains'; label: string };
const precise = (value: number) => Number(value.toFixed(3));

/** Spark course-graph.ts: broad-idea relaxation and complete-branch footprint reservation. */
function anchorPositions(roots: readonly GraphNode[], relationships: readonly RootRelationship[], radii: number[]) {
  const spacing = Math.max(...radii) * 2 + 240;
  const indices = new Map(roots.map((node, index) => [node.id, index]));
  const neighbors = roots.map(() => new Set<number>());
  for (const edge of relationships) {
    const a = indices.get(edge.from), b = indices.get(edge.to);
    if (a !== undefined && b !== undefined && a !== b) { neighbors[a].add(b); neighbors[b].add(a); }
  }
  const points = roots.map((_, index) => ({ x: Math.cos(index * Math.PI * 2 / roots.length - 2.5) * spacing, y: Math.sin(index * Math.PI * 2 / roots.length - 2.5) * spacing }));
  for (let step = 0; step < 180; step++) {
    const moves = points.map(() => ({ x: 0, y: 0 }));
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y, distance = Math.max(1, Math.hypot(dx, dy));
      const force = spacing * spacing / distance - (neighbors[a].has(b) ? distance * distance / spacing : 0);
      moves[a].x -= dx / distance * force; moves[a].y -= dy / distance * force;
      moves[b].x += dx / distance * force; moves[b].y += dy / distance * force;
    }
    const limit = spacing * .07 * (1 - step / 180);
    points.forEach((point, index) => { const length = Math.hypot(moves[index].x, moves[index].y) || 1; point.x += moves[index].x / length * Math.min(limit, length * .03); point.y += moves[index].y / length * Math.min(limit, length * .03); });
  }
  const mean = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const covariance = points.reduce((sum, point) => ({ xx: sum.xx + (point.x - mean.x) ** 2, yy: sum.yy + (point.y - mean.y) ** 2, xy: sum.xy + (point.x - mean.x) * (point.y - mean.y) }), { xx: 0, yy: 0, xy: 0 });
  const rotation = -.5 * Math.atan2(precise(2 * covariance.xy), precise(covariance.xx - covariance.yy)) - .6;
  points.forEach(point => { const x = point.x - mean.x, y = point.y - mean.y; point.x = x * Math.cos(rotation) - y * Math.sin(rotation); point.y = x * Math.sin(rotation) + y * Math.cos(rotation); });
  if (points.length > 1 && points[0].x > points.at(-1)!.x) points.forEach(point => { point.x *= -1; point.y *= -1; });
  if (points.length > 2) {
    const width = Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
    const height = Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y));
    points.forEach(point => { point.y *= Math.min(1, width / Math.max(1, height) / 1.9); });
  }
  for (let pass = 0; pass < 80; pass++) {
    let moved = false;
    for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) {
      const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y, distance = Math.hypot(dx, dy) || 1;
      const overlap = radii[a] + radii[b] + 240 - distance;
      if (overlap <= .1) continue;
      points[a].x -= dx / distance * overlap / 2; points[a].y -= dy / distance * overlap / 2;
      points[b].x += dx / distance * overlap / 2; points[b].y += dy / distance * overlap / 2; moved = true;
    }
    if (!moved) break;
  }
  // Keep complete local fans intact while spreading broad anchors into a desktop-wide geography.
  const spanX = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
  const spanY = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  const footprint = Math.max(...radii) * 2;
  const spread = Math.max(1, (1.95 * (spanY + footprint) - footprint) / Math.max(1, spanX));
  points.forEach(point => { point.x *= spread; });
  return points.map((point, index) => {
    const directions = [...neighbors[index]].map(other => (Math.atan2(points[other].y - point.y, points[other].x - point.x) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
    let start = -Math.PI / 2, sweep = Math.PI * 2;
    if (directions.length) {
      const gap = directions.map((angle, index) => ({ start: angle, sweep: (directions[index + 1] ?? directions[0] + Math.PI * 2) - angle })).sort((a, b) => b.sweep - a.sweep)[0];
      sweep = Math.min(Math.PI * 1.25, gap.sweep * .76); start = gap.start + (gap.sweep - sweep) / 2;
    }
    return { ...point, start, sweep };
  });
}

export function layoutGraph(domain: Domain, relationships: readonly RootRelationship[] = []): Point[] {
  return layoutNodes(skills.filter(node => node.domain === domain), relationships);
}

export function layoutNodes(nodes: readonly GraphNode[], relationships: readonly RootRelationship[] = []): Point[] {
  const roots = nodes.filter(node => !node.parentId);
  if (!roots.length) return [];
  const children = (id: string) => nodes.filter(node => node.parentId === id);
  const weight = (id: string): number => Math.max(1, children(id).reduce((sum, node) => sum + weight(node.id), 0));
  const rootOf = (node: GraphNode): GraphNode => node.parentId ? rootOf(nodes.find(parent => parent.id === node.parentId) ?? { ...node, parentId: undefined }) : node;
  const groups = roots.map(root => nodes.filter(node => rootOf(node).id === root.id));
  const radii = roots.map((root, index) => {
    const neighbors = new Set(relationships.flatMap(edge => edge.from === root.id ? [edge.to] : edge.to === root.id ? [edge.from] : []));
    const minimumSweep = neighbors.size ? Math.min(Math.PI * 1.25, Math.PI * 2 / neighbors.size * .76) : Math.PI * 2;
    return Math.max(800, groups[index].filter(node => !children(node.id).length).length * 28 / minimumSweep);
  });
  const centers = anchorPositions(roots, relationships, radii), result: Point[] = [];
  roots.forEach((root, index) => {
    const center = centers[index];
    const depthOf = (node: GraphNode): number => node.parentId ? 1 + depthOf(nodes.find(parent => parent.id === node.parentId)!) : 0;
    const levels = Math.max(1, ...groups[index].map(depthOf));
    function place(node: GraphNode, start: number, end: number, depth: number, reach = 1) {
      const angle = (start + end) / 2, radius = depth ? radii[index] * (.65 + .35 * (depth - 1) / Math.max(1, levels - 1)) * reach : 0;
      result.push({ x: precise(center.x + Math.cos(angle) * radius), y: precise(center.y + Math.sin(angle) * radius), z: 0, node, depth, fanAngle: precise(angle) });
      const descendants = children(node.id), total = descendants.reduce((sum, child) => sum + weight(child.id), 0);
      let cursor = start;
      for (const child of descendants) {
        const childWeight = weight(child.id), stop = cursor + (end - start) * childWeight / total;
        const branchReach = depth ? reach : .85 + childWeight / Math.max(...descendants.map(child => weight(child.id))) * .15;
        place(child, cursor, stop, depth + 1, branchReach); cursor = stop;
      }
    }
    place(root, center.start, center.start + center.sweep, 0);
  });
  return result;
}

export const regions: readonly Region[] = ['pitch', 'rhythm', 'keys', 'chords', 'expression', 'pieces'];
const regionTitles: Record<Region, string> = { pitch: 'Pitch', rhythm: 'Rhythm', keys: 'Keys', chords: 'Chords', expression: 'Expression', pieces: 'Pieces' };
export const regionId = (region: Region) => `region:${region}`;
/** Two regions get a drawn link when at least this many curriculum edges join them; fewer would tangle the overview. */
const regionLinkFloor = 5;

/**
 * The built curriculum as a tree for the map: one root per region, its backbone nodes under it, each concept under
 * its most strongly linked backbone node and each detail under its most strongly linked concept (else the next layer
 * up). Edges are not prerequisites, so the tree is only geography.
 */
export function layoutCurriculum(curriculum: Curriculum): { points: Point[]; relationships: RootRelationship[] } {
  const byId = new Map(curriculum.nodes.map(node => [node.id, node]));
  const links = new Map<string, { id: string; weight: number }[]>();
  for (const edge of curriculum.edges) {
    links.set(edge.from, [...links.get(edge.from) ?? [], { id: edge.to, weight: edge.weight }]);
    links.set(edge.to, [...links.get(edge.to) ?? [], { id: edge.from, weight: edge.weight }]);
  }
  const strongest = (node: Node, layer: Node['layer']) => (links.get(node.id) ?? [])
    .filter(link => byId.get(link.id)?.region === node.region && byId.get(link.id)?.layer === layer)
    .reduce<{ id: string; weight: number } | undefined>((best, link) => !best || link.weight > best.weight ? link : best, undefined)?.id;
  const parentOf = (node: Node) => node.layer === 'backbone' ? regionId(node.region)
    : node.layer === 'concept' ? strongest(node, 'backbone') ?? regionId(node.region)
    : strongest(node, 'concept') ?? strongest(node, 'backbone') ?? regionId(node.region);
  const nodes: GraphNode[] = [
    ...regions.map(region => ({ id: regionId(region), short: regionTitles[region], title: regionTitles[region] })),
    ...curriculum.nodes.map(node => ({ id: node.id, short: shortTitle(node.title), title: node.title, parentId: parentOf(node) })),
  ];
  const pairs = new Map<string, { from: Region; to: Region; forward: number; back: number }>();
  for (const edge of curriculum.edges) {
    const a = byId.get(edge.from)?.region, b = byId.get(edge.to)?.region;
    if (!a || !b || a === b) continue;
    const [from, to] = regions.indexOf(a) < regions.indexOf(b) ? [a, b] : [b, a], key = `${from}>${to}`;
    const pair = pairs.get(key) ?? { from, to, forward: 0, back: 0 };
    if (a === from) pair.forward++; else pair.back++;
    pairs.set(key, pair);
  }
  const relationships = [...pairs.values()].filter(pair => pair.forward + pair.back >= regionLinkFloor).map(pair => {
    const [from, to] = pair.forward >= pair.back ? [pair.from, pair.to] : [pair.to, pair.from];
    return { from: regionId(from), to: regionId(to), kind: 'supports' as const, label: '' };
  });
  return { points: layoutNodes(nodes, relationships), relationships };
}
