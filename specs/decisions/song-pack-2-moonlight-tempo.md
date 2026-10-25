# song-pack-2: Moonlight's Presto at 147 BPM, measured from a recording; difficulty weights retuned

**Context.** `moonlight-3` was charted at 60 BPM, about 38% of a usual tempo (song-pack-2's done note). Eric,
2026-10-25 (#821): "Why is the Moonlight Sonata third movement not using the actual real tempo? ... [Moonlight] Sonata
is clearly much harder than, let's say, Flower Dance". Beethoven gave no metronome mark. The chart's own source, the
Berners edition (1908, ed. Winterberger) via Mutopia 276, prints "Presto agitato" with no number; its LilyPond file
only has a commented-out MIDI `\tempo 4 = 160`, the typesetter's choice, not the edition's. Czerny's and Moscheles's
marks exist (Noorduin, *Nineteenth-Century Music Review*, 2018, doi:10.1017/S1479409817000027) but I couldn't read a
primary copy, and a number from a forum post isn't a citation.

**Source.** A measured recording: Paul Pitman for Musopen, "Moonlight Sonata Presto.ogg", public domain, Wikimedia
Commons (https://commons.wikimedia.org/wiki/File:Moonlight_Sonata_Presto.ogg), 8:13.7.

**Method.** The chart covers bars 1–8. Its sforzando chords fall on beats 7, 15, 23, 27 and 31. In the recording's
loudness envelope (5 ms frames, ffmpeg-decoded mono), the first note and those five chords start at 2.540, 5.445,
8.725, 11.925, 13.545 and 15.185 s. A least-squares line through (beat, time) gives 0.4069 s a quarter note:
**147.4 BPM** (residuals −35 to +46 ms; between chords 144.6–150.0 BPM). Charted as 147.

**Levels.** At 147 BPM the old weights put Moonlight at 15, but tied with Flower Dance (local), Golden Hard (local) and
Flower Dance var2 (local): the leap term (0.7 × 43 semitones ≈ 30 points) outweighed speed (1 point per note a
second). Weights were searched on a grid against a human ordering: the rungs the song-pack-1/2/3 specs name (Easy 1 …
Expert 6, Twinkle lowest) plus Eric's "Moonlight 3 far harder than Flower Dance" (at least 2 levels). Kept: the
difficulty test's rungs, Twinkle lowest. Chosen: nps 1, chords 0.5, leap 0.2, range 0, both hands 1; offset −2.9,
scale 0.64 (Twinkle at 1, Moonlight's Presto at 15). Against the 147 cross-tier pairs: before 117 agree, 18 disagree,
12 tied; after 123 agree, 17 disagree, 7 tied. Most of what still disagrees is Clair de lune's easy 79-note excerpt
(already a known exception in the difficulty test) and Minute Waltz (spec: Expert; formula 8).

| Song | Before (60 BPM, old weights) | After (147 BPM, new weights) |
|---|---|---|
| twinkle | 1 | 1 |
| minuet-g | 3 | 2 |
| clair-de-lune | 4 | 3 |
| ode-to-joy | 4 | 3 |
| bach-prelude-c | 6 | 4 |
| clementi-sonatina-36-1 | 6 | 4 |
| moonlight-1 | 6 | 5 |
| chopin-prelude-4 | 6 | 5 |
| burgmuller-arabesque | 6 | 5 |
| gnossienne-1 | 8 | 5 |
| mozart-545-1 | 7 | 6 |
| gymnopedie-1 | 10 | 6 |
| fur-elise | 11 | 7 |
| mountain-king | 12 | 8 |
| minute-waltz | 10 | 8 |
| alla-turca | 9 | 9 |
| nocturne-op9-2 | 13 | 9 |
| entertainer | 13 | 12 |
| maple-leaf-rag | 13 | 14 |
| **moonlight-3** | **14** | **15** |
| *flower-dance (local)* | *15* | *13* |
| *flower-dance-var1 (local)* | *11* | *8* |
| *flower-dance-var2 (local, 115%)* | *15* | *15* |
| *golden-easy / medium / hard (local)* | *9 / 10 / 15* | *5 / 7 / 15* |

**Options.** A: an edition's or Czerny's mark (not readable here). B: a measured recording (taken). C: keep 60 and
let players use Speed (rejected: Eric asked for the real tempo; Speed 50%/70% still slows it).

**How to undo.** `bpm` back to 60.0 in `web/public/songs/moonlight-3/chart.json`; the weights back to nps 1, chords 1,
leap 0.7, range 0.05, both hands 2, offset −6, scale 0.4; `Lv 15` back to `Lv 14` in the warning test and
verify-warning.
