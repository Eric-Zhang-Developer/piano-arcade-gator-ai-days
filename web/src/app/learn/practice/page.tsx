import { curriculum } from '@/learn/frontend/mastery/curriculum';
import { NodePractice, NoPassage, playingNode, PracticeWorkspace } from '@/learn/frontend/playing';

type Params = { node?: string | string[] };

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const { node } = await searchParams;
  const id = typeof node === 'string' ? node : node?.[0];
  if (!id) return <PracticeWorkspace/>;
  const playing = playingNode(curriculum, id);
  return playing ? <NodePractice key={id} {...playing}/> : <NoPassage id={id}/>;
}
