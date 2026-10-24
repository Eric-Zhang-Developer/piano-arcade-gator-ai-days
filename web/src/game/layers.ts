import type { GamePlugin } from "../contracts";
import { barLoop } from "./bar-loop";
import { beatTrack } from "./beat";
import { hud } from "./hud";
import { warningCard } from "./difficulty";
import { feverGauge } from "./fever-gauge";
import { juiceVisual } from "./juice";
import { midiWatchdog } from "./midi-watchdog";
import { pianoOut } from "./piano-out";
import { scenes } from "./scenes";
import { evenness } from "./evenness";
import { eventSounds } from "./sound";
import { simPlugin } from "./sim/plugin";
import { feverStage } from "./stage";

// Open file: each game feature registers its plugin here, one line each. /play draws every plugin's layer on its
// own canvas above the highway, forwards every GameEvent, and applies transformChart and wrapInput in this order.
export const plugins: GamePlugin[] = [
  barLoop(), // first: every later plugin (the sim's bot included) sees the looped chart
  scenes(), // ?bot=<name>: after bar-loop, so the bot plays the looped chart
  simPlugin, // piano-sim: /play?midi=sim only. First, so later plugins asking for MIDI get the fake piano.
  juiceVisual(), // under the HUD: wisps and flares never cover the score
  hud(), // before beat-track, so beat-track's status line draws over the HUD's top panel
  beatTrack(),
  midiWatchdog(), // reconnects a piano that goes silent mid-song
  pianoOut(), // records the take for "Replay on piano"
  feverStage(), // three.js stage behind the highway (background hook only, no 2D layer)
  evenness(), // results panel: how even each hand's runs were
  eventSounds(), // laptop sounds at combo milestones, fever, full combo, rank and (optionally) misses
  feverGauge(), // late: its gauge sizes from the chart after every transformChart, as the judge does
  warningCard(), // after every transformChart too: the level is the chart the player gets; WARNING at Lv 13+
];
