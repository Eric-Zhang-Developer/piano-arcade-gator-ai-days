// The gallery's wall labels (spec: lab-gallery): what kind each experiment is, what it needs to be judged, and its
// poster. They live here, keyed by name, not on `Experiment` in x/index.ts: an open PR holds that file
// (specs/decisions/lab-gallery-labels.md has the evidence for every value). An entry with no label renders as a
// text card, as before.
import type { Experiment } from "..";

export type Kind = "wow" | "polish" | "spike";
export type Need = "dgx" | "camera" | "mic";

export interface Label {
  kind?: Kind; // from the issue's labels
  needs?: Need[]; // what it can't be judged without; [] is nothing
  poster?: string; // a still under /lab/, captured from the experiment's own href with ?capture=1
}

export const labels: Record<string, Label> = {
  sample: { needs: [], poster: "/lab/sample.webp" },
  "screen-shake": { needs: [], poster: "/lab/screen-shake.webp" },
  conductor: { kind: "wow", needs: ["camera"], poster: "/lab/conductor.webp" },
  "real-keys": { kind: "wow", needs: ["dgx", "camera"], poster: "/lab/real-keys.webp" },
  "highlight-reel": { kind: "wow", needs: [], poster: "/lab/highlight-reel.webp" },
  "composers-hands": { kind: "wow", needs: [], poster: "/lab/composers-hands.webp" },
  "wet-paint": { kind: "wow", needs: [], poster: "/lab/wet-paint.webp" },
  round: { kind: "wow", needs: ["dgx"], poster: "/lab/round.webp" },
  "build-sonata": { kind: "wow", needs: [], poster: "/lab/build-sonata.webp" },
  "speaking-piano": { kind: "wow", needs: ["dgx"], poster: "/lab/speaking-piano.webp" },
  pinned: { kind: "wow", needs: [], poster: "/lab/pinned.webp" },
  "name-theme": { kind: "wow", needs: [], poster: "/lab/name-theme.webp" },
  "hand-palette": { kind: "polish", needs: [], poster: "/lab/hand-palette.webp" },
  "ui-sounds-ab": { kind: "polish", needs: [], poster: "/lab/ui-sounds-ab.webp" },
  inside: { kind: "wow", needs: [], poster: "/lab/inside.webp" },
};

export type Labeled = Experiment & Label;

export const labeled = (list: Experiment[], by: Record<string, Label> = labels): Labeled[] => list.map((x) => ({ ...x, ...by[x.name] }));

// Within a group, the ones that need nothing come first, so a review can start without the piano or a camera.
// Stable otherwise (Array.prototype.sort is). An entry with no `needs` counts as needing nothing.
export const needsNoneFirst = <T extends Label>(list: T[]): T[] => [...list].sort((a, b) => Number(!!a.needs?.length) - Number(!!b.needs?.length));
