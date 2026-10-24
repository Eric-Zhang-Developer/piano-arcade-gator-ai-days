import type { GamePlugin } from "../contracts";
import { barLoop } from "./bar-loop";
import { beatTrack } from "./beat";
import { handColors } from "./hand-colors";
import { hud } from "./hud";
import { warningCard } from "./difficulty";
import { feverGauge } from "./fever-gauge";
import { juiceVisual } from "./juice";
import { midiWatchdog } from "./midi-watchdog";
import { noteLabels } from "./note-labels";
import { pianoOut } from "./piano-out";
import { scenes } from "./scenes";
import { evenness } from "./evenness";
import { dynamics } from "./dynamics";
import { records } from "./records";
import { eventSounds } from "./sound";
import { simPlugin } from "./sim/plugin";
import { weakBars } from "./weak-bars";
import { feverStage } from "./stage";
import { takeGraph } from "./take-graph";

// Open file: each game feature registers its plugin here, one line each. /play draws every plugin's layer on its
// own canvas above the highway, forwards every GameEvent, and applies transformChart and wrapInput in this order.
export const plugins: GamePlugin[] = [
  barLoop(), // first: every later plugin (the sim's bot included) sees the looped chart
  scenes(), // ?bot=<name>: after bar-loop, so the bot plays the looped chart
  simPlugin, // piano-sim: /play?midi=sim only. First, so later plugins asking for MIDI get the fake piano.
  noteLabels(), // after bar-loop, scenes and the sim: it labels the final chart and sees which device really played
  juiceVisual(), // under the HUD: wisps and flares never cover the score
  handColors(), // the L/R legend during the count-in, two-hand charts only
  hud(), // before beat-track, so beat-track's status line draws over the HUD's top panel
  beatTrack(),
  midiWatchdog(), // reconnects a piano that goes silent mid-song
  records(), // results panel: NEW RECORD, initials and the top 5, first under the score
  dynamics(), // results panel: how loud you played against the score, above "Replay on piano"
  pianoOut(), // records the take for "Replay on piano"
  feverStage(), // three.js stage behind the highway (background hook only, no 2D layer)
  weakBars(), // results panel: accuracy per phrase, and a link to loop the weakest
  evenness(), // results panel: how even each hand's runs were
  takeGraph(), // results panel: every note's timing over the song
  eventSounds(), // laptop sounds at combo milestones, fever, full combo, rank and (optionally) misses
  feverGauge(), // late: its gauge sizes from the chart after every transformChart, as the judge does
  warningCard(), // after every transformChart too: the level is the chart the player gets; WARNING at Lv 13+
];
