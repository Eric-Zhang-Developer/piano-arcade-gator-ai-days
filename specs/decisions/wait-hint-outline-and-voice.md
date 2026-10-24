# wait-hint: the name's outline, what restarts the wait, and the voice before MIDI answers

**Context.** The spec places the name 500 ms of highway above the line, so it may lie over a note due later. At
1920×1080 on Twinkle, "C4" in ink sat over the next mint C4 pill and barely read. It also doesn't say whether pressing
one key of a chord restarts the 3 s wait, or which voice plays if the hint comes before `requestMIDIAccess` answers.

**Choices.**
- The name gets a black (`--pa-bg`) outline, 0.16 × its size, so it reads over any pill.
- The wait is keyed on the held chart time: pressing one key of a chord keeps the hint on the others; the next note
  starts over.
- The laptop tone is the voice from songStart until MIDI answers with the DGX, which then replaces it.

**How to undo.** Drop the `strokeText` in `drawHint`; key `hintTimer` on the waiting ids; start with no voice.
