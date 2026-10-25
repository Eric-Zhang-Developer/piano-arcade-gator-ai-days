// The songs synthetic learners play: the curriculum's songs that have a committed chart, read and hashed the way
// /api/takes reads and hashes them. Server and scripts only (node:fs).
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { validateChart, type Chart } from "../../contracts";
import curriculumSongs from "../../learn/frontend/mastery/curriculum/songs.json";
import type { ChartSource } from "./generate";

const SONG_ID = /^[a-z0-9-]{1,64}$/;

/** `web/public/songs/<id>/chart.json` for each curriculum song that has one and passes validation, in curriculum order. */
export function curriculumCharts(webDir: string): ChartSource[] {
  return curriculumSongs.songs.flatMap(({ songId }) => {
    const file = path.join(webDir, "public", "songs", songId, "chart.json");
    if (!SONG_ID.test(songId) || !existsSync(file)) return [];
    const text = readFileSync(file, "utf8");
    const chart = JSON.parse(text) as Chart;
    if (validateChart(chart).length || chart.id !== songId) return [];
    return [{ chart, sha256: createHash("sha256").update(text).digest("hex") }];
  });
}
