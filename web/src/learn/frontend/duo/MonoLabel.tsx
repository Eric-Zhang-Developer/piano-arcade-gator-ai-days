import type { HTMLAttributes } from 'react';
import styles from './duo.module.css';

// Data in small monospace caps with wide tracking: levels, bar numbers, counts.
export function MonoLabel({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={[styles.monoLabel, className].filter(Boolean).join(' ')} {...rest} />;
}
