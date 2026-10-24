import { join } from "node:path";
import Link from "next/link";
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
      {/* calibration: tap along to clicks to set the latency offset before a first game */}
      <Link href="/calibrate" style={calibrateLink}>
        Calibrate latency
      </Link>
    </>
  );
}

const calibrateLink: React.CSSProperties = {
  position: "fixed",
  right: 16,
  bottom: 16,
  padding: "6px 12px",
  borderRadius: 6,
  background: "var(--pa-panel)",
  color: "var(--pa-ink)",
  fontSize: 14,
  textDecoration: "none",
  zIndex: 10,
};
