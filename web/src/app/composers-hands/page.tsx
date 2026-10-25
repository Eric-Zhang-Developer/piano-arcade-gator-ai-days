import { Suspense } from "react";
import { APP_NAME } from "../../game/app-name";
import { ComposersHands } from "../../game/x/composers-hands/ComposersHands";

// /composers-hands (spike: composers-hands): the composer's own roll, then a duet. Reached from the Lab, or /play with
// ?x=composers-hands.
export const metadata = { title: `The Composer's Hands · ${APP_NAME}` };

export default function ComposersHandsPage() {
  return (
    <Suspense>
      <ComposersHands />
    </Suspense>
  );
}
