## What shipped
Five songs from Mutopia notation MIDI, checked against the scans, bringing the library to ten: `gymnopedie-1` (bars 22–31, 56 BPM, 68 notes, A1–A5), `clair-de-lune` (bars 1–8, 60 BPM, 79, G#2–G#5), `nocturne-op9-2` (pickup + 1–8, 60 BPM, 267, A#1–D6), `maple-leaf-rag` (A strain twice, 100 BPM, 552, G#1–G#6), `moonlight-3` (bars 1–8, 147 BPM measured from a recording since #821 (was 60), 206, A1–C#6). Note counts from the scans equal the charts' (R + L: 22+46, 55+24, 77+190, 234+318, 139+67).

## Where it lives
`web/public/songs/{gymnopedie-1,clair-de-lune,nocturne-op9-2,maple-leaf-rag,moonlight-3}/chart.json`, `specs/decisions/song-pack-2-excerpts.md`, `specs/features/song-pack-2/maple-leaf-rag-highway.png` (widest chart)

## How to check it
verify: `pnpm -C /Users/ericzhang/.worktrees/gator-ai-days-2026/song-pack-2/web verify ...` pass at 5076e5f; library test 11/11 with all ten charts; headless Perfect player 100% PERFECT on all five

## Gaps
- Validation step skipped: Eric on the piano (it's the piece, lanes readable, Medium to Expert order right, which `bpm` needs tuning). Moonlight now runs at 147 BPM, measured from Paul Pitman's Musopen recording (decision `song-pack-2-moonlight-tempo`).
- Left out: Nocturne's turns (bars 2, 5) and bar-7 trill play as main notes; its three grace notes are skipped. Gymnopédie starts at bar 22, not the opening (decision file).
- Maple Leaf Rag, not Moonlight, has the widest highway (5 octaves). Nocturne (CC BY-SA 3.0) and Moonlight (CC BY-SA 2.5) need credits: the `docs:` PR for `CREDITS.md` follows.
