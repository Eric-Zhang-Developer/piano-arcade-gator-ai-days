import type { Colour, SongTag } from '../mastery/schema';

// Each goal song's title, copied from its chart (web/public/songs/<id>/chart.json) so the goal picker doesn't load 40 charts to
// label its chips (#1277). learn-a11y.test.tsx fails when a chart's title or the curriculum's songs move; regenerate then.
export const songTitles: Readonly<Record<string, string>> = {
  "alla-turca": "Rondo alla turca",
  "bach-prelude-c": "Prelude in C major",
  "brahms-waltz-15": "Waltz in A-flat major",
  "burgmuller-arabesque": "L'arabesque",
  "chopin-fantaisie-impromptu": "Fantaisie-Impromptu",
  "chopin-prelude-20": "Prelude in C minor",
  "chopin-prelude-4": "Prelude in E minor",
  "chopin-prelude-7": "Prelude in A major",
  "chopin-revolutionary": "Revolutionary Étude",
  "clair-de-lune": "Clair de lune",
  "clementi-sonatina-36-1": "Sonatina in C, 1st movement",
  "debussy-arabesque-1": "Arabesque No. 1",
  "entertainer": "The Entertainer",
  "fur-elise": "Für Elise",
  "gnossienne-1": "Gnossienne No. 1",
  "gymnopedie-1": "Gymnopédie No. 1",
  "happy-farmer": "The Happy Farmer",
  "invention-1": "Invention No. 1 in C major",
  "liszt-consolation-3": "Consolation No. 3",
  "maple-leaf-rag": "Maple Leaf Rag",
  "minuet-g-minor": "Minuet in G minor",
  "minuet-g": "Minuet in G major",
  "minute-waltz": "Minute Waltz",
  "moment-musical-3": "Moment musical No. 3 in F minor",
  "moonlight-1": "Moonlight Sonata, 1st movement (Adagio sostenuto)",
  "moonlight-3": "Moonlight Sonata, 3rd movement (Presto agitato)",
  "mountain-king": "In the Hall of the Mountain King",
  "mozart-331-theme": "Theme (Andante grazioso)",
  "mozart-545-1": "Sonata in C (\"facile\"), 1st movement",
  "musette-d": "Musette in D",
  "nocturne-op9-2": "Nocturne in E-flat major",
  "ode-to-joy": "Ode to Joy",
  "old-french-song": "Old French Song",
  "pathetique-2": "Pathétique Sonata, 2nd movement (Adagio cantabile)",
  "pathetique-3": "Pathétique Sonata, Rondo",
  "rachmaninoff-prelude-cs": "Prelude in C-sharp minor",
  "raindrop-prelude": "Raindrop Prelude",
  "traumerei": "Träumerei",
  "twinkle": "Twinkle, Twinkle, Little Star",
  "wild-horseman": "The Wild Horseman",
};

/** A goal song's title, or its id when it has no chart. */
export const songTitle = (songId: string) => songTitles[songId] ?? songId;

/** How many songs one page of the goal picker shows, so the page and its range label stay within seven things to read. */
export const songsPerPage = 6;

export type SongPage = { songs: readonly SongTag[]; fewest: number; most: number };

/**
 * The library in pages of six, fewest tagged skills first: the skill count is the one real measure of how much a song
 * asks that every song has, so each page can say honestly what range of songs it holds.
 */
export function songPages(songs: readonly SongTag[]): readonly SongPage[] {
  const ordered = [...songs].sort((a, b) => a.nodeIds.length - b.nodeIds.length || songTitle(a.songId).localeCompare(songTitle(b.songId)));
  const pages: SongPage[] = [];
  for (let start = 0; start < ordered.length; start += songsPerPage) {
    const page = ordered.slice(start, start + songsPerPage);
    pages.push({ songs: page, fewest: page[0].nodeIds.length, most: page[page.length - 1].nodeIds.length });
  }
  return pages;
}

/** A goal song as a milestone: how many of the skills it is tagged with the student has mastered, out of all of them. */
export function songMilestone(song: SongTag, colours: ReadonlyMap<string, Colour>): { mastered: number; total: number } {
  const skills = new Set(song.nodeIds);
  return { mastered: [...skills].filter(id => colours.get(id) === 'mastered').length, total: skills.size };
}
