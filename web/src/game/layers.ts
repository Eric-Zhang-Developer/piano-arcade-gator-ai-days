import type { GamePlugin } from "../contracts";

// Open file: each game feature registers its plugin here, one line each. /play draws every plugin's layer on its
// own canvas above the highway, forwards every GameEvent, and applies transformChart and wrapInput in this order.
export const plugins: GamePlugin[] = [];
