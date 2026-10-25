// The constellation's colours: the Duo kit's (ui-tokens). Major triads in the kit's blue, minor in its purple, home
// in gold, the one warm colour, so it's the first thing found.
import { bg, gold, ink, inkDim, primary, secondary } from "../../ui-tokens";
import type { Look } from "./constellation";

export const look: Look = { ground: bg, ink, dim: inkDim, line: "rgba(125, 132, 150, 0.28)", major: primary, minor: secondary, home: gold };
export const fileLook: Look = { ...look, font: "ui-monospace, Menlo, monospace" }; // a downloaded file has no page font
