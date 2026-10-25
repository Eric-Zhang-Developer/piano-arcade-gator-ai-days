// Easy charts (spec: easy-charts): a pure function derives an Easy chart from any chart, with no hand-edited data,
// and the plugin plays it on /play?level=easy.
import type { GamePlugin } from "../../contracts";
import { easyChart } from "./chart";

export { easyChart, easySettings } from "./chart";
export { LevelToggle, setLevel, useLevel, withLevel, type Level } from "./level";

export const isEasy = (params: URLSearchParams) => params.get("level") === "easy";

export function easyCharts(): GamePlugin {
  return {
    id: "easy-charts",
    transformChart: (c, params) => (isEasy(params) ? easyChart(c) : c),
  };
}
