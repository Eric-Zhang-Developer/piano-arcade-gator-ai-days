# Cabinet: how the demo starts, and what the echo guard covers

**Context:** the spec's demo URL is `/play?song=<demoSong>&bot=perfect&audible=1`, but `/play` waits on its Start button
unless `?input=test`, so that URL alone sits on the start screen. The spec guards echoes during the demo only, yet
attract (operator-replay) plays Twinkle on the piano too: in the headless check, a stand-in piano's echo of an attract
note started a game.
**Options:** A, the cabinet page clicks Start inside the iframe. B, add `cabinet=demo` so the cabinet plugin starts the
take from inside `/play` (as the sim plugin does) and reports its results to the page. For echoes: guard the demo only,
or guard both iframes by wrapping each frame's `MIDIOutput.prototype.send`.
**Choice:** B, and guard both. The demo URL is the spec's plus `&cabinet=demo`. The page records every note-on either
iframe sends, at its timestamp in the page's clock, and drops a same-pitch note-on within 50 ms of one.
**How to undo:** drop `&cabinet=demo` from `demoUrl` in `web/src/game/cabinet/loop.ts` (the demo then waits on Start);
call `watchSends` only when the phase is `demo` in `web/src/app/cabinet/page.tsx`.
