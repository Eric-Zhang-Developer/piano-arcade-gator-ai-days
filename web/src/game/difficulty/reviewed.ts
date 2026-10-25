// Every select song's level, checked against a published grade (spec: level-review). Henle first, then RCM, then
// ABRSM, each read on the publisher's own page. Grade to level: decision level-review-mapping.
// old: the formula's level when the row was written; difficulty() shifts the formula by (level - old).
export interface Grade {
  scale: "henle" | "rcm" | "abrsm";
  value: number;
  url: string;
}

const HN = (path: string) => `https://www.henle.de/${path}`;
const RCM = "https://teacherportal.rcmusic.com/getattachment/57f3734d-97e5-4777-b67e-4b1111ee31a3/piano-syllabus-2022-edition.pdf";
const ABRSM = "https://www.abrsm.org/sites/default/files/2024-06/Piano%202025%20&%202026%20Prac%20syllabus%2020240524_access.pdf";

export const reviewedLevels: Record<string, { old: number; level: number; grade?: Grade; note?: string }> = {
  "twinkle": { old: 1, level: 1, note: "No grade: a tune under any grade. Looked at RCM and ABRSM (rcmusic.com, abrsm.org)." },
  "hot-cross-buns": { old: 1, level: 1, note: "no published grade: a nursery tune" },
  "mary-lamb": { old: 1, level: 1, note: "no published grade: a nursery tune" },
  "london-bridge": { old: 1, level: 1, note: "no published grade: a nursery tune" },
  "jingle-bells": { old: 2, level: 2, note: "no published grade: a nursery tune" },
  "frere-jacques-solo": { old: 1, level: 1, note: "no published grade: a nursery tune" },
  "minuet-g": { old: 2, level: 2, grade: { scale: "henle", value: 1, url: HN("Notebook-for-Anna-Magdalena-Bach/HN-349") }, note: "RCM Level 3." },
  "clair-de-lune": { old: 3, level: 8, grade: { scale: "henle", value: 5, url: HN("en/Clair-de-lune/HN-391") }, note: "The chart is the opening only (79 notes at 60 BPM), so 2 below the grade." },
  "ode-to-joy": { old: 3, level: 3, note: "No grade: a hymn-tune setting. Looked at henle.de, RCM Piano Syllabus 2022, ABRSM 2023-26 practical grades." },
  "bach-prelude-c": { old: 4, level: 2, grade: { scale: "henle", value: 1, url: HN("Prelude-and-Fugue-C-major-BWV-846-Well-Tempered-Clavier-Part-I/HN-1642") }, note: "The prelude alone; the fugue is Henle 6." },
  "clementi-sonatina-36-1": { old: 4, level: 6, grade: { scale: "henle", value: 3, url: HN("en/Six-Piano-Sonatinas-op.-36/HN-848") }, note: "Henle grades the whole sonatina. RCM Level 3 for the 1st movement." },
  "old-french-song": { old: 4, level: 5, grade: { scale: "rcm", value: 4, url: RCM }, note: "RCM Level 4, List C (p. 43). No Henle edition of op. 39." },
  "burgmuller-arabesque": { old: 5, level: 2, grade: { scale: "henle", value: 1, url: HN("en/25-Etudes-op.-100/HN-1726") }, note: "RCM Level 3 etude." },
  "chopin-prelude-4": { old: 5, level: 8, grade: { scale: "henle", value: 4, url: HN("en/Preludes/HN-882") } },
  "gnossienne-1": { old: 5, level: 4, grade: { scale: "henle", value: 2, url: HN("en/Gnossiennes/HN-1073") } },
  "minuet-g-minor": { old: 5, level: 2, grade: { scale: "henle", value: 1, url: HN("Notebook-for-Anna-Magdalena-Bach/HN-349") }, note: "RCM Level 3." },
  "moonlight-1": { old: 5, level: 8, grade: { scale: "henle", value: 4, url: HN("en/At-the-Piano-9-well-known-original-pieces/HN-1820") }, note: "The movement alone; the whole sonata is Henle 7 (HN 1062)." },
  "traumerei": { old: 5, level: 8, grade: { scale: "henle", value: 5, url: HN("Scenes-from-Childhood-op.-15/HN-44") }, note: "The chart is bars 1-8 of 24 with the repeat, so 2 below the grade." },
  "chopin-prelude-20": { old: 6, level: 8, grade: { scale: "henle", value: 4, url: HN("en/Preludes/HN-882") } },
  "gymnopedie-1": { old: 6, level: 4, grade: { scale: "henle", value: 2, url: HN("en/Gymnopedies/HN-1072") } },
  "happy-farmer": { old: 6, level: 6, grade: { scale: "henle", value: 3, url: HN("Album-for-the-Young-op.-68/HN-45") }, note: "RCM Level 4." },
  "liszt-consolation-3": { old: 6, level: 10, grade: { scale: "henle", value: 5, url: HN("en/Consolations-including-first-edition-of-the-early-version/HN-465") } },
  "mozart-331-theme": { old: 6, level: 6, note: "No grade for the theme alone. Henle grades the whole K. 331 at 6 (HN 1300); ABRSM Grade 8 lists the theme with Vars. 1-6; RCM lists the whole sonata at ARCT." },
  "mozart-545-1": { old: 6, level: 8, grade: { scale: "henle", value: 4, url: HN("en/At-the-Piano-15-well-known-original-pieces/HN-1812") }, note: "The movement alone; the whole sonata is Henle 5. RCM Level 8." },
  "raindrop-prelude": { old: 6, level: 8, grade: { scale: "henle", value: 5, url: HN("en/Preludes/HN-882") }, note: "The chart is the D-flat opening (bars 1-27), without the C-sharp minor middle, so 2 below the grade." },
  "fur-elise": { old: 7, level: 6, grade: { scale: "henle", value: 3, url: HN("Bagatelle-in-a-minor-WoO-59-Fuer-Elise/HN-1347") }, note: "RCM Level 7." },
  "invention-1": { old: 7, level: 6, grade: { scale: "henle", value: 3, url: HN("en/Two-Part-Inventions/HN-591") }, note: "RCM Level 7." },
  "musette-d": { old: 7, level: 2, grade: { scale: "henle", value: 1, url: HN("Notebook-for-Anna-Magdalena-Bach/HN-349") }, note: "RCM Level 3." },
  "pathetique-2": { old: 7, level: 7, grade: { scale: "abrsm", value: 8, url: ABRSM }, note: "ABRSM Grade 8, List B 6 (p. 43). Henle grades only the whole sonata (7, HN 1348). The chart is the theme (bars 1-16), so 2 below the grade." },
  "chopin-prelude-7": { old: 8, level: 8, grade: { scale: "henle", value: 4, url: HN("en/Preludes/HN-882") } },
  "minute-waltz": { old: 8, level: 12, grade: { scale: "henle", value: 6, url: HN("en/Waltzes/HN-131") } },
  "mountain-king": { old: 8, level: 12, grade: { scale: "henle", value: 6, url: HN("Peer-Gynt-Suites/HN-1239") }, note: "Grieg's own solo-piano version." },
  "wild-horseman": { old: 8, level: 6, grade: { scale: "henle", value: 3, url: HN("Album-for-the-Young-op.-68/HN-45") }, note: "RCM Level 4." },
  "alla-turca": { old: 9, level: 9, grade: { scale: "abrsm", value: 8, url: ABRSM }, note: "ABRSM Grade 8, List A 1 (p. 43). Henle grades only the whole sonata (6, HN 1300)." },
  "brahms-waltz-15": { old: 9, level: 12, grade: { scale: "henle", value: 6, url: HN("Waltzes-op.-39/HN-1286") }, note: "The A-flat original; the composer's easy version is Henle 5." },
  "moment-musical-3": { old: 9, level: 10, grade: { scale: "henle", value: 5, url: HN("Impromptus-and-Moments-musicaux/HN-4") }, note: "RCM Level 9." },
  "nocturne-op9-2": { old: 9, level: 12, grade: { scale: "henle", value: 6, url: HN("en/Nocturnes/HN-185") } },
  "pathetique-3": { old: 10, level: 10, note: "No grade for the Rondo alone. Henle grades the whole sonata at 7 (HN 1348); RCM lists it complete at ARCT; ABRSM complete at ARSM (a diploma)." },
  "chopin-fantaisie-impromptu": { old: 11, level: 14, grade: { scale: "henle", value: 7, url: HN("de/Fantaisie-Impromptu-cis-moll-op.-post.-66/HN-1320") } },
  "debussy-arabesque-1": { old: 11, level: 8, grade: { scale: "henle", value: 4, url: HN("At-the-Piano-9-well-known-original-pieces/HN-1815") } },
  "rachmaninoff-prelude-cs": { old: 11, level: 10, grade: { scale: "henle", value: 5, url: HN("en/Prelude-c-sharp-minor-op.-3-no.-2/HN-1211") } },
  "entertainer": { old: 12, level: 8, grade: { scale: "henle", value: 4, url: HN("us/The-Entertainer/HN-1727") } },
  "maple-leaf-rag": { old: 14, level: 8, grade: { scale: "henle", value: 4, url: HN("en/Maple-Leaf-Rag/HN-1728") } },
  "chopin-op10-1": { old: 10, level: 10, note: "No grade read: the formula's level. Henle's Etudes (HN 124) grade the volume; no per-etude page was read in the ship window." },
  "flower-dance-demo": { old: 12, level: 12, note: "No published grade: a piano arrangement of DJ Okawari's instrumental, bars 13–24; the formula's level." },
  "chopin-ballade-coda": { old: 15, level: 15, note: "No grade read for the coda alone: the formula's level. Henle grades whole ballades; none read in the ship window." },
  "chopin-etude-10-5": { old: 15, level: 15, note: "No grade read: the formula's level. Henle's Etudes (HN 124) grade the volume; no per-etude page was read in the ship window." },
  "chopin-revolutionary": { old: 15, level: 15, grade: { scale: "henle", value: 8, url: HN("en/Etudes/HN-124") } },
  "moonlight-3": { old: 15, level: 15, note: "No grade for the Presto alone. Henle grades the whole sonata at 7 (HN 1062); RCM lists it complete at ARCT; ABRSM complete at ARSM (a diploma)." },
};

// The spec's mapping (decision level-review-mapping): Henle h -> min(15, 2h); RCM and ABRSM g -> 1 + g.
export const mappedLevel = (g: Grade) => (g.scale === "henle" ? Math.min(15, 2 * g.value) : 1 + g.value);
