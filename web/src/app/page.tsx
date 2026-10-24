import { join } from "node:path";
import { AccountChip } from "@/app/auth/AccountChip";
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
      {/* The left column's footer, in flow under the focused song: options-panel's drawer (latency with Calibrate,
          effects, labels; setup, so ?capture=1 hides its button), then first-run's "First time?" link, and F, which
          open the guided Twinkle. */}
      <MusicSelect
        songs={songs}
        footer={
          <>
            <OptionsDrawer />
            <FirstRunLink />
          </>
        }
      />
      {/* take-store: who's playing (Sign in, or the Google player with Profile, History and Sign out), bottom right */}
      <AccountChip />
      {/* build-stamp: the commit this page was built from and its age, so a stale checkout shows */}
      <BuildStamp />
    </>
  );
}

