import { join } from "node:path";
import { loadSongs } from "@/game/song-select/load";
import { Coverflow } from "./Coverflow";

// A second music select to try a coverflow (spec: menu-test). Reads the songs the way / does; / stays the real menu.
export default function MenuTest() {
  const { songs } = loadSongs(join(process.cwd(), "public/songs"));
  if (!songs.length) return <main style={{ padding: 48 }}>No songs yet.</main>;
  return <Coverflow songs={songs} />;
}
