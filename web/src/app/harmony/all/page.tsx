import { join } from "node:path";
import { APP_NAME } from "../../../game/app-name";
import { Wall } from "../../../game/x/harmony-map/Wall";
import { wallSongs } from "../../../game/x/harmony-map/atlas";

// /harmony/all (spec: harmony-map): every library song's constellation, drawn at build time from the charts.
export const metadata = { title: `The Harmony Atlas · ${APP_NAME}` };

export default function HarmonyAllPage() {
  return <Wall songs={wallSongs(join(process.cwd(), "public/songs"))} />;
}
