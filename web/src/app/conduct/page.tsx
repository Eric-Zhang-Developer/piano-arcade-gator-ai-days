import { Suspense } from "react";
import { APP_NAME } from "../../game/app-name";
import { Conduct } from "../../game/x/conductor/Conduct";

// /conduct (spike: conductor): a hand at the camera leads the piano. Reached from the Lab, or /play with ?x=conductor.
export const metadata = { title: `Conduct · ${APP_NAME}` };

export default function ConductPage() {
  return (
    <Suspense>
      <Conduct />
    </Suspense>
  );
}
