import { curriculum } from '@/learn/frontend/mastery/curriculum';
import { Retrieval } from '@/learn/frontend/retrieval';
import { nodeScreen } from '@/learn/frontend/theory';

export const metadata = { title: 'Theory review' };
export default async function Page({ searchParams }: { searchParams: Promise<{ node?: string | string[] }> }) {
  const { node } = await searchParams;
  return typeof node === 'string' ? <Retrieval node={nodeScreen(curriculum, node)}/> : <Retrieval/>;
}
