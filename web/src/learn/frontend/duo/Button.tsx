import type { ButtonHTMLAttributes } from 'react';
import styles from './duo.module.css';

// `primary` is the one filled blue action on a screen; `secondary` is a hairline. Never a submit unless asked for.
export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  return <button type={type} data-variant={variant} className={[styles.button, className].filter(Boolean).join(' ')} {...rest} />;
}
