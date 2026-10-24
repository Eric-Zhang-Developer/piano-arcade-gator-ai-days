// One song as a music-select card: jacket slot, title, composer, note count and level. select-layout places the
// cards and makes them links; this only draws one.
import type { ReactNode } from "react";
import styles from "./song-card.module.css";

export type SongCardProps = {
  title: string;
  composer: string;
  catalog?: string;
  noteCount: number;
  level?: number;
  focused: boolean;
  jacket?: ReactNode;
};

export function SongCard({ title, composer, catalog, noteCount, level, focused, jacket }: SongCardProps) {
  return (
    <div className={styles.card} data-focused={focused || undefined}>
      <div className={styles.jacket}>{jacket}</div>
      <div className={styles.text}>
        <div className={styles.title} title={title}>
          {title}
        </div>
        <div className={styles.composer}>
          {composer}
          {catalog && ` · ${catalog}`}
        </div>
      </div>
      <div className={styles.count}>
        <span className={styles.label}>Notes</span>
        <span className={styles.number}>{noteCount}</span>
      </div>
      <div className={styles.level}>
        <span className={styles.label}>Level</span>
        <span className={styles.number}>{level ?? "—"}</span>
      </div>
    </div>
  );
}
