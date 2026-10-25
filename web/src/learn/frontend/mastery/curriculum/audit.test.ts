import { describe, expect, it } from 'vitest';
import type { Edge, Item, Node } from '../schema';
import { curriculum, loadCurriculum } from './index';

const REGIONS = ['pitch', 'rhythm', 'keys', 'chords', 'expression', 'pieces'];
const LAYERS = ['backbone', 'concept', 'detail'];
const KINDS = ['declarative', 'procedural'];
const RELATIONS = ['in-context', 'analogous', 'contradicts'];

const nodeIds = new Set(curriculum.nodes.map((n) => n.id));

function itemsFor(node: Node): Item[] {
  return curriculum.items.filter((i) => i.nodeId === node.id);
}

/** The nodes one breadth-first walk reaches, treating every edge as two-way. */
function reachable(nodes: readonly Node[], edges: readonly Edge[]): Set<string> {
  const next = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  for (const e of edges) {
    next.get(e.from)?.push(e.to);
    next.get(e.to)?.push(e.from);
  }
  const seen = new Set<string>();
  const queue = nodes.length ? [nodes[0].id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(next.get(id) ?? []));
  }
  return seen;
}

describe('curriculum audit', () => {
  it('every node has a valid region, layer and kind', () => {
    for (const n of curriculum.nodes) {
      expect(REGIONS, n.id).toContain(n.region);
      expect(LAYERS, n.id).toContain(n.layer);
      expect(KINDS, n.id).toContain(n.kind);
    }
  });

  it('every node has a title, why it matters and at least one source', () => {
    for (const n of curriculum.nodes) {
      expect(n.title.trim(), n.id).not.toBe('');
      expect(n.whyImportant.trim(), n.id).not.toBe('');
      expect(n.sources.length, n.id).toBeGreaterThan(0);
      for (const s of n.sources) {
        expect(s.title.trim(), n.id).not.toBe('');
        expect(s.url, n.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('every node has at least two items', () => {
    for (const n of curriculum.nodes) expect(itemsFor(n).length, n.id).toBeGreaterThanOrEqual(2);
  });

  it('every region has one to three backbone nodes', () => {
    for (const region of REGIONS) {
      const count = curriculum.nodes.filter((n) => n.region === region && n.layer === 'backbone').length;
      expect(count, region).toBeGreaterThanOrEqual(1);
      expect(count, region).toBeLessThanOrEqual(3);
    }
  });

  it('every item credits an existing node of the matching kind', () => {
    for (const i of curriculum.items) {
      expect(nodeIds.has(i.nodeId), i.id).toBe(true);
      const node = curriculum.nodes.find((n) => n.id === i.nodeId);
      expect(node?.kind, i.id).toBe(i.type === 'theory' ? 'declarative' : 'procedural');
    }
  });

  it('every theory choice explains itself and choice ids are unique within the question', () => {
    for (const i of curriculum.items) {
      if (i.type !== 'theory') continue;
      const choices = [i.answer, ...i.wrong];
      expect(new Set(choices.map((c) => c.id)).size, i.id).toBe(choices.length);
      for (const c of choices) {
        expect(c.text.trim(), `${i.id}/${c.id}`).not.toBe('');
        expect(c.explanation.trim(), `${i.id}/${c.id}`).not.toBe('');
      }
    }
  });

  it('every playing item has notes, a tempo and pass bars in range', () => {
    for (const i of curriculum.items) {
      if (i.type !== 'playing') continue;
      expect(i.notes.length, i.id).toBeGreaterThan(0);
      for (const note of i.notes) {
        expect(Number.isInteger(note.pitch) && note.pitch >= 21 && note.pitch <= 108, i.id).toBe(true);
        expect(note.startBeat, i.id).toBeGreaterThanOrEqual(0);
        expect(note.beats, i.id).toBeGreaterThan(0);
        expect(['left', 'right'], i.id).toContain(note.hand);
      }
      expect(i.bpm, i.id).toBeGreaterThan(0);
      for (const share of [i.pass.notesInOrder, i.pass.legato, i.pass.pedal]) {
        if (share !== undefined) expect(share >= 0 && share <= 1, i.id).toBe(true);
      }
      expect(i.pass.timingSpreadMs, i.id).toBeGreaterThan(0);
      expect(i.pass.velocitySpread, i.id).toBeGreaterThan(0);
    }
  });

  it('every edge has a rationale, a valid relation, a weight of 1-5 and two existing ends', () => {
    for (const e of curriculum.edges) {
      const label = `${e.from} -> ${e.to}`;
      expect(e.rationale.trim(), label).not.toBe('');
      expect(RELATIONS, label).toContain(e.relation);
      expect(Number.isInteger(e.weight) && e.weight >= 1 && e.weight <= 5, label).toBe(true);
      expect(nodeIds.has(e.from), label).toBe(true);
      expect(nodeIds.has(e.to), label).toBe(true);
    }
  });

  it('the graph is one connected piece', () => {
    const seen = reachable(curriculum.nodes, curriculum.edges);
    const cut = curriculum.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
    expect(cut).toEqual([]);
  });

  it('every song tag names existing nodes', () => {
    for (const s of curriculum.songs) {
      expect(s.nodeIds.length, s.songId).toBeGreaterThan(0);
      for (const id of s.nodeIds) expect(nodeIds.has(id), `${s.songId}/${id}`).toBe(true);
    }
  });
});

describe('loadCurriculum', () => {
  const node = curriculum.nodes[0];
  const item = curriculum.items[0];

  it('throws on a node id used twice', () => {
    const file = { nodes: [node], edges: [], items: [] };
    expect(() => loadCurriculum([file, file], { edges: [] }, { songs: [] })).toThrow(/Duplicate node/);
  });

  it('throws on an item id used twice', () => {
    const file = { nodes: [], edges: [], items: [item, item] };
    expect(() => loadCurriculum([file], { edges: [] }, { songs: [] })).toThrow(/Duplicate item/);
  });

  it('merges region edges with the links file', () => {
    const edge: Edge = { from: 'a', to: 'b', relation: 'analogous', weight: 1, rationale: 'r' };
    const merged = loadCurriculum([{ nodes: [], edges: [edge], items: [] }], { edges: [edge] }, { songs: [] });
    expect(merged.edges).toHaveLength(2);
  });
});
