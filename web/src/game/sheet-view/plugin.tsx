// sheet-view's half on /play: it posts the take to /sheet on a BroadcastChannel and puts "Sheet music ↗" on the start
// screen. It draws nothing (decision 001 row 13: the score is never on the arcade screen).
import type { Chart, GamePlugin } from "../../contracts";
import { kitButton } from "../duo-tokens";

export const SHEET_CHANNEL = "pianoArcade.sheet";

// No ids: the sheet follows whichever /play started a take last.
export type SheetMessage =
  | { type: "take"; chart: Chart } // the chart as played, after every transformChart
  | { type: "clock"; nowMs: number } // the chart clock, once per drawn frame
  | { type: "judgment"; noteId: string; judgment: Judgment }
  | { type: "end" };
export type Judgment = "PERFECT" | "GREAT" | "GOOD" | "MISS";

export function sheetUrl(params: URLSearchParams): string {
  return `/sheet?${new URLSearchParams({ song: params.get("song") || "twinkle" })}`;
}

export function sheetView(): GamePlugin {
  let chart: Chart | null = null;
  let ch: BroadcastChannel | null = null;
  const post = (m: SheetMessage) => {
    ch ??= new BroadcastChannel(SHEET_CHANNEL);
    ch.postMessage(m);
  };
  let live = false; // between songStart and songEnd or quit: no clock from the results screen
  return {
    id: "sheet-view",
    transformChart(c) {
      chart = c; // last in layers.ts, so this is the chart the judge gets
      return c;
    },
    onEvent(e) {
      if (e.type === "songStart" && chart) {
        live = true;
        post({ type: "take", chart });
      }
      if (!live) return;
      if (e.type === "noteHit") post({ type: "judgment", noteId: e.noteId, judgment: e.judgment });
      if (e.type === "noteMiss") post({ type: "judgment", noteId: e.noteId, judgment: "MISS" });
      if (e.type === "songEnd" || e.type === "quit") {
        live = false;
        post({ type: "end" });
      }
    },
    draw(_ctx, frame) {
      if (live) post({ type: "clock", nowMs: frame.nowMs });
    },
    startPanel: ({ params }) => (
      <button
        data-capture-hide
        data-testid="sheet-music"
        {...kitButton("secondary")}
        onClick={() => window.open(sheetUrl(params), "pianoArcadeSheet", "popup")}
      >
        Sheet music ↗
      </button>
    ),
  };
}
