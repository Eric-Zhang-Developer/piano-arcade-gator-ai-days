# The Composer's Hands: the rolls (spec step 1, Validation a)

eric-agent-5, 2026-10-25. A research subagent read each archive page. Every field below is quoted from the roll's own
page, or from the metadata `.txt` the archive keeps beside the MIDI, with its URL. A field the page doesn't give is
empty. Nothing was downloaded during the research. Sizes come from HEAD requests and archive.org's zip index.

## Usable rolls
| # | Piece | Roll page | Maker, number | Year / performer, as credited | Type | File (size) | Rights, as stated | Spool speed-up | Decision 003 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Prelude in C♯ minor, Op. 3 No. 2 | [IAMMP database, row "Ampico \| 57504 \| 1922 … Marshall Jose"](https://www.pianorollmusic.org/rolldatabase.php?sortby=composer&showpage=61); [metadata](https://archive.org/download/pianorollmusic.com-midifiles/midi-files_mjose.zip/PDfiles%2FPreludeInCSharpMinor_AMP57504_eRollMIDIWexp.mid.txt) | "/roll_manufacturer: Ampico", "/roll_number: 57504" | "/roll_date: 1922" / "/performer: Rachmaninoff, Sergei"; "/roll_authenticity: Original" | "/roll_type: Ampico" (reproducing) | "/File_Type: Emulated MIDI file", "Roll Emulation Type Used = Ampico": [`PreludeInCSharpMinor_AMP57504_eRollMIDIWexp.mid`](https://www.pianorollmusic.org/html/mjose/midifiles/PDfiles/PreludeInCSharpMinor_AMP57504_eRollMIDIWexp.mid) (16,936 bytes) | No license. The site's only note: "MIDI files available for direct public download are from piano roll music published in 1930 and earlier"; the file sits in `PDfiles`. Archive.org's rights field is empty. | | **Local:** rights unclear |
| 2 | Maple Leaf Rag | [IAMMP database, row "Connorized \| 10265"](https://www.pianorollmusic.org/rolldatabase.php?sortby=composer&showpage=46) (a row in a listing; the page number moves as the database grows) | "Connorized \| 10265" | "1916" (the © Date column) / "Joplin, Scott"; the filename says "Comp. & Pb. Scott Joplin" | | MIDI; raw or emulated not stated, and there's no `.txt` (404): [`Connorized 10265 1916 Maple Leaf Rag - Comp. & Pb. Scott Joplin.mid`](https://www.pianorollmusic.org/html/pbarcz/midifiles/PDfiles/Connorized%2010265%201916%20Maple%20Leaf%20Rag%20-%20Comp.%20&%20Pb.%20Scott%20Joplin.mid) (23,588 bytes) | No license; the same site note; in `PDfiles` | | **Local:** rights unclear |

## Cross-checks and rejects
- **Ampico 57504, a second scan** ([metadata](https://archive.org/download/pianorollmusic.com-midifiles/midi-files_doesigns.zip/NonPDfiles%2FAmpico-57504_PreludeInC%23Minor_eRollMIDIWexp.mid.txt)): "/performer: Rachmaninoff, Sergei", "/roll_date:" blank, "/File_Type: Emulated MIDI file" (13,998 bytes), in `NonPDfiles`. Use it only as a cross-check of row 1.
- **Ampico 57504A, Wayne Stahnke's transcription** ([page](https://www.mmdigest.com/gallery/technical/transcribing)): "precision transcription of Ampico roll 57504A", "played by Sergei Rachmaninoff", "1921 first issue". Only a zip with DOS tools (136 KB). No rights statement for the files.
- **The dates for 57504 disagree:** 1922 (row 1's metadata), 1921 (Stahnke), and recorded 1919 per an [MMD post](https://mmdigest.com/Archives/Digests/201005/2010.05.05.09.html). The slate shows only row 1's own value.
- **Maple Leaf Rag, Uni-Record 202705** ([metadata](https://archive.org/download/pianorollmusic.com-midifiles/midi-files_robertperry.zip/NonPDfiles%2FMapleLeafRag%281899%29_UniRecord-202705_ComposerScottJoplin.mid.txt)): "Played by the Composer (Scott Joplin)", but "/roll_authenticity:Recut - BluesTone 137282", "/roll_copyright: 1995, Rob DeLand", and "May NOT be EDITED or used for commercial purposes". Out: a recut, and a license that forbids editing.
- **The Entertainer:** no roll credited to Joplin's own playing in any archive searched. Every roll found is credited to another player or to no one.
- **Rejected for another or missing performer:** Terry Smythe's Duo-Art 5804 Op. 3 No. 2 (the database lists Gabrilowitsch); Smythe's Ampico 30011 and Duo-Art 3020 Maple Leaf Rags (no performer); the Op. 3 No. 2 rolls by Godowsky, Angell, Sturkow-Ryder, R. Hill and von Rössel; the Maple Leaf Rags by J. Lawrence Cook, John Gill, Playrite and Starr.

## Archives searched
- **Stanford SUPRA:** 456 Welte red rolls, CC BY-NC-SA 4.0. No Joplin, and Rachmaninoff only as the composer.
- **Pianolatron:** 650 rolls. No Joplin, and no roll played by Rachmaninoff.
- **SearchWorks:** blocked by a bot check, which the subagent didn't try to get past. Stanford's Ampico holdings outside SUPRA are unverified.
- **archive.org:** pianorollmusic.com's MIDI and CIS items, and Terry Smythe's archive ("should not be used for commercial purposes"). Two "Joplin piano roll" items are MP3 only.
- **IAMMP roll database:** 16,182 rolls. Rows 1 and 2 come from here.
- **Mechanical Music Digest:** Stahnke's transcription.
- **Pianola Institute, IMSLP:** no MIDI downloads for these rolls.

## So
Step 1 passes for two pieces. Row 1 (Rachmaninoff, Ampico, emulated) comes first: the spec prefers expression-emulated
reproducing rolls, and its metadata is the most complete. No roll has an open license, so nothing goes into
`web/public/rolls/` as a committed file and nothing goes into `CREDITS.md`. The rolls live in the self-ignored
`web/public/rolls/local/`, and the tests use synthetic rolls
(`specs/decisions/composers-hands-rolls-local.md`).
