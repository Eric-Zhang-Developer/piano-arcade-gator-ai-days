# inside: the action's proportions

**Context.** The spec asks for proportions from a source that can be read here, labeled on the page, and every
number no source gives logged as a choice. A research pass looked for patents, regulation specs and open technical
pages. The numbers below were then re-read on the pages themselves (2026-10-25).

**Sourced, re-read on the page:**
- **Blow distance 47 mm and let-off 2 mm.** Askenfelt & Jansson, *From touch to string vibration: Timing in the
  action*, KTH (speech.kth.se/music/5_lectures/askenflt/timing.html), which gives "typical value 45 – 47 mm" for the
  blow and let-off "typically set between 1 and 3 mm".
- **Backcheck 12 mm from the string.** Kawai US 5,159,762, *Regulating rule for grand pianos* (1992). The rule is
  graduated "10-15 mm indicating the position of hammer back stop", so 12 mm is inside that range.
- **The damper starts at half the stroke.** The same patent describes the conventional regulation: the damper starts
  leaving the wires "when a hammer has moved by 1/2 of the above-mentioned quantity of hammer stroke". The model
  lifts it from half the key's dip, since the hammer follows the key linearly up to let-off.
- **Key dip 9.9 mm and key pitch 23.41 mm (1194/51).** Voit US 8,865,989 (2014), both from its worked examples.

**Choices (illustrative):**
- The key's length (520 mm) and balance point (240 mm), the capstan, wippen, jack and repetition lever positions,
  the shank (130 mm, knuckle 18 mm behind the pivot), the head (46 × 22 mm), the damper lift (8 mm), and the string
  span drawn in the cutaway.
- The parts' layout follows the usual labelled parts of a grand repetition action (Sohmer US 1,097,696, Figs. 1–2,
  name the same parts), but no dimension is taken from it.
- In the row view, the hammers are evenly spread over the keys' span.
- The string length by key is `1980 × 0.5^(k/16)` mm, an illustrative scale. No readable source gave a full 88-note
  scale; a Steinway D's longest string, about 201 cm, is quoted only second-hand, so it isn't used.
- Dampers are drawn on all 88 keys. Real grands leave the top notes undamped; how many isn't sourced here, so that
  isn't modeled.

**The page's label:** "Blow and let-off after Askenfelt & Jansson (KTH); key dip, backcheck and damper after two
expired patents; the rest illustrative.", linked to the KTH page.

**How to undo:** change `geometry.ts`'s `G` and `SOURCE`. The tests read `actionSettings`, which derives let-off and
check from `G`.
