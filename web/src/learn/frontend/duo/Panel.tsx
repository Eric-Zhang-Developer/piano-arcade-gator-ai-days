import type { HTMLAttributes } from 'react';
import styles from './duo.module.css';

// A hairline frame on the dark panel fill. `paper` is the warm off-white sheet, black ink, for anything read as music.
export function Panel({ variant = 'panel', className, ...rest }: HTMLAttributes<HTMLDivElement> & { variant?: 'panel' | 'paper' }) {
  return <div data-variant={variant} className={[styles.panel, className].filter(Boolean).join(' ')} {...rest} />;
}
