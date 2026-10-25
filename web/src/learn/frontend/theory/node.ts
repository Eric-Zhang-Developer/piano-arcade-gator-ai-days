import { learnerId } from '../mastery/diagnostic/learner';
import { colourOf, freshState, replay } from '../mastery/engine';
import { remoteStore } from '../mastery/remote';
import type { Attempt as MasteryAttempt, Curriculum, Layer, Node, TheoryItem } from '../mastery/schema';
import { type Attempt, type ClosedQuestion, type Gate, isCorrect } from './model';

const LAYER_RANK: Record<Layer, number> = { backbone: 3, concept: 2, detail: 1 };

/** A node's theory items as one gate, or null when the node is unknown or has no theory items. */
export function nodeGate(curriculum: Curriculum, nodeId: string): Gate | null {
  const node = curriculum.nodes.find(n => n.id === nodeId);
  const [first, ...rest] = curriculum.items.filter((i): i is TheoryItem => i.type === 'theory' && i.nodeId === nodeId);
  return node && first ? { id: node.id, title: node.title, questions: [first, ...rest] } : null;
}

/** What a theory screen runs on for one node: its items as a gate, and the part of the graph around it. */
export type NodeScreen = { gate: Gate; around: Curriculum };

/**
 * The node's gate and neighbourhood (the node, the nodes it links to, those links, and their items), or null when it
 * has no gate. The neighbourhood is all Next reads to pick a node's keywords, so the browser never loads the whole graph.
 */
export function nodeScreen(curriculum: Curriculum, nodeId: string): NodeScreen | null {
  const gate = nodeGate(curriculum, nodeId);
  if (!gate) return null;
  const edges = curriculum.edges.filter(e => e.from === nodeId || e.to === nodeId);
  const ids = new Set([nodeId, ...edges.flatMap(e => [e.from, e.to])]);
  return {
    gate,
    around: {
      nodes: curriculum.nodes.filter(n => ids.has(n.id)),
      edges,
      items: curriculum.items.filter(i => ids.has(i.nodeId)),
      songs: [],
    },
  };
}

/**
 * The record of one checked answer. A reveal earlier in the round marks it revealed, so it is not counted as evidence;
 * `cold` says the question had no earlier attempt this round.
 */
export function masteryAttempt(p: {
  id: string;
  learnerId: string;
  at: string;
  nodeId: string;
  question: ClosedQuestion;
  choiceId: string;
  earlier: readonly Attempt[];
}): MasteryAttempt {
  const before = p.earlier.filter(a => a.questionId === p.question.id);
  return {
    id: p.id,
    learnerId: p.learnerId,
    at: p.at,
    itemId: p.question.id,
    nodeId: p.nodeId,
    mode: 'activity',
    correct: isCorrect(p.question, p.choiceId),
    cold: before.length === 0,
    helpShare: 0,
    revealed: before.some(a => a.type === 'reveal'),
    kind: 'theory',
    details: { choiceId: p.choiceId },
  };
}

/** Appends a checked answer to this device's attempts. Resolves false when storage refuses, so the screen can say so. */
export async function recordAnswer(p: Omit<Parameters<typeof masteryAttempt>[0], 'id' | 'at' | 'learnerId'>): Promise<boolean> {
  const attempt = masteryAttempt({ ...p, learnerId: await learnerId(), id: crypto.randomUUID(), at: new Date().toISOString() });
  return remoteStore().append(attempt);
}

/**
 * The nodes to explore with this one, by Next's keyword rule: the node, its broader idea (the strongest link a layer
 * up), and up to two linked nodes the student hasn't touched. Next already chose the node, so it isn't re-ranked here.
 * A node's colour comes only from its own attempts, so the neighbourhood gives the same keywords as the whole graph.
 */
export function exploreNodes(curriculum: Curriculum, nodeId: string, attempts: readonly MasteryAttempt[]): readonly Node[] {
  const node = curriculum.nodes.find(n => n.id === nodeId);
  if (!node) return [];
  const states = replay(curriculum, attempts);
  const nodes = new Map(curriculum.nodes.map(n => [n.id, n]));
  const links = curriculum.edges
    .flatMap(e => (e.from === nodeId ? [{ id: e.to, weight: e.weight }] : e.to === nodeId ? [{ id: e.from, weight: e.weight }] : []))
    .sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1))
    .flatMap(l => nodes.get(l.id) ?? []);
  const broader = links.find(n => LAYER_RANK[n.layer] > LAYER_RANK[node.layer]);
  const fresh = links.filter(n => n !== broader && colourOf(states.get(n.id) ?? freshState()) === 'unknown').slice(0, 2);
  return [node, ...(broader ? [broader] : []), ...fresh];
}

/** Next's keywords for this node from this device's attempts. */
export async function nodesToExplore(screen: NodeScreen): Promise<readonly Node[]> {
  return exploreNodes(screen.around, screen.gate.id, await remoteStore().list(await learnerId()));
}
