## What shipped
Five Medium to Medium-hard songs, charted from Mutopia (all Public Domain) with the pack-1 converter. There are no game code changes. Every source, license, tempo and hand rule is in `specs/decisions/song-pack-7-sources.md`.

| Song | Excerpt | Printed tempo · MIDI · bpm | Notes (R+L) | Range | Level |
|---|---|---|---|---|---|
| `chopin-prelude-20` | the whole prelude, bars 1–13 | Largo · 42 · 42 | 286 (186+100) | C1–E♭5 | 6 |
| `raindrop-prelude` | bars 1–27, the D♭ section | Sostenuto · 80 · 80 | 389 (104+285) | F2–G♭5 | 6 |
| `pathetique-2` | bars 1–16, the theme twice | Adagio cantabile · 36 · 36 | 263 (172+91) | A♭1–B♭5 | 7 |
| `moment-musical-3` | bars 1–34, to the second double bar | Allegro moderato · 80 · 80 | 438 (206+232) | C2–B♭5 | 9 |
| `debussy-arabesque-1` | bars 1–38, the E major section | Andantino con moto · 144 · 120 | 515 (219+296) | E1–F♯6 | 11 |

- **Levels:** the library's Medium songs sit at 5–7 (moonlight-1 5, fur-elise 7); its Medium-hard ones at 8–12 (mountain-king 8, entertainer 12). The prelude, the Raindrop and the Pathétique land with the Medium songs, the Arabesque with the Medium-hard. The Moment musical (9), meant as Medium, lands with the Medium-hard.
- **Tempo:** no source prints a metronome number. Four charts use the MIDI's own tempo; the Arabesque is under it, as the pack's Medium-hard. Eric tunes each `bpm` on the piano.
- **Note check:** each chart was diffed against its LilyPond score note by note, with a LilyPond engraver listing every struck head:
  - two match exactly;
  - the Raindrop differs only by its two 7-note fioriture, charted as their main note;
  - the Pathétique misses three 32nds that fall off the converter's 1/12-beat grid, and sounds a two-voice unison once;
  - the Arabesque keeps 8 both-hand unisons once.
- **Hands:** the Raindrop and the Arabesque cross staves. They're charted from a LilyPond export with the staff changes off, so the left hand's notes stay the left hand's.
## Where it lives
`web/public/songs/{chopin-prelude-20,raindrop-prelude,pathetique-2,moment-musical-3,debussy-arabesque-1}/chart.json`, `specs/decisions/song-pack-7-sources.md`
## How to check it
`pnpm -C web exec vitest run src/game/songs src/game/sheet-xml src/game/sheet-beams src/game/difficulty`: 235 pass. verify.py: not verified locally; covered by main's scheduled full run (`/play?song=<id>` and the Perfect player).
## Gaps
- Eric's piano pass hasn't happened: is each the piece he knows, with readable lanes, and which `bpm` needs tuning?
- The Pathétique's three 32nds need a 1/24-beat grid in the converter, a `fix(song-pack-1)`.
- No screenshot of the widest chart (the Arabesque, 63 keys) yet: no dev-server slot was free in the app.
