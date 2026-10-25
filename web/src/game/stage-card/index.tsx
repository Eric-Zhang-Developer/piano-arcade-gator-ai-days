// /play's start screen opens on a stage card (Chunithm's opening card), in the Duo look (duo-start): ARE YOU READY on
// a band, then the song's piano roll, title, composer, level and note count, as on the select's focus panel. It's a
// start panel, so it goes when Start unmounts the start screen.
import { useEffect, useMemo } from "react";
import type { Chart, GamePlugin } from "../../contracts";
import { difficulty } from "../difficulty/difficulty";
import { PianoRoll } from "../duo-select/PianoRoll";
import { shortComposer } from "../duo-select/Select";
import { roll } from "../duo-select/roll";
import { DataCell, MonoLabel, Panel } from "../duo-tokens";
import { uiSound } from "../ui-sounds";
import styles from "./stage-card.module.css";

type Props = Pick<Chart, "id" | "title" | "composer" | "catalog"> & Partial<Pick<Chart, "notes" | "beatsPerBar">> & { level?: number };

const lv = (n: number) => String(n).padStart(2, "0");

export function StageCard({ title, composer, catalog, level, notes, beatsPerBar }: Props) {
  useEffect(() => uiSound("sting"), []); // once per mount (ui-sounds); dropped on a direct load, before any gesture
  const r = useMemo(() => roll({ notes: notes ?? [], beatsPerBar: beatsPerBar ?? 4 }), [notes, beatsPerBar]);
  return (
    <section className={styles.card} aria-label="Stage">
      <div className={styles.band}>
        <p className={styles.ready}>Are you ready?</p>
      </div>
      <div className={styles.roll} style={{ viewTransitionName: "stage-jacket" }}>
        <PianoRoll roll={r} />
      </div>
      <h1 className={styles.title}>{title}</h1>
      <MonoLabel style={{ fontSize: "clamp(13px, 1vw, 19px)" }}>
        <span className={styles.composer} title={composer}>
          {shortComposer(composer)}
          {catalog && ` · ${catalog}`}
        </span>
      </MonoLabel>
      <Panel style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", marginTop: "2vh" }}>
        <DataCell label="LV" value={level === undefined ? "—" : lv(level)} style={{ borderLeft: "none" }} />
        {notes && <DataCell label="NOTES" value={notes.length} />}
      </Panel>
    </section>
  );
}

export function stageCard(): GamePlugin {
  return {
    id: "stage-card",
    startPanel: ({ chart }) => <StageCard {...chart} level={difficulty(chart).level} />,
  };
}
