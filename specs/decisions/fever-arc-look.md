# fever-arc: fever's look (#1374)

**Context.** fever-arc was a timing pass; nothing designed what fever looks like once the sun and grid were retired.
Eric: fever "still looks very provisional" next to hit-particles. References: `fever-arc-look-research.md`.

**Choice.** One layer in `fever-arc/look.ts`, drawn by fever-arc's own plugin (already mounted under the wisps, HUD and
banner, so no mount change), amber only, nothing filled over the notes:
- flame walls: five additive tongues per edge standing on the hit line, a light pool at their foot, swelling on the beat;
- the hit line runs hot and breathes on the beat, with a faint heat haze over the field's last stretch;
- embers rise from the line (a few in the build-up's last stretch, a burst on the ignition beat);
- the ignition beat sends one shock front up the field; the FEVER banner's ghost swells out of it (fever-moment);
- the stage's star streaks rise with the fire instead of hanging still (stage/scene.ts);
- a break collapses the walls with the arc's heat; reduced motion keeps still walls and cuts.
The sweep sound now starts on the ignition beat (`sound/index.ts`, free since #600 closed).

**Still open.** juice's steady edges light on `feverStart` (#761 holds `juice/`); the near-line note glow keeps its
color (#1122 holds `core/highway.ts`). The walls cover the outermost lanes' near-line area: amber at moderate alpha
over notes, never a fill.

**Undo.** Drop the `look.draw` line in `fever-arc/index.ts`; the stage rise is `riseSpeed: 0`.
