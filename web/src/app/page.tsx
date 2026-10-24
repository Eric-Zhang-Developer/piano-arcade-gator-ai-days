import { join } from "node:path";
import { BuildStamp } from "@/game/build-stamp";
import { FirstRunLink } from "@/game/first-run";
import { OptionsDrawer } from "@/game/options-panel";
import { MusicSelect } from "@/game/select-layout";
import { loadSongs } from "@/game/song-select/load";

// The music select, read from web/public/songs at build time: add a chart.json anywhere under it and it shows up here.
export default function Home() {
  const { songs, invalid } = loadSongs(join(process.cwd(), "public/songs"));
  for (const { path, problems } of invalid) console.warn(`song-select: skipped songs/${path}: ${problems.join("; ")}`);
  if (!songs.length) return <main style={{ padding: 48 }}>No songs yet.</main>;
  return (
    <>
      <MusicSelect songs={songs} />
      {/* options-panel: latency (with Calibrate), effects and labels in one drawer; setup, so ?capture=1 hides its button */}
      <OptionsDrawer />
      {/* first-run: "First time?" above the Options button, and F, open the guided Twinkle */}
      <FirstRunLink />
      {/* build-stamp: the commit this page was built from and its age, so a stale checkout shows */}
      <BuildStamp />
    </>
  );
}

