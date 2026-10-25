// Key and meter read from each library chart's cited source, where they disagree with the estimate (key.ts) or the
// meter rule (index.ts). Read from the source files on 2026-10-24; every other chart's source agrees with the
// estimate and the rule (the done note lists them all). An entry's meter must equal the chart's beatsPerBar.
// `pickup`: the source opens with `\partial` (sheet-pickups), read 2026-10-24; its length comes from the notes.
import type { Mode } from "./key";

export interface Override {
  fifths?: number;
  mode?: Mode;
  beats?: number;
  beatType?: number;
  pickup?: true;
}

export const overrides: Record<string, Override> = {
  // Mutopia 921, Chop-28-4a-lys.zip, chp-28-04-a4.ly lines 50–51: `\key e \minor` and `\time 2/2`. The estimate gave
  // A minor, and the rule 4/4 from beatsPerBar 4. Line 52: `\partial 4`.
  "chopin-prelude-4": { fifths: 1, mode: "minor", beats: 2, beatType: 2, pickup: true },
  // Mutopia 931, fur_Elise_WoO59.ly line 46: `\partial 8 e''16`.
  "fur-elise": { pickup: true },
  // Mutopia 37, gymnopedie_1.ly lines 32–33: `\key b \minor` and `\time 3/4`. The estimate gave D major, the same
  // signature; only the mode changes.
  "gymnopedie-1": { mode: "minor" },
  // Mutopia 23, maple.ly line 38: `\partial 8`.
  "maple-leaf-rag": { pickup: true },
  // Mutopia 276, moonlight-lys.zip, moonlight3-a4.ly lines 110 and 535: `\key cis \minor`. Read 2026-10-25, when the
  // chart grew to the whole exposition (bars 1–65) and the estimate drifted to G♯ minor, the second theme's key.
  "moonlight-3": { fifths: 4, mode: "minor" },
  // Mutopia 1590, chopin_nocturne_op9_n2.ly lines 92–93: `\key ef \major` and `\time 12/8`. The estimate agrees on
  // E♭ major; the rule gave 6/4 from beatsPerBar 6. Line 97: `\partial 8`.
  "nocturne-op9-2": { beats: 12, beatType: 8, pickup: true },
};
