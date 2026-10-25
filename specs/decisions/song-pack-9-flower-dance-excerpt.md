# song-pack-9: the Flower Dance demo excerpt is committed, overriding 003 for it alone

- Date: 2026-10-25   Decided by: Eric   Feature: song-pack-9
- **Context:** Decision 003 keeps all-rights-reserved material local: agents never move it into a tracked path. The
  Flower Dance demo cut (bars 13–24 of the Pianubi arrangement, modified by Syle, charted from Eric's MIDI) lived in
  the gitignored `web/public/songs/local/flower-dance-demo/`, so only Eric's machine could play it. The demo and the
  live site need it.
- **Eric's words (in eric-agent-8's chat, 2026-10-25):** "I approve publishing the Flower Dance excerpt, bars 13–24
  only, from web/public/songs/local/flower-dance-demo/ into web/public/songs/flower-dance-demo/, credited, as
  fix(song-pack-9), merge on green. Not the full piece, scans, MIDI or MP3. I own the rights"
- **Options:**
  - A: keep it local (003 as written).
  - B: commit the 12-bar excerpt alone, credited.
  - C: commit the whole piece.
- **Choice:** B. Only `chart.json`, `pedal.json` and `CREDIT.txt` for bars 13–24 are committed.
  - The chart's id is `flower-dance-demo`, and its "local use only" source line is reworded to cite this decision.
  - `CREDITS.md` lists it.
  - The full chart, the scans, the MIDI and the MP3 stay local.
- **Scope:** 003 is unchanged for everything else. This overrides it for this one excerpt only.
- **How to undo:** `git rm -r web/public/songs/flower-dance-demo/` and drop its `CREDITS.md` line and its
  `difficulty/reviewed.ts` row. Git history keeps the files; scrubbing history would be a force push, which is Eric's
  call.
