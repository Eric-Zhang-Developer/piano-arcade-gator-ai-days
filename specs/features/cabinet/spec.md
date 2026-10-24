---
name: "Cabinet: a kiosk loop with a title screen, attract mode and a demo game"
depends_on: ["operator-replay", "scenes"]
owns: ["web/src/app/cabinet/", "web/src/game/cabinet/"]
assignee: "eric"
---

# Cabinet

Made for the booth. `/cabinet` shows a title screen reading PRESS ANY KEY. Left idle, it moves to attract mode
(`/attract`, from operator-replay), then a bot plays a demo song on the piano, then it's back to the title. Any piano
key starts a game. It runs the way an arcade cabinet does: unattended, and inviting.

## Plan
1. The loop's pure state machine in `web/src/game/cabinet/`, and the page in `web/src/app/cabinet/`.
2. A small plugin in `layers.ts` that returns a finished game to `/cabinet` (Requirements).

## Requirements
- **The title screen:** the game's name and PRESS ANY KEY. A laptop key opens `/` (song select). A piano key (any
  MIDI note-on) opens `/play?song=<cabinetSettings.song>&cabinet=1`, Twinkle by default.
- **The loop:** after `titleSeconds` (30) idle on the title, `/attract` shows in a full-screen iframe for
  `attractSeconds` (60). Then the demo shows in one: `/play?song=<demoSong>&bot=perfect&audible=1`. It lasts until
  its results have shown for 10 s, or the chart's length plus 15 s, whichever comes first. Then back to the title.
- **Keys during the loop:** any key during attract or the demo acts as on the title. The iframes get
  `tabIndex={-1}`, `pointer-events: none` and `allow="midi"`, and the top page keeps keyboard focus and listens to
  MIDI itself.
- **Echo guard:** if the piano echoes the demo's notes back, a note-on is ignored during the demo when the demo sent
  the same pitch within the last 50 ms. Eric checks whether the DGX echoes at all.
- **After a game:** with `?cabinet=1`, the plugin waits on `songEnd` and returns to `/cabinet` after 30 s on the
  results screen with no input. Without the param it does nothing.
- **Full screen:** a "Start kiosk" button on the title requests full screen, which needs a gesture.
- **No new sounds.** The demo's piano comes from scenes' `audible` bot.
- **Look:** keep to the current look, and to `specs/context/visual-direction.md` once that file exists.

## Validation
- `pnpm -C web test`: the state machine goes title, then attract after 30 s idle, then demo, then title. A laptop key
  exits to `/` and a piano key to the play URL. The demo times out at the chart's length plus 15 s. The echo guard
  drops a same-pitch note-on at +30 ms but not at +80 ms.
- `verify.py --slug cabinet` passes, with `/play` unchanged without `cabinet`.
- In Chrome, with timers shortened by `?title=3&attract=5`:
  1. Open `/cabinet` and wait -> the title, then attract, then the demo playing Twinkle, then the title again.
  2. Press a key during attract -> song select.
- On the piano (Eric; mark it in the done note): leave the cabinet running on the DGX. The demo plays on the piano,
  and pressing a key starts a game.

## Defaults
- The demo song is Twinkle until Eric picks another in `cabinetSettings`.
