# composers-hands: the rolls stay local

- **Context:** neither usable roll (`spikes/composers-hands/sources.md`) states an open license. pianorollmusic.com
  files them under `PDfiles`, beside a note that its public downloads are of rolls "published in 1930 and earlier".
  That is the site's own public-domain judgment, not a grant.
- **Options:**
  - (a) Commit them as public domain: the rolls date from 1916–1922, but whether the scan or the emulation adds rights
    is a legal question this spike can't settle.
  - (b) Keep them local in `web/public/rolls/local/` (self-ignored), as decision 003 says for unclear rights.
- **Choice:** (b), the smaller and reversible option. The spec says the same: "an unclear or all-rights-reserved
  license stays local". Tests and `/sim` use synthetic rolls; only Eric's machine plays the real ones.
- **How to undo:** if Eric rules the `PDfiles` rolls public domain, move them to `web/public/rolls/<song id>/` and
  credit them in `CREDITS.md` through a `docs:` PR.
