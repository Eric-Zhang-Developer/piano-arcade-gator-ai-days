// /veritas: test players play real songs with planted mistakes, and the real judge has to find exactly those.
// The hero runs in the browser (web/src/veritas/hero.tsx); the dashboard reads the last CI run frozen by freeze.mjs.
import type { Metadata } from "next";
import { Dashboard } from "../../veritas/dashboard";
import { Hero } from "../../veritas/hero";
import styles from "./veritas.module.css";

export const metadata: Metadata = { title: "Veritas · Piano Arcade" };

export default function VeritasPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>VERITAS</h1>
        <p>
          Test players play real songs with planted mistakes. The judge has to find exactly those, and nothing else:
          a test that knows its answer before the judge runs.
        </p>
      </header>
      <Hero />
      <section className={styles.dashboard} aria-label="The last CI run">
        <h2 className={styles.h2}>The last CI run</h2>
        <Dashboard />
      </section>
    </main>
  );
}
