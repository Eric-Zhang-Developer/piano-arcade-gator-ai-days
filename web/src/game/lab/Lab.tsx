"use client";

// /lab (spec: lab): one page that opens every experimental and hidden feature, laid out like an arcade cabinet's
// test menu. Each entry is one real link (Tab, Enter, a new tab all work); Esc goes back to the songs.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ExperimentsGallery } from "../x/Gallery";
import { labEntries, labGroups } from "./entries";
import styles from "./lab.module.css";

export function Lab() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <main className={styles.lab} data-testid="lab">
      <header className={styles.head}>
        <h1 className={styles.title}>Lab</h1>
        <p className={styles.sub}>
          {labEntries.length} things the menu doesn’t show. Each line is from its feature’s done note.
        </p>
        <Link href="/" className={styles.back}>
          Esc · Songs
        </Link>
      </header>
      <div className={styles.groups}>
        {labGroups.map((g) => (
          <section key={g.title} className={styles.group} aria-labelledby={`lab-${g.title}`}>
            <h2 id={`lab-${g.title}`} className={styles.groupTitle}>
              {g.title}
            </h2>
            <ul className={styles.entries}>
              {g.entries.map((e) => (
                <li key={e.slug}>
                  <Link href={e.href} className={styles.entry} data-testid={`lab-${e.slug}`}>
                    <span className={styles.name}>{e.name}</span>
                    <span className={styles.desc}>{e.description}</span>
                    <span className={styles.open}>{e.open} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ExperimentsGallery />
    </main>
  );
}
