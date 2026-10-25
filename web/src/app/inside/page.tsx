import { Suspense } from "react";
import { APP_NAME } from "../../game/app-name";
import { Inside } from "../../game/x/inside/Inside";

// /inside (spec: inside): a grand's action, moved by the DGX. Reached from the Lab.
export const metadata = { title: `Inside the Piano · ${APP_NAME}` };

export default function InsidePage() {
  return (
    <Suspense>
      <Inside />
    </Suspense>
  );
}
