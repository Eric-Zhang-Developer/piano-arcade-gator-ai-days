import { GoalsPage } from '../../../learn/frontend/graph/GoalsPage';
// Relative, not @/: learn-titles.test.ts loads this page without the alias and stubs only the screen.

export const metadata = { title: 'Goals' };
export default function Page() { return <GoalsPage/>; }
