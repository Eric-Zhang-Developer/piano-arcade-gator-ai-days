import { join } from "node:path";
import { SongList } from "@/game/song-select/SongList";
import { loadSongs } from "@/game/song-select/load";
import { settings } from "@/game/core/settings";

// The song list, read from web/public/songs at build time: add a chart.json anywhere under it and it shows up here.
export default function Home() {
  const { songs, invalid } = loadSongs(join(process.cwd(), "public/songs"));
  for (const { path, problems } of invalid) console.warn(`song-select: skipped songs/${path}: ${problems.join("; ")}`);
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 16px" }}>
      <style>{`
        .song-row { display: flex; justify-content: space-between; gap: 16px; padding: 16px; color: inherit;
          text-decoration: none; border-bottom: 1px solid #333; outline: none; }
        .song-row:hover, .song-row:focus-visible { background: #1a1a1a; box-shadow: inset 4px 0 ${settings.noteColor}; }
      `}</style>
      <h1 style={{ margin: "0 0 4px" }}>Piano Arcade</h1>
      <p style={{ margin: "0 0 32px", opacity: 0.7 }}>Pick a piece. ↑ ↓ to move, Enter to play.</p>
      {songs.length ? <SongList songs={songs} /> : <p>No songs yet.</p>}
    </main>
  );
}
