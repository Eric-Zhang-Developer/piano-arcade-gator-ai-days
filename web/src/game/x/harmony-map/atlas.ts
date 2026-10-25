// The wall's data (spec: harmony-map): every song the select lists (song-select's loader and its LAB_ONLY rule), its
// chart and pedal read from disk, its constellation drawn. Node only: /harmony/all calls it at build time.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Chart } from "../../../contracts";
import { parsePedal } from "../../pedal";
import { loadSongs } from "../../song-select/load";
import { constellationSvg, stats } from "./constellation";
import { look } from "./look";
import { fromId, triadName } from "./tonnetz";

export interface WallSong {
  id: string;
  title: string;
  composer: string;
  svg: string;
  home: string | null;
  chords: number; // chord changes
  pedal: boolean;
}

export function wallSongs(songsDir: string): WallSong[] {
  return loadSongs(songsDir).songs.map((s) => {
    const chart: Chart = JSON.parse(readFileSync(join(songsDir, s.id, "chart.json"), "utf8"));
    const pedalFile = join(songsDir, s.id, "pedal.json");
    const pedal = existsSync(pedalFile) ? parsePedal(JSON.parse(readFileSync(pedalFile, "utf8"))) : null;
    const st = stats(chart, pedal);
    return {
      id: s.id,
      title: s.title,
      composer: s.composer,
      svg: constellationSvg(st, look, `${s.title}: its harmony on the Tonnetz`),
      home: st.home === null ? null : triadName(fromId(st.home)),
      chords: st.order.length,
      pedal: !!pedal,
    };
  });
}
