# key-skin: where the highlight goes, and white for a press that hit no note

**Context:** the spec asks for a sheen on white keys, a thin top highlight on black keys, and a pressed key glowing
in its hand color or plain white. It doesn't say where on a black key the highlight sits, or how the white case
relates to core's existing `keyLitColor` (mint).

**Options and choices:**
- Highlight at the black key's top edge (under the hit line, hidden by its shadow in round 1), or along a **bevel at
  its near end**, where light catches a real black key. The bevel.
- A white only inside key-skin, or **`settings.keyLitColor` set to white**. The setting: juice's lane light reads it
  too, so a stray press shows white in both places. Mint was the right hand's color, so a stray press read as a
  right-hand hit.
- Pressed keys fill with their light as a solid color, then shade darker toward the near end: the exact hand color
  stays on the canvas and the key reads as pushed down.

**How to undo:** `keySkinSettings` in `web/src/game/key-skin/index.ts`; `keyLitColor` in `web/src/game/core/settings.ts`.
