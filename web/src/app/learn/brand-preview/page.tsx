import { Bricolage_Grotesque, Source_Sans_3 } from 'next/font/google';
import { BrandPreview } from '@/learn/frontend/brand-preview/BrandPreview';
const headings=Bricolage_Grotesque({subsets:['latin'],weight:['600','700'],variable:'--mentor-heading',display:'swap'});
const reading=Source_Sans_3({subsets:['latin'],weight:['400','500','600','700'],variable:'--mentor-reading',display:'swap'});
export const metadata = { title: 'Brand direction' };
export default function Page() { return <div className={`${headings.variable} ${reading.variable}`}><BrandPreview/></div>; }
