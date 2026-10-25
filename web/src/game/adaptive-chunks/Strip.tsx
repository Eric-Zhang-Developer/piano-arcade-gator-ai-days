// The whole song as one row of phrase cells, the practice window lit (spec: adaptive-chunks, The strip). On the
// results panel, each phrase the take covered is shaded by its accuracy, MISS pink to PERFECT gold, so the hard
// passage shows at a glance.
import type { CSSProperties } from "react";
import type { Phrase } from "../weak-bars";
import styles from "./strip.module.css";

export function Strip({ list, from, to, scores }: { list: Phrase[]; from: number; to: number; scores?: ReadonlyMap<number, number> }) {
  const edge = (i: number) => (i === from ? styles.first : i === to ? styles.last : "");
  return (
    <figure className={styles.strip} data-testid="adapt-strip" aria-label={`Bars ${list[from].from}–${list[to].to} of ${list.at(-1)!.to}`}>
      <ol className={styles.cells}>
        {list.map((p, i) => {
          const lit = i >= from && i <= to;
          const acc = scores?.get(p.from);
          return (
            <li
              key={p.from}
              data-testid="adapt-cell"
              data-lit={lit || undefined}
              data-acc={acc === undefined ? undefined : acc.toFixed(3)}
              className={`${styles.cell} ${lit ? styles.lit : ""} ${acc === undefined ? "" : styles.scored} ${edge(i)}`}
              style={acc === undefined ? undefined : ({ "--acc": `${Math.round(acc * 100)}%` } as CSSProperties)}
            />
          );
        })}
      </ol>
      <figcaption className={styles.bars} aria-hidden>
        <span>{list[0].from}</span>
        <span className={styles.window} style={{ "--at": (from + to + 1) / 2 / list.length } as CSSProperties}>
          {list[from].from === list[to].to ? `bar ${list[from].from}` : `bars ${list[from].from}–${list[to].to}`}
        </span>
        <span>{list.at(-1)!.to}</span>
      </figcaption>
    </figure>
  );
}
