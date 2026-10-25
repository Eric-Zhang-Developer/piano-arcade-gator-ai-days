import type { GamePlugin } from "../contracts";
import { barLoop } from "./bar-loop";
import { chordSync } from "./chord-sync";
import { chunkPractice } from "./chunk-practice";
import { easyCharts } from "./easy-charts";
import { beatTrack } from "./beat";
import { handColors } from "./hand-colors";
import { ghost } from "./ghost";
import { keyPreview } from "./key-preview";
import { handMode } from "./hand-mode";
import { hud } from "./hud";
import { firstRun } from "./first-run";
import { waitHud } from "./wait-hud";
import { warningCard } from "./difficulty";
import { stageCard } from "./stage-card";
import { clearCard } from "./clear-card";
import { feverGauge } from "./fever-gauge";
import { feverMoment } from "./fever-moment";
import { juiceVisual } from "./juice";
import { laptopOctaves } from "./laptop-octaves";
import { midiWatchdog } from "./midi-watchdog";
import { noteLabels } from "./note-labels";
import { pianoOut } from "./piano-out";
import { pianoVoice } from "./piano-voice";
import { scenes } from "./scenes";
import { watchDemo } from "./watch-demo";
import { evenness } from "./evenness";
import { dynamics } from "./dynamics";
import { records } from "./records";
import { recordMoment } from "./record-moment";
import { replayView } from "./replay-view";
import { eventSounds } from "./sound";
import { simPlugin } from "./sim/plugin";
import { tempoCurve } from "./tempo-curve";
import { weakBars } from "./weak-bars";
import { feverStage } from "./stage";
import { takeGraph } from "./take-graph";
import { cabinet } from "./cabinet/plugin";
import { demoReset } from "./demo-reset";
import { helpOverlay } from "./help-overlay";
import { versus } from "./versus";
import { takeMidi } from "./take-midi";
import { waitMode } from "./wait-mode/plugin";
import { flowMode } from "./flow-mode";
import { rewind } from "./rewind";
import { waitHint } from "./wait-hint";
import { scoreCard } from "./score-card";
import { sheetView } from "./sheet-view/plugin";
import { sheetReview } from "./sheet-review";
import { leds } from "./leds";
import { createSavePlugin, queueAndSend } from "../data/save-plugin";
import { crashGuard } from "./crash-guard";

// Open file: each game feature registers its plugin here, one line each. /play draws every plugin's layer on its
// own canvas above the highway, forwards every GameEvent, and applies transformChart and wrapInput in this order.
export const plugins: GamePlugin[] = [
  easyCharts(), // ?level=easy: first, so every later plugin (chunks, loops, hands, bots, the judge) sees the Easy chart
  scoreCard(), // results panel: Save card, the take as a PNG; before bar-loop, so it keeps the song's own title
  chunkPractice(), // before bar-loop, so it sees the whole chart to cut into chunks (returns it unchanged)
  barLoop(), // first: every later plugin (the sim's bot included) sees the looped chart
  handMode(), // ?hands=R|L: before scenes and the sim, so their bots and the judge get only the played hand
  versus(), // ?versus=1: before scenes and the sim, so their bots and the judge get both players' copies
  scenes(), // ?bot=<name>: after bar-loop, so the bot plays the looped chart
  simPlugin, // piano-sim: /play?midi=sim only. First, so later plugins asking for MIDI get the fake piano.
  ghost(), // the last take, dashed: under every layer that draws, after every plugin that changes the chart
  keyPreview(), // ?keypreview=0 off: keys glow before their notes; after ghost (the final chart), under the octave wash and labels
  laptopOctaves(), // Z and X: after scenes and the sim (their bots aren't laptop keys), before note-labels (shifted pitches)
  noteLabels(), // after bar-loop, scenes and the sim: it labels the final chart and sees which device really played
  waitHint(), // ?mode=wait: after 3 s on a note, its key pulses, it sounds once and its name shows; after noteLabels, on the final chart
  juiceVisual(), // under the HUD: wisps and flares never cover the score
  handColors(), // the L/R legend during the count-in, two-hand charts only
  hud(), // before beat-track, so beat-track's status line draws over the HUD's top panel
  firstRun(), // ?firstrun=1: its text cues draw over the HUD's layer, between the band and the 1 s mark
  waitHud(), // wait mode: LEARN and note n / N in the HUD's band, where the counters and score were
  watchDemo(), // ?demo=1 (W on the select): after scenes, and over the HUD band, where its DEMO badge draws; back to / after the results
  feverMoment(), // fever's start: the edge flash and a FEVER banner over the HUD band, under beat-track's status line
  beatTrack(),
  midiWatchdog(), // reconnects a piano that goes silent mid-song
  waitMode(), // start panel: Learn it first; results panel after a wait-mode take: Play it judged, on top
  flowMode(), // ?mode=flow: the tempo readout, the waiting note's glow, Take your time; Play in Flow; the results headline
  rewind(), // wait mode's start panel: ← → back or ahead a bar, under wait mode's line
  records(), // results panel: initials and the top 5, first under the score (a NEW RECORD take's entry is record-moment's)
  recordMoment(), // results panel: NEW RECORD stamps after the rank, with the high-score entry; after records, which sets the outcome
  dynamics(), // results panel: how loud you played against the score, above "Replay on piano"
  replayView(), // results panel: Watch replay, the take on the highway in time with piano-out
  pianoOut(), // records the take for "Replay on piano"
  pianoVoice(), // the chart's GM voice on the DGX for the take (and its replay), then grand piano again
  takeMidi(), // results panel: Download MIDI, the take as a .mid file
  feverStage(), // three.js stage behind the highway (background hook only, no 2D layer)
  tempoCurve(), // results panel: a rubato score beside the strict one
  weakBars(), // results panel: accuracy per phrase, and a link to loop the weakest
  evenness(), // results panel: how even each hand's runs were
  chordSync(), // results panel: chords rolled by more than 30 ms, per hand
  takeGraph(), // results panel: every note's timing over the song
  eventSounds(), // laptop sounds at combo milestones, fever, full combo, rank and (optionally) misses
  feverGauge(), // late: its gauge sizes from the chart after every transformChart, as the judge does
  clearCard(), // over the HUD and the meter: ALL PERFECT, FULL COMBO or CLEAR from the last note to the results
  warningCard(), // after every transformChart too: the level is the chart the player gets; WARNING at Lv 13+
  stageCard(), // start panel: ARE YOU READY, the jacket, title and level, above Start
  cabinet(), // ?cabinet=1 returns a finished game to /cabinet; ?cabinet=demo starts the demo and reports it
  demoReset(), // 60 s with no input on a plain take's results (not ?cabinet) loads / clean
  helpOverlay(), // ? card: knows when a take runs, so ? opens on the start screen and results only
  createSavePlugin(queueAndSend), // take-store: saves finished takes after the results screen
  sheetView(), // last: posts the chart as played (after every transformChart) to /sheet; "Sheet music ↗" on the start screen
  sheetReview(), // results panel: "Review on sheet ↗" stores this take's judgments and opens /sheet?review=1
  leds(), // after every transformChart: guide lights, hits and misses on the LED strip; "Connect lights" on the start screen
  crashGuard(), // ?crash=draw|event: a plugin that throws on purpose, for crash-guard's check; inert without ?crash
];
