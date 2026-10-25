// The judged noteheads on the paper (sheet-paper): the HUD's hues, darkened in HSL lightness until each has 3.5:1
// against --pa-paper, so a notehead keeps its judgment's hue and stays readable. The HUD's own gold and grey measure
// 1.1:1 and 2.8:1 on the paper. Decision sheet-paper-colors.md.
import type { Judgment } from "./plugin";

export const paperJudgmentColors: Record<Judgment, string> = {
  PERFECT: "#9b7900", // the HUD's #ffe27a
  GREAT: "#0c8f66", // #5ef2c4
  GOOD: "#0978ff", // #7cb7ff
  MISS: "#787e88", // #8a8f98
};
