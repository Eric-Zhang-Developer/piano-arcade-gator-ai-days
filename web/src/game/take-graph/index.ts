// A results panel (play-slots): every note's timing over the song (spec: take-graph).
import { createElement } from "react";
import type { GamePlugin } from "../../contracts";
import { TakeGraph } from "./TakeGraph";

export { describePoint, graphPoints, sensesVelocity, wrongMarks } from "./graph";

export function takeGraph(): GamePlugin {
  return {
    id: "take-graph",
    resultsPanel: ({ chart, take, results }) => createElement(TakeGraph, { chart, take, results }),
  };
}
