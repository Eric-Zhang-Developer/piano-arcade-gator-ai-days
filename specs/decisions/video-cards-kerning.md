# video-cards: the title's size, kerning and alignment

Context: the spec sets Étude at 40vh on the game's hit line and leaves the kerning to the look loop. Values are in
`.title` and `.title + .tagline` (`web/src/game/video-shots/cards.module.css`).

| Choice | Taken | Why, and the alternative |
|---|---|---|
| Size and tracking | Saira 800 at 40vh, letter-spacing −0.035em, baseline 0.06em under the hit line | Display tracking at film-title size; the letters sit on the line as notes sit on it in the game. |
| É–t | −0.02em | The T's left arm leaves a hole at this size; −0.02em closes it without touching the É's foot. |
| t–u | −0.015em (round 1; was 0) | A judgment from the round-1 shot: at 40vh the t–u gap read wider than u–d and d–e. |
| Tagline alignment | `calc(8.6vw + 2.2vh)`: flush with the É's stem ink, not its box (round 1; was 17.6vw, aligned to nothing) | The É's left side bearing is 0.0605em (measured with canvas `measureText`), 2.42vh at 40vh, less the tagline's own 0.25vh. |
| Hit line | Drawn in on the first note, full width; each letter flashes it under itself as a hit does (round 1) | The title had lost the line when it moved out of `Cards.tsx`, so the letters landed on nothing. |
