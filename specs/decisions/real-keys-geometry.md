# real-keys: the overlay's geometry, chosen

**Context:** `specs/features/real-keys/spec.md` fixes the homography (DLT, 4 corners) and the black keys' width (core's
`BLACK_KEY_WIDTH`, 0.6 of a white key). The rest of the overlay's geometry it leaves open. Nothing here is measured
against the DGX yet: no camera run has happened (see `spikes/real-keys/FINDINGS.md`).

| choice | options | taken | how to undo |
|---|---|---|---|
| Black keys' length on the bed | Measure them on Eric's still, or guess. | 0.62 of the bed's depth (`keySettings.blackKeyLength`), a guess until the still exists. | Change it in `keys.ts`; `score.mjs edges` shows the effect. |
| How far the lanes run past the back edge | To the map's horizon, or stop short. | 2.5 bed depths, but never past 70% of the way to the horizon (`laneDepth`), where the picture flips. | `overlaySettings.maxDepth` / `horizonShare`. |
| Back-to-back notes on one key | Draw each note's full length, or leave a gap. | Each note's tail is drawn 90 ms short (`overlaySettings.gapMs`), at least a quarter beat long. Without the gap, Twinkle's repeated notes merged into one ribbon in the look loop. The head still lands on time. | Set `gapMs` to 0. |
| The picture beside the setup rail | Full bleed under the rail, or beside it. | Beside it while the rail shows. Under it, the rail hid the key bed's left third. Capture mode hides the rail and goes full bleed. | Drop the `.page:has(.rail) .stage` rule. |
| The nav bar on `/real-keys` | Show the site's links, or hide them as `/stage` does. | Hidden (`nav-bar/slots.ts` `HIDDEN_ON`): they covered the top of the picture and the HUD. | Remove `/real-keys` from `HIDDEN_ON`. |
| The Lab entry's href | `/real-keys?song=twinkle`, or with the flag too. | `/real-keys?song=twinkle&x=real-keys`: the experiments frame's test wants every entry's flag in its URL. | Edit `index.ts` and the frame test together. |
