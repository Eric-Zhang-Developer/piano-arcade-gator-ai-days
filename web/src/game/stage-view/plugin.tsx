// stage-view's half on /play: "Stage view ↗" on the start screen opens /stage in its own window, as "Sheet music ↗"
// opens /sheet. sheet-view's plugin already posts the take; /stage listens to the same channel.
import type { GamePlugin } from "../../contracts";
import { kitButton } from "../duo-tokens";

export function stageView(): GamePlugin {
  return {
    id: "stage-view",
    startPanel: () => (
      <button data-capture-hide data-testid="stage-view" {...kitButton("secondary")} onClick={() => window.open("/stage", "pianoArcadeStage", "popup")}>
        Stage view ↗
      </button>
    ),
  };
}
