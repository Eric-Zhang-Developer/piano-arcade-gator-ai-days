import { colourOf, freshState } from '../engine';
import type { Activity, Colour, Curriculum, Goals, Kind, Layer, Node, NodeState, Phase } from '../schema';

/** The most candidates the model is shown; the rest score lower and would only add noise. */
export const MAX_CANDIDATES = 20;
/** A session never opens more than this many nodes the student has never touched (principle 4). */
export const MAX_NEW = 3;

const LAYER_RANK: Record<Layer, number> = { backbone: 3, concept: 2, detail: 1 };
const DUE_BONUS = 5;
const GOAL_BONUS = 2; // per goal song that needs the node
const MAX_LINK_STRENGTH = 3;

/** A node the next session could work on, with the evidence the decision may use. */
export type Candidate = {
  nodeId: string;
  title: string;
  layer: Layer;
  kind: Kind;
  colour: Colour;
  activity: Activity;
  /** A mastered node whose cold check is due. */
  due: boolean;
  /** No counting attempt yet. */
  isNew: boolean;
  belief: number;
  counted: number;
  nextCheckAt: string | null;
  /** The mastered nodes it links to, strongest first. */
  masteredLinks: readonly string[];
  goalSongs: readonly string[];
  /** Node ids: the node, its broader idea, and up to two new linked nodes. */
  keywords: readonly string[];
  score: number;
  reason: string;
};

/** The activity a node's quadrant calls for. */
export function activityOf(kind: Kind, phase: Phase): Activity {
  if (kind === 'declarative') return phase === 'encoding' ? 'sandbox' : 'test';
  return phase === 'encoding' ? 'practice' : 'playCheck';
}

const ROUTES: Record<Activity, string> = {
  sandbox: '/learn/understand',
  test: '/learn/review/theory',
  practice: '/learn/practice',
  playCheck: '/learn/check',
};

/** The page that runs an activity on a node. */
export function activityRoute(activity: Activity, nodeId: string): string {
  return `${ROUTES[activity]}?node=${encodeURIComponent(nodeId)}`;
}

type Link = { id: string; weight: number };

/** Each node's links, strongest first (ties by id), both directions since links have no order. */
function linksOf(curriculum: Curriculum): ReadonlyMap<string, readonly Link[]> {
  const links = new Map<string, Link[]>(curriculum.nodes.map(n => [n.id, []]));
  for (const e of curriculum.edges) {
    links.get(e.from)?.push({ id: e.to, weight: e.weight });
    links.get(e.to)?.push({ id: e.from, weight: e.weight });
  }
  for (const list of links.values()) list.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : 1));
  return links;
}

/**
 * The next session's candidates, best first. Due cold checks always qualify. Otherwise a node qualifies when it is
 * unknown or still encoding and links to a mastered node. With nothing mastered yet, the frontier is the backbone and
 * whatever the student has already started. Score: due bonus + layer + link strength to mastered nodes + goal value.
 */
export function buildCandidates(
  curriculum: Curriculum,
  states: ReadonlyMap<string, NodeState>,
  goals: Goals,
  now: Date,
): Candidate[] {
  const links = linksOf(curriculum);
  const nodes = new Map(curriculum.nodes.map(n => [n.id, n]));
  const stateOf = (id: string) => states.get(id) ?? freshState();
  const colour = (id: string) => colourOf(stateOf(id));
  const anyMastered = curriculum.nodes.some(n => colour(n.id) === 'mastered');
  const goalSet = new Set(goals.songIds);
  const goalSongsOf = new Map<string, string[]>();
  for (const tag of curriculum.songs) {
    if (!goalSet.has(tag.songId)) continue;
    for (const id of tag.nodeIds) goalSongsOf.set(id, [...(goalSongsOf.get(id) ?? []), tag.songId]);
  }

  const candidates: Candidate[] = [];
  for (const node of curriculum.nodes) {
    const state = stateOf(node.id);
    const c = colourOf(state);
    const nodeLinks = links.get(node.id) ?? [];
    const mastered = nodeLinks.filter(l => colour(l.id) === 'mastered');
    const due = c === 'mastered' && state.nextCheckAt !== null && Date.parse(state.nextCheckAt) <= now.getTime();
    const frontier = c !== 'mastered' && (anyMastered ? mastered.length > 0 : node.layer === 'backbone' || c === 'in-progress');
    if (!due && !frontier) continue;

    const goalSongs = goalSongsOf.get(node.id) ?? [];
    const linkStrength = Math.min(MAX_LINK_STRENGTH, mastered.reduce((sum, l) => sum + l.weight, 0) / 5);
    const score = (due ? DUE_BONUS : 0) + LAYER_RANK[node.layer] + linkStrength + GOAL_BONUS * goalSongs.length;
    candidates.push({
      nodeId: node.id,
      title: node.title,
      layer: node.layer,
      kind: node.kind,
      colour: c,
      activity: activityOf(node.kind, state.phase),
      due,
      isNew: state.counted === 0,
      belief: Math.round(state.belief * 100) / 100,
      counted: state.counted,
      nextCheckAt: state.nextCheckAt,
      masteredLinks: mastered.map(l => l.id),
      goalSongs,
      keywords: keywordsOf(node, nodeLinks, nodes, colour),
      score: Math.round(score * 100) / 100,
      reason: reasonOf(node, due, mastered, nodes, goalSongs.length),
    });
  }
  return candidates
    .sort((a, b) => b.score - a.score || (a.nodeId < b.nodeId ? -1 : 1))
    .slice(0, MAX_CANDIDATES);
}

/** The node, its broader idea (the strongest link a layer up), and up to two new linked nodes. */
function keywordsOf(
  node: Node,
  nodeLinks: readonly Link[],
  nodes: ReadonlyMap<string, Node>,
  colour: (id: string) => Colour,
): string[] {
  const broader = nodeLinks.find(l => {
    const other = nodes.get(l.id);
    return other !== undefined && LAYER_RANK[other.layer] > LAYER_RANK[node.layer];
  });
  const fresh = nodeLinks.filter(l => l.id !== broader?.id && colour(l.id) === 'unknown').slice(0, 2);
  return [node.id, ...(broader ? [broader.id] : []), ...fresh.map(l => l.id)];
}

/** The fallback's plain-words reason; the model writes its own. */
function reasonOf(
  node: Node,
  due: boolean,
  mastered: readonly Link[],
  nodes: ReadonlyMap<string, Node>,
  goalCount: number,
): string {
  const parts: string[] = [];
  if (due) parts.push(`${node.title} is due for a cold check, so it doesn't slip.`);
  else if (mastered.length > 0) {
    const anchor = nodes.get(mastered[0].id)?.title ?? mastered[0].id;
    parts.push(`${node.title} builds on ${anchor}, which you have mastered.`);
  } else parts.push(`${node.title} is a ${node.layer === 'backbone' ? 'core idea' : 'next step'} to start from.`);
  if (goalCount > 0) parts.push(goalCount === 1 ? 'A goal song needs it.' : `${goalCount} goal songs need it.`);
  return parts.join(' ');
}
