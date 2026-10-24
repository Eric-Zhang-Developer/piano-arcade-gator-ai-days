// Key and meter read from each library chart's cited source, where they disagree with the estimate (key.ts) or the
// meter rule (index.ts). Read from the source files on 2026-10-24; every other chart's source agrees with the
// estimate and the rule (the done note lists them all). An entry's meter must equal the chart's beatsPerBar.
import type { Mode } from "./key";

export interface Override {
  fifths?: number;
  mode?: Mode;
  beats?: number;
  beatType?: number;
}

export const overrides: Record<string, Override> = {
  // Mutopia 921, Chop-28-4a-lys.zip, chp-28-04-a4.ly lines 50–51: `\key e \minor` and `\time 2/2`. The estimate gave
  // A minor, and the rule 4/4 from beatsPerBar 4.
  "chopin-prelude-4": { fifths: 1, mode: "minor", beats: 2, beatType: 2 },
  // Mutopia 37, gymnopedie_1.ly lines 32–33: `\key b \minor` and `\time 3/4`. The estimate gave D major, the same
  // signature; only the mode changes.
  "gymnopedie-1": { mode: "minor" },
  // Mutopia 1590, chopin_nocturne_op9_n2.ly lines 92–93: `\key ef \major` and `\time 12/8`. The estimate agrees on
  // E♭ major; the rule gave 6/4 from beatsPerBar 6.
  "nocturne-op9-2": { beats: 12, beatType: 8 },
};
