"use client";
// /play's start screen in the Duo look (spec: duo-start). It only places what's already there: the stage card on the
// left; on the right Start, the play-modes ladder over the other ways in, the hands and the Options button. Settings live in the select's
// Options drawer (options-panel), not on the screen (Eric, #763). Each plugin's start panel goes in its group by id; a
// panel in no group (first-run, versus, the demo's auto-start, any new one) goes under Start. Key hints never show
// (#772): their shortcuts stay bound and are on the ? card.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import type { GamePlugin } from "../../contracts";
import { Brackets, Button, Panel } from "../duo-tokens";
import { OptionsDrawer } from "../options-panel";
import { Slots } from "../play-slots/ui";
import { watchUrl } from "../watch-demo/demo";
import styles from "./start.module.css";

export const groups = {
  card: ["stage-card"],
  modes: ["play-modes", "chunk-practice", "wait-mode", "flow-mode", "sheet-view", "stage-view"],
  bar: ["hand-mode"],
  drawer: ["leds"],
  // Labels is the drawer's own row; Z / X and ← → are key hints. See specs/decisions/duo-start-settings.md.
  hidden: ["note-labels", "laptop-octaves", "rewind"],
};
const grouped = new Set(Object.values(groups).flat());

// An arcade button: it grows to fill the column above the modes, with the select's PLAY lettering, a size up.
const start = { flex: "1 1 auto", width: "100%", minHeight: "9vh", fontSize: "clamp(22px, 2vw, 40px)", padding: "2.2vh 0", letterSpacing: "0.3em" };

export function StartScreen({
  plugins,
  panel,
  onStart,
  onLatency,
  status,
}: {
  plugins: GamePlugin[];
  panel: (p: GamePlugin) => ReactNode;
  onStart: () => void;
  onLatency: (ms: number) => void; // /play's own: the next take uses it
  status: ReactNode; // the MIDI status line, in the drawer
}) {
  const params = useSearchParams();
  const song = params.get("song");
  const watch = song && params.get("demo") !== "1" ? watchUrl(song) : null; // not on the demo itself
  const slots = (ids: string[]) => <Slots plugins={plugins.filter((p) => ids.includes(p.id))} panel={panel} />;
  return (
    <Brackets style={{ width: "min(94vw, 1800px)" }}>
      <Panel style={{ padding: "clamp(16px, 2vw, 36px)" }}>
        <div className={styles.screen} data-testid="duo-start">
          <div className={styles.card} data-group="card">
            {slots(groups.card)}
          </div>
          <div className={styles.side}>
            <Button kind="primary" onClick={onStart} autoFocus style={start} data-testid="start">
              Start
            </Button>
            <div className={styles.notes} data-group="notes">
              <Slots plugins={plugins.filter((p) => !grouped.has(p.id))} panel={panel} />
            </div>
            <div className={styles.modes} data-group="modes">
              {slots(groups.modes)}
            </div>
            <div className={styles.bar} data-group="bar">
              {slots(groups.bar)}
              {/* The way back to the list with a mouse, as the results screen's Songs (#881). */}
              <Link href="/" className={styles.songs} data-testid="start-songs">
                Songs
              </Link>
              {/* select-calm (#1411): Watch left the select for here, where the song is already chosen. */}
              {watch && (
                <Link href={watch} className={styles.songs} data-testid="start-watch">
                  Watch first
                </Link>
              )}
              <OptionsDrawer keys={false} onLatency={onLatency}>
                <div data-group="drawer">{slots(groups.drawer)}</div>
                {status}
              </OptionsDrawer>
            </div>
          </div>
        </div>
      </Panel>
    </Brackets>
  );
}
