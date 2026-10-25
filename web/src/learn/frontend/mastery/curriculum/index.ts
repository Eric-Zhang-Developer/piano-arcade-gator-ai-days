import type { Curriculum, Edge, Item, Node, SongTag } from '../schema';
import backbone from './backbone.json';
import links from './links.json';
import r1 from './r1-pitch.json';
import r2 from './r2-rhythm.json';
import r3 from './r3-keys.json';
import r4 from './r4-chords.json';
import r5 from './r5-expression.json';
import r6 from './r6-pieces.json';
import songs from './songs.json';

/** The backbone and each region file: nodes, the edges they bring, and the items that credit them. */
export type GraphFile = { nodes: readonly Node[]; edges: readonly Edge[]; items: readonly Item[] };
/** Edges that cross regions, kept apart so no region file has to know another. */
export type LinksFile = { edges: readonly Edge[] };
export type SongsFile = { songs: readonly SongTag[] };

function assertUnique(ids: readonly string[], what: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${what} id: ${id}`);
    seen.add(id);
  }
}

/** Merges the curriculum files into one graph. Throws on a node or item id used twice. */
export function loadCurriculum(graphs: readonly GraphFile[], linkFile: LinksFile, songFile: SongsFile): Curriculum {
  const nodes = graphs.flatMap((g) => g.nodes);
  const items = graphs.flatMap((g) => g.items);
  assertUnique(
    nodes.map((n) => n.id),
    'node',
  );
  assertUnique(
    items.map((i) => i.id),
    'item',
  );
  return {
    nodes,
    edges: [...graphs.flatMap((g) => g.edges), ...linkFile.edges],
    items,
    songs: songFile.songs,
  };
}

// JSON imports widen string unions to `string`; the audit test checks every enum value, so the cast is guarded.
const graphFiles = [backbone, r1, r2, r3, r4, r5, r6] as unknown as readonly GraphFile[];

export const curriculum: Curriculum = loadCurriculum(
  graphFiles,
  links as unknown as LinksFile,
  songs as unknown as SongsFile,
);
