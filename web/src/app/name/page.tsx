import { APP_NAME } from "../../game/app-name";
import { Name } from "../../game/x/name-theme/Name";

// /name (spec: name-theme, #1190): a name becomes a theme the DGX plays and a level. Reached from the Lab.
export const metadata = { title: `Your Name, in Music · ${APP_NAME}` };

export default function NamePage() {
  return <Name />;
}
