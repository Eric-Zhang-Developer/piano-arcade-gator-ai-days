import { join } from "node:path";
import { Suspense } from "react";
import { APP_NAME } from "../../game/app-name";
import { loadSongs } from "../../game/song-select/load";
import { Harmony } from "../../game/x/harmony-map/Harmony";

// /harmony (spec: harmony-map): a song's constellation on the Tonnetz, and a live panel for your own playing.
export const metadata = { title: `The Harmony Map · ${APP_NAME}` };

export default function HarmonyPage() {
  const songs = loadSongs(join(process.cwd(), "public/songs")).songs.map((s) => ({ id: s.id, title: s.title }));
  return (
    <Suspense>
      <Harmony songs={songs} />
    </Suspense>
  );
}
