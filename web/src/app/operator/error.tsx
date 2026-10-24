"use client";

// Last line of defence: whatever breaks while rendering, the operator page shows a banner, not Next's error screen.
import styles from "./operator.module.css";

export default function OperatorError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>OPERATOR MODE</h1>
      <div className={styles.banner} role="status">
        <p>⚠ The board couldn&apos;t be drawn: {error.message}</p>
        <button className={styles.freeze} onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
