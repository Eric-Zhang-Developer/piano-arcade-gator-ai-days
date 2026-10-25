import { APP_NAME } from "../../../game/app-name";
import { SoundBoard } from "../../../game/milestone-sfx/Board";

// /lab/sounds (#1396): every milestone sound on one page, to audition in a minute.
export const metadata = { title: `Sounds · Lab · ${APP_NAME}` };

export default function SoundsPage() {
  return <SoundBoard />;
}
