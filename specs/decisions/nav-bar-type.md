# nav-bar: Saira condensed labels, not MonoLabel

**Context.** The spec asks for the kit's `MonoLabel` and "Saira condensed for labels". On `/` the bar sits right above
the select's key hints, which are MonoLabel-style mono caps in the same grey: the two rows read as one block, and the
nav didn't read as navigation (design round 2). MonoLabel's inline color also caused the link-blue bug.

**Options.** A: MonoLabel, larger. B: Saira condensed 600, sentence case, colored in the module CSS.

**Choice.** B. It's the song titles' face, it sets the pages apart from the key hints, and hover and current can
change the color without `!important`.

**How to undo.** Swap `.label` spans back to `<MonoLabel>` in `NavLinks.tsx`.
