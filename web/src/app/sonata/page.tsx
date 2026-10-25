import { APP_NAME } from "../../game/app-name";
import { Sonata } from "../../game/x/build-sonata/SonataPage";

// /sonata (spec: build-sonata): the night the agents built Étude, one note per merged PR. Reached from the Lab.
export const metadata = { title: `The Build Sonata · ${APP_NAME}` };

export default function SonataPage() {
  return <Sonata />;
}
