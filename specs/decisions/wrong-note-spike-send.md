# wrong-note-spike: the phrase goes to the piano 60 ms ahead, not queued whole

**Context.** The spec says the phrase plays "with `MIDIOutput.send(data, timestamp)`" and that All Notes Off
(`allNotesOff`) stops it on Again, on each new round and on `pagehide`. On the DGX that isn't enough: a timestamped
note-on still fires after an All Notes Off sent now, and Chrome has no `MIDIOutput.clear()`. song-preview had exactly
this bug (#822: previews "all mash together"). Here, answering mid-phrase would let the phrase play on under the
reveal.

**Options.** A: queue the whole phrase, as the spec reads (the bug). B: send each message untimed from a timer
(loses timestamp precision). C: a timer hands the output only the messages due within 60 ms, still timestamped; stop
lifts every pressed key after its note-on, then sends `allNotesOff`.

**Choice.** C, as `sendAhead` in `web/src/game/wrong-note/`. It still uses `send(data, timestamp)` and `allNotesOff`, as
the spec asks. The unit test plays it against a stand-in piano that honors timestamps.

**How to undo.** In the page, send `roundMessages(...)` straight to `out.send(m.bytes, m.atMs)` and drop `sendAhead`.
