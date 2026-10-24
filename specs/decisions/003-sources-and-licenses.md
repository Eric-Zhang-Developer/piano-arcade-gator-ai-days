# 003: Sources and licenses, loose on purpose

- Date: 2026-10-24   Decided by: Eric   Feature: project-wide
- **Context:** Specs said "public domain only" in five places (`mission.md`, `core-loop`, `juice-sound`,
  `twinkle-13`, `chart-compiler`). For a weekend hackathon project that's far stricter than needed. It pushed the
  twinkle-13 spike toward re-encoding a free, proofread score (TAVERN, CC BY-SA 4.0), and it makes agents stop and
  file issues over material Eric is happy to use. It was also already inconsistent: core-loop's chart cites CC BY-SA
  text (`core-loop-chart-source.md`).
- **Options:** A: public domain only (the old rule). B: openly licensed sources in the repo, anything local and
  uncommitted, and the video at Eric's risk. C: no rule.
- **Choice:** B. It keeps the one rule that protects accuracy, and drops the ones that only cost time. Eric takes the
  copyright risk personally.

## The rule

| Material | Committed to the repo | Local only (gitignored) |
|---|---|---|
| Public domain, CC0, our own work | Yes | Yes |
| CC BY, CC BY-SA, other open licenses | Yes, credited in `CREDITS.md` | Yes |
| All rights reserved: recent songs, rips, commercial sheet music, recordings | No | Yes, credited "© owner, all rights reserved, local use only" next to the file |

- **Notes come from a cited source or from Eric, never from an agent's memory.** This is the never-invent-data rule,
  not a copyright rule, and it applies everywhere, local files included.
- **Local material** lives in `web/public/songs-local/` (charts) or another folder whose own `.gitignore` ignores
  everything but itself (`*` then `!.gitignore`). The first PR that needs the folder adds that file. Agents may use,
  rip and chart anything there. They never move it into a tracked path or commit it.
- **What that costs:** only Eric's machine has local songs. Other worktrees, CI, the teammate's checkout and a fresh
  clone don't. Tests and any demo run from a fresh clone use committed songs.
- **Share-alike is fine.** CC BY-SA files keep that license; the code's license stays separate. The repo is going
  open source anyway.
- **`CREDITS.md`** at the repo root lists every committed third-party file with its source and license. The first PR
  that commits credited material creates it (TAVERN, from `twinkle-13`, is the first).
- **The video may include copyrighted songs as new performances on the DGX** (arrangements, remixes, rips played by
  the piano). Eric accepts the risk of a YouTube claim. Don't cut a song from the video to "fix" this. Two
  safeguards, both cheap: never put an original recording's audio in the video, and keep a clean fallback cut made
  only of committed material.
- **Playing anything live** at the in-person demo is Eric's call.

- **How to undo:** revert this decision's PR. The specs then say "public domain only" again.
