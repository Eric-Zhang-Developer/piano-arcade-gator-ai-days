// sheet-view's half on /play: it posts the take to /sheet on a BroadcastChannel and puts "Sheet music ↗" on the start
// screen. It draws nothing (decision 001 row 13: the score is never on the arcade screen). /stage (stage-view) listens
// on the same channel, and reads the judge's combo moments too; /sheet ignores them.
import type { Chart, GamePlugin } from "../../contracts";
import { kitButton } from "../duo-tokens";

export const SHEET_CHANNEL = "pianoArcade.sheet";

// No ids: the sheet follows whichever /play started a take last.
export type SheetMessage =
  | { type: "take"; chart: Chart } // the chart as played, after every transformChart
  | { type: "clock"; nowMs: number } // the chart clock, once per drawn frame
  | { type: "judgment"; noteId: string; judgment: Judgment }
  | { type: "combo"; count: number } // the judge's own combo, so WRONG presses and Flow's lost stops break it too
  | { type: "milestone"; count: number } // the judge's comboMilestone: its rule, and none in Learn
  | { type: "fullCombo" }
  | { type: "end" }
  | { type: "hello" } // a viewer opened: /stage, after the take may have started
  | { type: "catchUp"; chart: Chart }; // the answer to hello during a take: the chart, without take's reset
export type Judgment = "PERFECT" | "GREAT" | "GOOD" | "MISS";

export function sheetUrl(params: URLSearchParams): string {
  return `/sheet?${new URLSearchParams({ song: params.get("song") || "twinkle" })}`;
}

export function sheetView(): GamePlugin {
  let chart: Chart | null = null;
  let ch: BroadcastChannel | null = null;
  let live = false; // between songStart and songEnd or quit: no clock from the results screen
  const post = (m: SheetMessage) => {
    if (!ch) {
      ch = new BroadcastChannel(SHEET_CHANNEL);
      // take goes out once, at songStart: a viewer opened later says hello and gets the chart as a catchUp
      ch.onmessage = ({ data }: MessageEvent<SheetMessage>) => {
        if (data.type === "hello" && live && chart) post({ type: "catchUp", chart });
      };
    }
    ch.postMessage(m);
  };
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
      if (e.type === "combo") post({ type: "combo", count: e.count });
      if (e.type === "comboMilestone") post({ type: "milestone", count: e.count });
      if (e.type === "fullCombo") post({ type: "fullCombo" });
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
