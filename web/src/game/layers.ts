import type { GamePlugin } from "../contracts";
import { barLoop } from "./bar-loop";
import { beatTrack } from "./beat";
import { hud } from "./hud";
import { juiceVisual } from "./juice";
import { midiWatchdog } from "./midi-watchdog";
import { pianoOut } from "./piano-out";
import { eventSounds } from "./sound";
import { simPlugin } from "./sim/plugin";

// Open file: each game feature registers its plugin here, one line each. /play draws every plugin's layer on its
// own canvas above the highway, forwards every GameEvent, and applies transformChart and wrapInput in this order.
export const plugins: GamePlugin[] = [
  barLoop(), // first: every later plugin (the sim's bot included) sees the looped chart
  simPlugin, // piano-sim: /play?midi=sim only. First, so later plugins asking for MIDI get the fake piano.
  juiceVisual(), // under the HUD: wisps and flares never cover the score
  hud(), // before beat-track, so beat-track's status line draws over the HUD's top panel
  beatTrack(),
  midiWatchdog(), // reconnects a piano that goes silent mid-song
  pianoOut(), // records the take for "Replay on piano"
  eventSounds(), // laptop sounds at combo milestones, fever, full combo, rank and (optionally) misses
];
