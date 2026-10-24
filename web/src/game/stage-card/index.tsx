// /play's start screen as an arcade stage card (Chunithm's opening card): ARE YOU READY across the screen, then the
// song's jacket, title, composer and level. It's a start panel, so it goes when Start unmounts the start screen.
import type { Chart, GamePlugin } from "../../contracts";
import { difficulty } from "../difficulty/difficulty";
import { SongJacket } from "../song-jacket/SongJacket";
import styles from "./stage-card.module.css";

export function StageCard({ id, title, composer, catalog, level }: Pick<Chart, "id" | "title" | "composer" | "catalog"> & { level?: number }) {
  return (
    <section className={styles.card} aria-label="Stage">
      <div className={styles.band}>
        <p className={styles.ready}>Are you ready?</p>
      </div>
      <div className={styles.track}>
        <div className={styles.jacket}>
          <SongJacket id={id} title={title} composer={composer} />
        </div>
        <div className={styles.text}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.composer}>
            {composer}
            {catalog && ` · ${catalog}`}
          </p>
        </div>
        <div className={styles.level}>
          <span className={styles.label}>Level</span>
          <span className={styles.number}>{level ?? "—"}</span>
        </div>
      </div>
    </section>
  );
}

export function stageCard(): GamePlugin {
  return {
    id: "stage-card",
    startPanel: ({ chart }) => <StageCard {...chart} level={difficulty(chart).level} />,
  };
}
