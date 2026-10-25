import { curriculum } from '@/learn/frontend/mastery/curriculum';
import { NoPassage, PlayCheck, playingNode } from '@/learn/frontend/playing';

type Params = { node?: string | string[]; item?: string | string[] };
const first = (v: string | string[] | undefined) => typeof v === 'string' ? v : v?.[0];

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const id = first(params.node);
  const playing = id ? playingNode(curriculum, id) : null;
  return playing ? <PlayCheck key={id} {...playing} itemId={first(params.item)}/> : <NoPassage id={id}/>;
}
