# Band player

Plays a band arrangement on the DGX-660's own GM voices, so Eric can hear an arrangement before the game plays it
(backing-track, `specs/features/backing-track/spec.md`). The MIDI reading and window scheduling are the game's own,
`web/src/game/backing-track/band.mjs`. This page is only the controls, `player.mjs`.

```bash
python3 -m http.server 8041 -d .
```
Run that from the worktree root, then open `http://localhost:8041/spikes/band-player/?file=local/<song>.mid` in Chrome.

- `?file=` is the `.mid` to play, relative to this page. Without it, pick a file.
- `?port=` matches a MIDI output by part of its name. The default is "Portable Grand", the DGX.
- `?mute=` lists the channels to leave out, 1–16, comma-separated. The default is `1`: channel 1 is the player's, as
  in the game. `?mute=` with nothing after it plays every channel.
- Play sends GM System On, the file's setup, a one-bar count-in (side stick, at the file's first tempo), then the
  file.
- Stop, Esc and leaving the page send pedal up and All Notes Off on all 16 channels.

## The arrangement format
A Standard MIDI File, format 0 or 1, with the tempo map on any track.
- Each part has its own channel and a GM program change at time 0.
- Drums are on channel 10.
- A piano part, if there is one, goes on channel 1. That's the player's channel, so the game never plays it, and the
  page mutes it by default.
- Time 0 is the chart's beat 0 of bar 1. There is no lead-in bar.

## Local arrangements
Copy them into `local/`, which ignores everything in it (decision 003). Nothing copyrighted is committed.
