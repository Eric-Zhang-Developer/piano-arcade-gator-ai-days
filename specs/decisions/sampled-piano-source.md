# sampled-piano: the sample source

**Context.** The spec names the Salamander Grand Piano (a Yamaha C5 recorded by Alexander Holm), "believed CC BY 3.0,
unconfirmed", and asks the worker to confirm the license from the source itself before committing any sample
(decision 003).

**What the sources say (checked 2026-10-25 by eric-agent-7).**
- github.com/sfzinstruments/SalamanderGrandPiano: the repository's readme gives the license as Creative Commons
  Attribution 3.0 and the author as Alexander Holm. It asks that a derived instrument say it derives from that
  repository. Its `Samples/` folder holds FLAC files named `<note>v<layer>.flac` (for example `A0v8.flac`).
- archive.org, item `SalamanderGrandPianoV3`: the same set, version 3, also marked Creative Commons Attribution 3.0.
- Version 3: one sample every minor third (A, C, D#, F# in each octave, A0 to C8) at 16 velocity layers.

**Choice.** The Salamander Grand Piano V3, from the sfzinstruments repository, under CC BY 3.0. The license holds,
so no `needs-human` issue and no other grand.

**Credit.** `CREDITS.md` gets one line in its own `docs:` PR (check_ownership lets only `feat(song-pack-<n>)`
append there): "Laptop piano voice: samples from the Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0,
derived from github.com/sfzinstruments/SalamanderGrandPiano (converted to MP3, a subset)." No sample merges
without it.

**How to undo.** Empty `web/public/samples/piano/manifest.json` to `[]` (the synth voice comes back), delete the
sample files, and drop the credit line.
