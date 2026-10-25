import { APP_NAME } from "../../game/app-name";
import { SheetView } from "../../game/sheet-view/SheetView";
import { SheetTitle } from "./SheetTitle";

export const metadata = { title: `Sheet · ${APP_NAME}` };

// /sheet?song=<id>: the chart's score in its own window, for a second monitor (sheet-view).
export default function Sheet() {
  return (
    <>
      <SheetTitle />
      <SheetView />
    </>
  );
}
