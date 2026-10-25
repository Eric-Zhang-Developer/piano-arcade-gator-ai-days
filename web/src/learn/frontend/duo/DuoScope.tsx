import type { HTMLAttributes } from 'react';
import { Source_Sans_3 } from 'next/font/google';
import styles from './duo.module.css';

// The calm reading face loads here, so only /learn pages that render a DuoScope fetch it. The variable and the scope
// class sit on one element because --learn-font-body reads --duo-font-reading where it's declared.
const reading = Source_Sans_3({ subsets: ['latin'], weight: ['400', '600'], variable: '--duo-font-reading', display: 'swap' });

export function DuoScope({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={[reading.variable, styles.scope, className].filter(Boolean).join(' ')} {...rest} />;
}
