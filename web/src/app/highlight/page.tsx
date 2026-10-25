import { Suspense } from "react";
import { APP_NAME } from "../../game/app-name";
import { Highlight } from "../../game/x/highlight-reel/Highlight";

// /highlight (spike: highlight-reel): a take becomes a 15-second replay video. Reached from the Lab only.
export const metadata = { title: `Highlight reel · ${APP_NAME}` };

export default function HighlightPage() {
  return (
    <Suspense>
      <Highlight />
    </Suspense>
  );
}
