// Experiments (spec: experiments): variations that live on main, off by default, until Eric's verdict keeps or prunes
// them. Each one is a folder here, web/src/game/x/<name>/, and one line in `experiments`; the Lab's gallery reads
// this list, and xFrame() is the one plugin layers.ts mounts. An experiment's module runs no code when imported.
import { createElement, Fragment, type ReactNode } from "react";
import type { GamePlugin } from "../../contracts";
import { createGuard, type Guard } from "../crash-guard";
import { conductor } from "./conductor";
import { realKeys } from "./real-keys";
import { sample } from "./sample";
import { screenShake } from "./screen-shake";

export interface Experiment {
  name: string; // its folder and its flag: ?x=<name>, comma-separated for several
  title: string;
  group: string; // the gallery's heading it sits under
  line: string; // what it does, one line
  issue?: number;
  href: string; // a page under web/src/app/ that opens it ready to see: the song and ?x=<name> preset
  plugin(): GamePlugin; // called only when it's on
}

export const experiments: Experiment[] = [
  sample, // the sample that proves the frame; pruning it is the prune rule's first use
  screenShake,
  conductor,
  realKeys, // #1017: its own page, /real-keys; on /play only a start-panel link to it
];

// The names a take's ?x= turns on.
export const flagged = (params: URLSearchParams): Set<string> =>
  new Set((params.get("x") ?? "").split(",").map((s) => s.trim()).filter(Boolean));

const panels = (nodes: [string, ReactNode][]): ReactNode => {
  const shown = nodes.filter(([, n]) => n != null && n !== false);
  return shown.length ? shown.map(([id, n]) => createElement(Fragment, { key: id }, n)) : null;
};

// /play's hooks, passed to the experiments the take's ?x= turns on, in registry order. None on: no experiment's
// plugin is made or called. A throw turns off that experiment alone for the rest of the take (crash-guard's guard).
// The stage (background) stays fever-stage's: /play takes the first plugin with one, so the frame has none.
export function xFrame(registry: Experiment[] = experiments): GamePlugin {
  const made = new Map<string, GamePlugin>();
  let on: GamePlugin[] = [];
  let guard: Guard = createGuard(() => {});
  return {
    id: "experiments",
    transformChart(chart, params) {
      const names = flagged(params);
      on = registry
        .filter((x) => names.has(x.name))
        .map((x) => {
          if (!made.has(x.name)) made.set(x.name, x.plugin());
          return made.get(x.name)!;
        });
      guard = createGuard(() => {});
      return on.reduce((c, p) => p.transformChart?.(c, params) ?? c, chart);
    },
    wrapInput: (d) => on.reduce((dev, p) => p.wrapInput?.(dev) ?? dev, d),
    draw(ctx, f) {
      for (const p of on) {
        if (!p.draw || guard.off(p.id)) continue;
        ctx.save();
        guard.run(p.id, "draw", () => p.draw!(ctx, f));
        ctx.restore();
      }
    },
    onEvent(e) {
      for (const p of on) if (p.onEvent) guard.run(p.id, "onEvent", () => p.onEvent!(e));
    },
    startPanel: (c) => panels(on.map((p) => [p.id, p.startPanel?.(c)])),
    resultsPanel: (c) => panels(on.map((p) => [p.id, p.resultsPanel?.(c)])),
  };
}
