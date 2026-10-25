# harmony-map: drawing a constellation

Context: the spec asks the worker to log the patch, the wrap, the home rule and the sizing scales
(`web/src/game/x/harmony-map/constellation.ts`).

| Choice | Taken | Why, and the alternative | How to undo |
|---|---|---|---|
| Time | A strike's triad holds until the next strike; a strike with no triangle adds no time | The simplest rule that sums to the song's length over its triads. | `stats()` |
| Home | The triad with the most beats; a tie goes to the final chord's | The spec offers either; most-played is what "home" looks like on the drawing, and the final chord breaks ties. | `stats()` |
| Placement | Home at the copy nearest the origin; each new triad at the copy nearest the previous step | Keeps the path joined, so P, L and R moves are shared edges. | `place()` |
| Wrap | A new triad landing more than 3.2 units from home goes to the copy nearest home instead, its edge dashed | The torus is real (the lattice repeats every (0, 3) and (4, −1)); a song that walks round the circle of fifths would otherwise drift off the patch. | `constellationSettings.maxReach` |
| Patch | The path's triangles plus 0.9 units; a song with no full triad, its sounding pitch classes' nodes nearest the middle | Sized to the path, as the spec asks; a melody still shows what it touches. | `constellationSettings.margin` |
| Sizing | Fill alpha 0.18 + 0.72·√(share of the longest); edge width (1 + 1.6·log2 traversals); 44 px per unit on the atlas, 88 on /harmony; SVG sized in em so it grows with the page's type | Square-root and log keep one dominant chord from washing out the rest. One unit for every song keeps the atlas at one scale. | `constellationSettings` |
| Colours | Major in the kit's blue, minor in its purple, home in gold | The two hand colours already mean "two kinds"; gold is the one warm colour, so home is found first. | `look.ts` |
