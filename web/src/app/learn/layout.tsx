import type { Metadata } from 'next';
import { LearningShell } from '@/learn/frontend/LearningShell';
export const metadata: Metadata = { title: 'Learning room | Piano Arcade', description: 'Explore, practice and recall musical ideas. A desktop learning frontend preview.' };
export default function LearnLayout({ children }: { children: React.ReactNode }) { return <LearningShell>{children}</LearningShell>; }
