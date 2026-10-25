// sheet-review's half on /play: "Review on sheet ↗" on the results stores this take's review and opens the sheet
// window on it (/sheet?review=1). data-capture-hide: the score is never on the arcade screen (decision 001).
import type { GamePlugin } from "../../contracts";
import { sheetUrl } from "../sheet-view/plugin";
import { reviewOf, saveReview } from "./review";
import styles from "./sheet-review.module.css";

export const reviewUrl = (params: URLSearchParams) => `${sheetUrl(params)}&review=1`;

export function sheetReview(): GamePlugin {
  return {
    id: "sheet-review",
    resultsPanel: ({ chart, take, results, params }) => (
      <button
        data-capture-hide
        data-testid="sheet-review"
        className={styles.button}
        onClick={() => {
          saveReview(reviewOf(chart, take, results));
          window.open(reviewUrl(params), "pianoArcadeSheet", "popup"); // sheet-view's window name: reuses an open one
        }}
      >
        Review on sheet ↗
      </button>
    ),
  };
}
