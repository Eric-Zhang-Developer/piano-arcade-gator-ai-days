"use client";
// /play's start screen in the Duo look (spec: duo-start). It only places what's already there: the stage card on the
// left; on the right Start, the play modes in one row, then one quiet settings panel. Each plugin's start panel goes
// in its group by id; a panel in no group (first-run, versus, the demo's auto-start, any new one) goes under Start.
import type { ReactNode } from "react";
import type { GamePlugin } from "../../contracts";
import { Brackets, Button, MonoLabel, Panel } from "../duo-tokens";
import { Slots } from "../play-slots/ui";
import styles from "./start.module.css";

export const groups = {
  card: ["stage-card"],
  modes: ["chunk-practice", "wait-mode", "flow-mode", "sheet-view"],
  settings: ["note-labels", "hand-mode", "leds"],
  hints: ["laptop-octaves", "rewind"],
};
const grouped = new Set(Object.values(groups).flat());

// The size of the select's PLAY.
const start = { width: "100%", fontSize: "clamp(18px, 1.5vw, 28px)", padding: "2.2vh 0", letterSpacing: "0.22em" };

export function StartScreen({
  plugins,
  panel,
  onStart,
  hint,
  controls,
}: {
  plugins: GamePlugin[];
  panel: (p: GamePlugin) => ReactNode;
  onStart: () => void;
  hint: ReactNode; // the laptop keys line
  controls: ReactNode; // latency, effects, mute, miss sound and the MIDI status (/play's own)
}) {
  const slots = (ids: string[]) => <Slots plugins={plugins.filter((p) => ids.includes(p.id))} panel={panel} />;
  return (
    <Brackets style={{ width: "min(94vw, 1800px)" }}>
      <Panel style={{ padding: "clamp(16px, 2vw, 36px)" }}>
        <div className={styles.screen} data-testid="duo-start">
          <div className={styles.card} data-group="card">{slots(groups.card)}</div>
          <div className={styles.side}>
            <Button kind="primary" onClick={onStart} autoFocus style={start}>
              Start
            </Button>
            <div className={styles.notes} data-group="notes">
              <Slots plugins={plugins.filter((p) => !grouped.has(p.id))} panel={panel} />
            </div>
            <div className={styles.modes} data-group="modes">{slots(groups.modes)}</div>
            <div className={styles.settings} data-group="settings">
              <MonoLabel>Settings</MonoLabel>
              <div className={styles.chips} data-group="chips">{slots(groups.settings)}</div>
              {controls}
              <div className={styles.hints} data-group="hints">
                {hint}
                {slots(groups.hints)}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </Brackets>
  );
}
