import { EncodingSandbox } from '@/learn/frontend/encoding/EncodingSandbox';
import { curriculum } from '../../../learn/frontend/mastery/curriculum';
import { nodeScreen } from '../../../learn/frontend/theory';
// Relative, not @/: learn-titles.test.ts loads this page without the alias and stubs only the screen.

export const metadata = { title: 'Theory' };
export default async function Page({ searchParams }: { searchParams: Promise<{ node?: string | string[] }> }) {
  const { node } = await searchParams;
  return typeof node === 'string' ? <EncodingSandbox node={nodeScreen(curriculum, node)} /> : <EncodingSandbox />;
}
