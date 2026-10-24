---
name: "Song pack 2: Gymnopédie, Clair de lune, Nocturne Op. 9 No. 2, Maple Leaf Rag and Moonlight's 3rd movement"
depends_on: ["song-pack-1"]
owns: ["web/public/songs/gymnopedie-1/", "web/public/songs/clair-de-lune/", "web/public/songs/nocturne-op9-2/", "web/public/songs/maple-leaf-rag/", "web/public/songs/moonlight-3/"]
assignee: "eric"
---

# Song pack 2

Five songs for the medium to expert rungs, which bring the library to ten. Every rule in `song-pack-1`'s
Requirements applies here unchanged (sources, what to chart, range, tempo): read it first. Use its converter
(`game-tools/midi-to-chart/`) and rely on its library test; if either needs a change, that's a
`fix(song-pack-1)` PR, not this one.

| id | Piece | Rung | Watch for |
|---|---|---|---|
| `gymnopedie-1` | Satie, Gymnopédie No. 1 | Medium | Slow; the left hand leaps between bass notes and chords. |
| `clair-de-lune` | Debussy, "Clair de lune", from *Suite bergamasque* | Medium-hard | Triplets and ties; check the meter in the score. |
| `nocturne-op9-2` | Chopin, Nocturne in E-flat major, Op. 9 No. 2 | Hard | Ornaments and small-note runs: main notes only, and say which runs were left out. |
| `maple-leaf-rag` | Joplin, "Maple Leaf Rag" | Hard | Syncopation and right-hand chords. |
| `moonlight-3` | Beethoven, Piano Sonata No. 14, Op. 27 No. 2, 3rd movement | Expert | Fast arpeggios across a wide range: the library's hardest song, and the widest highway. |

## Plan
1. One commit per song, easiest first, each from its own cited source. A song with no allowed source gets a
   `needs-human` issue and is skipped; the others still ship.
2. Credits for these sources go in `CREDITS.md` through a separate `docs:` PR.

## Requirements
- Everything in `song-pack-1`'s **Sources** and **What to chart**: both hands, as printed.
- **Tempo:** Hard and Expert songs near the score's marking or a little under. Moonlight's 3rd movement may start
  well under it so it's playable at all; say how far under in the done note.
- **Excerpt length:** 30 to 90 seconds at the chart's `bpm`, as in pack 1. For Moonlight, the opening up to the
  first change of material.
- No game code changes.

## Validation
- `pnpm -C web test`: `song-pack-1`'s library test passes with all ten charts.
- In Chrome: `/play?song=<id>` for each of the five -> it loads and plays. With `?input=test`, the Perfect player
  finishes all PERFECT.
- On the piano (Eric; mark it in the done note): play each once with both hands -> it's the piece you know, the
  lanes are readable, and the order Medium to Expert feels right. Say which `bpm` needs tuning.

## Defaults
- Prefer the smaller option: a shorter excerpt over a longer one.
- If a piece's opening is too sparse to be fun (Gymnopédie) or too hard to read on the highway (Moonlight), pick the
  next section that works and say why in the done note.
