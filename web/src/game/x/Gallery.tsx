// The Lab's experiments gallery (spec: experiments): one real link per registry entry, under its group's heading in
// the order groups first appear, so a review runs top to bottom. It reads the registry alone: adding an experiment
// never edits the Lab.
import Link from "next/link";
import { experiments as registry, type Experiment } from ".";
import styles from "./gallery.module.css";

export function groupsOf(list: Experiment[]): { group: string; entries: Experiment[] }[] {
  const by = new Map<string, Experiment[]>();
  for (const x of list) by.set(x.group, [...(by.get(x.group) ?? []), x]);
  return [...by].map(([group, entries]) => ({ group, entries }));
}

export function ExperimentsGallery({ experiments = registry }: { experiments?: Experiment[] }) {
  if (!experiments.length) return null;
  return (
    <section className={styles.gallery} id="on-trial" aria-labelledby="lab-experiments" data-testid="lab-experiments">
      <header className={styles.head}>
        <h2 id="lab-experiments" className={styles.title}>
          On trial
        </h2>
        <p className={styles.sub}>
          {experiments.length} on trial, each off until its button turns it on. Kept or cut after a look.
        </p>
      </header>
      <div className={styles.groups}>
        {groupsOf(experiments).map((g) => (
          <section key={g.group} className={styles.group} aria-labelledby={`x-${g.group}`}>
            <h3 id={`x-${g.group}`} className={styles.groupTitle}>
              {g.group}
            </h3>
            <ul className={styles.grid}>
              {g.entries.map((x) => (
                <li key={x.name}>
                  <Link href={x.href} className={styles.button} data-testid={`x-${x.name}`}>
                    <span className={styles.name}>{x.title}</span>
                    <span className={styles.line}>{x.line}</span>
                    <span className={styles.meta}>
                      {x.issue && !x.line.includes(`#${x.issue}`) ? `#${x.issue} · ` : ""}x={x.name} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
