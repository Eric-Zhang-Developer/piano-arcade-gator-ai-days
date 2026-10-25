import type { HTMLAttributes } from 'react';
import styles from './duo.module.css';

const corners = ['tl', 'tr', 'bl', 'br'] as const;

// Corner brackets around whatever box has the focus. `primary` marks the focus in blue; `line` is the quiet hairline.
export function Brackets({ tone = 'primary', className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: 'primary' | 'line' }) {
  return <div data-tone={tone} className={[styles.brackets, className].filter(Boolean).join(' ')} {...rest}>
    {children}
    {corners.map(corner => <span key={corner} aria-hidden="true" data-corner={corner} className={styles.corner} />)}
  </div>;
}
