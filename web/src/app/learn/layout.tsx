import type { Metadata } from 'next';
import { APP_NAME } from '../../game/app-name';
import { LearningShell } from '@/learn/frontend/LearningShell';
import { ViewAsMarker } from '../../learn/frontend/viewas/ViewAsMarker';
// Each page names its tab "<page> · Learn · Étude" (#1141); /learn itself and a page without a title show the default.
export const metadata: Metadata = { title: { default: `Learn · ${APP_NAME}`, template: `%s · Learn · ${APP_NAME}` }, description: 'Explore, practice and recall musical ideas. A desktop learning frontend preview.' };
export default function LearnLayout({ children }: { children: React.ReactNode }) { return <LearningShell><ViewAsMarker/>{children}</LearningShell>; }
