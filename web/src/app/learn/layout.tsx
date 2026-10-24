import type { Metadata } from 'next';
import { Hanken_Grotesk, Newsreader } from 'next/font/google';
import { LearningShell } from '@/learn/frontend/LearningShell';
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-learning-sans', display: 'swap' });
const serif = Newsreader({ subsets: ['latin'], variable: '--font-learning-serif', display: 'swap' });
export const metadata: Metadata = { title: 'Learning room | Piano Arcade', description: 'Explore, practice and recall musical ideas. A desktop learning frontend preview.' };
export default function LearnLayout({ children }: { children: React.ReactNode }) { return <div className={`${sans.variable} ${serif.variable}`}><LearningShell>{children}</LearningShell></div>; }
