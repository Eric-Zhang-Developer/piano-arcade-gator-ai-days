# main-page: the brief, before any code

eric-agent-5, 2026-10-25. The spec's plan step 1: today's `/` measured, how large-library selects are crossed, and the
directions taken and dropped. Notes only; no frames from other games are committed (decision 003).

## Today's `/` (origin/main 93319d4, 40 songs, the app named Étude)
Measured in the in-app browser on a dev server from this worktree, after load, Level sort:

| | 1280×720 | 1920×1080 |
|---|---|---|
| rows wholly in view (partly) | 7 (8) | 7 (8) |
| row height + gap | 72 + 10 px | 106 + 15 px |
| list height / scroll height | 584 / 3317 px: 5.7 screens | 883 / 4896 px: 5.5 screens |
| the band between the panel's foot and the footer | 61 px | 75 px |
| row text, smallest / largest | 12 / 24 px | 16 / 36 px |
| page scrolls | no | no |

- **Against the planner's bars:** 12 rows at 1920 and 8 at 1280 are both missed today; 7 rows show at either size,
  because each row grows with the viewport. Reaching a song low in the list takes scrolling through up to 5.5 screens.
- **Levels on main:** 1 (1 song), 2 (1), 3 (2), 4 (3), 5 (6), 6 (7), 7 (4), 8 (4), 9 (4), 10 (1), 11 (3), 12 (1), 14 (1), 15 (2).
- **Composers:** 18 surnames by song-finder's rule; Chopin has 8, Beethoven 6, eleven have one each.
- Shots: `specs/features/main-page/shots/before-1280.jpg`, `before-1920.jpg`.

## How large libraries are crossed (a research subagent's read of public sources, cited there)
- **osu!:** one carousel; groups (difficulty, artist's first letter, recently played) as expandable sections;
  Shift+←/→ jumps a group; F2 a random pick, Shift+F2 back. No position counter; a scrollbar only.
  <https://osu.ppy.sh/wiki/en/Client/Interface>, <https://osu.ppy.sh/wiki/en/Client/Keyboard_shortcuts>
- **Sound Voltex Exceed Gear:** a vertical list again; LEVEL and genre folders entered and left; holding FX-L while
  turning the knob "scrolls by category depending on sort" (LV06 → LV07 → LV08). <https://mobiuslau.github.io/sdvx/controls/>,
  <https://remywiki.com/AC_SDVX_EG>
- **maimai DX:** horizontal scrolling; group by genre, version, level or title, then sort inside; no filter. The suggested
  path to a song is group, sort, then scroll to the level's stretch.
  <https://silentblue.remywiki.com/index.php?title=maimai_DX%3A1st%2FChanges&mobileaction=toggle_view_desktop>
- **Chunithm (NEW to VERSE):** horizontal; Genre, Version and Name sorts, Level and Random tabs, folders that show
  rank badges once earned. <https://chunithm.org/basic/gamescreen/>. Our committed Chunithm notes cover charts and
  hands only, not the select.
- **Synthesia:** song groups with an average-progress number beside each; sort buttons that reverse on a second
  click; type-to-filter. <https://www.synthesiagame.com/support/guide/choosingSongs>
- **Unconfirmed:** how many songs any of them shows at once. None documents a "12 / 40" counter.

## Directions
**Taken:**
- **One flat list with section headers; no folders, nothing collapses.** Every folder-based select adds an enter and a
  leave per song; at 40 songs a header in a single list costs nothing.
- **The chips jump by the current sort,** SDVX's "fast scroll by category depending on sort", as a mouse control:
  one click on a chip, one on the song. No new shortcut (mouse-first); ↑/↓ cross headers as if they weren't there.
- **Each header carries its real count** (`LV 04–05 · 9`), after Synthesia's per-group number. Clears per section
  are dropped for now (smaller), since BEST is per song and per level already.
- **Fixed level bands** 01–03, 04–05, 06–07, 08–09, 10–15: 4, 9, 11, 8 and 8 songs today, none empty, none near half.
  Fixed rather than computed, so a chip keeps its meaning as packs land (`specs/decisions/main-page-bands.md`).
- **Denser rows, the roll kept.** visual-direction keeps a piano-roll thumbnail on each row. The row becomes one line
  (roll, title and composer, level), sized by viewport height rather than width, so 1920 shows more rows rather
  than bigger ones.
- **The dead band goes by stretching the panel's roll** to fill the column, so the focused song's own picture takes
  the space; the footer (Options, First time, Lab) stays together at the column's foot.
- **`12 / 40`** beside the finder's count, though no studied game has one: the spec asks for it, and at 40 songs a
  number says more than a scrollbar.

**Dropped:**
- Folders, collapsible groups and play-count-gated folders: an enter/leave per song, and nothing to gate at 40.
- Horizontal carousels (maimai, Chunithm): few songs at once; a mouse wants a column.
- Alphabet bands (maimai's A–D style): about 8 songs a band at 40, too few to be worth a chip; Composer's surnames say
  more.
- Random pick and reverse-on-second-click: not asked for; each is a small follow-up if Eric wants it.
- Sticky headers: the subagent's own suggestion, unsourced; the count already says where you are. Revisit in the
  look loop if a header scrolls out of a long section.

## Risks named now
- **Composer has 18 sections,** so its chip strip wraps to two lines at 1280 and pushes rows down in that sort. The
  bars are measured in Level, the default; Composer's numbers go in the done note as well.
- **duo-select and song-finder files** are eric-agent-1's for #1056 and #1060 (labels, the Find box). main-page builds
  on main for `SongRow` and select-layout, keeps out of their lines, and rebases once they land.
