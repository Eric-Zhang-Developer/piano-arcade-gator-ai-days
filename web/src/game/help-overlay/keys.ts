// The help card's lines as data (spec: help-overlay). `source` names the files whose key handlers a line documents,
// and `match` the key literals those handlers compare: help-overlay.test.ts reads every handler's source and fails
// when a key it handles has no line here. Add a line through a fix(help-overlay) PR.
import { isBlack } from "../core/highway";
import { keyMap } from "../core/input";

export interface HelpLine {
  keys: string[]; // each a <kbd> chip
  what: string;
  where?: string; // when it's narrower than the group's screen
  source?: string[]; // paths from web/src
  match?: string[]; // the key literals those sources compare (`e.key === "ArrowUp"`), case-insensitive
  // mouse-first: every action is clickable and keys are only shortcuts. `control` is the accessible name of the button,
  // link or group that does the same on this screen; `keyOnly` says why a line has none. help-overlay.test.ts finds each
  // control in the group's `files`.
  control?: string;
  keyOnly?: string;
}

export interface HelpGroup {
  screen: string;
  files: string[]; // the screen's sources, where its lines' controls are (paths from web/src)
  lines: HelpLine[];
}

// The laptop letters for a chart starting at middle C, from core's own key map, so they can't drift from the game.
const letter = (code: string) => (code === "Semicolon" ? ";" : code.replace(/^Key/, ""));
const laptop = [...keyMap(60)].sort((a, b) => a[1] - b[1]);
export const laptopWhites = laptop.filter(([, p]) => !isBlack(p)).map(([c]) => letter(c));
export const laptopBlacks = laptop.filter(([, p]) => isBlack(p)).map(([c]) => letter(c));

const SELECT = "game/select-layout/index.tsx";
const OPTIONS = "game/options-panel/index.tsx";
const RECORDS = "game/records/initials.ts"; // the entry's keys, shared with record-moment (#495, #499)
const PAUSE = "game/pause-skin/index.tsx";
const SONG_OPTIONS = "game/song-options/index.tsx"; // its keys are compared in song-options/options.ts (keyOptions)
const PLAY = "app/play/page.tsx";
const LAPTOP = "the laptop piano itself";
const INITIALS = "typing your initials";

export const helpGroups: HelpGroup[] = [
  {
    screen: "Music select",
    files: [SELECT, "game/song-finder/Finder.tsx", "game/duo-select/Select.tsx", SONG_OPTIONS, "game/easy-charts/level.tsx", "game/first-run/index.tsx", OPTIONS, "game/lab/LabLink.tsx"],
    lines: [
      { keys: ["↑", "↓"], what: "choose a song", source: [SELECT, "game/song-finder/Finder.tsx"], match: ["ArrowUp", "ArrowDown"], control: "Songs" },
      { keys: ["Enter"], what: "Perform: on the beat, ranked", control: "PLAY" },
      { keys: ["L"], what: "Learn: the song waits for each note", source: [SELECT], control: "LEARN" },
      { keys: ["P"], what: "practice it in Flow: narrows onto the bars you miss", source: [SELECT], match: ["p"], control: "PRACTICE" },
      { keys: ["W"], what: "watch it: the perfect bot plays it", source: [SELECT], control: "WATCH" }, // through watch-demo's isWatchKey (#580)
      { keys: ["H"], what: "Hands: both, right or left", source: [SONG_OPTIONS], match: ["h"], control: "Hands" },
      { keys: ["←", "→"], what: "Speed: slower or faster", source: [SONG_OPTIONS], match: ["ArrowLeft", "ArrowRight"], control: "Speed" },
      { keys: ["E"], what: "switch Normal and Easy", source: [SELECT], match: ["e"], control: "EASY Lv" },
      { keys: ["F"], what: "a guided first song, 30 seconds", source: ["game/first-run/index.tsx"], match: ["f"], control: "First time? 30-second first song" },
      { keys: ["O"], what: "Options: latency, volume, labels", source: [OPTIONS], match: ["o"], control: "Options" },
      { keys: ["X"], what: "the lab of experiments; Esc back", source: ["game/lab/LabLink.tsx", "game/lab/Lab.tsx"], match: ["x", "Escape"], control: "Lab" },
      {
        keys: ["↑", "↓", "←", "→", "Enter"],
        what: "rows, values, boxes",
        where: "in Options",
        source: [OPTIONS],
        match: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"],
        control: "Options",
      },
    ],
  },
  {
    screen: "Start screen",
    files: [PLAY, "game/duo-start/StartScreen.tsx", "game/sheet-view/SheetView.tsx"],
    lines: [
      { keys: ["Enter"], what: "start", control: "Start" },
      { keys: laptopWhites, what: "the white keys, from middle C", source: ["game/core/input.ts"], keyOnly: LAPTOP },
      { keys: laptopBlacks, what: "the black keys", source: ["game/core/input.ts"], keyOnly: LAPTOP },
      {
        keys: ["Z", "X"],
        what: "laptop keys an octave down / up",
        source: ["game/laptop-octaves/index.tsx"],
        match: ["KeyZ", "KeyX"],
        keyOnly: "a laptop-play aid (mouse-first)",
      },
      {
        keys: ["−", "+"],
        what: "zoom the score",
        where: "in Sheet music ↗",
        source: ["game/sheet-view/SheetView.tsx"],
        match: ["-", "_", "+", "="],
        control: "Zoom in",
      },
    ],
  },
  {
    screen: "Playing",
    files: [PLAY, PAUSE],
    lines: [
      { keys: ["Esc"], what: "pause, and again to resume", source: [PLAY, PAUSE], match: ["Escape"], control: "Pause" },
      { keys: ["↑", "↓", "Enter"], what: "Resume, Retry or Quit", where: "paused", source: [PAUSE], match: ["ArrowUp", "ArrowDown"], control: "Resume" },
      { keys: ["←", "→"], what: "a bar back or ahead", where: "learning", source: [PLAY], match: ["ArrowLeft", "ArrowRight"], control: "Back a bar" },
    ],
  },
  {
    screen: "Results",
    files: ["game/results-layout/index.tsx", "game/replay-view/overlay.tsx"],
    lines: [
      { keys: ["Enter"], what: "retry", control: "Retry" },
      { keys: ["A–Z"], what: "initials for a new record", source: [RECORDS], keyOnly: INITIALS },
      { keys: ["↑", "↓"], what: "change the last letter", source: [RECORDS], match: ["ArrowUp", "ArrowDown"], keyOnly: INITIALS },
      { keys: ["Backspace"], what: "erase a letter", source: [RECORDS], match: ["Backspace"], keyOnly: INITIALS },
      { keys: ["Enter"], what: "save the initials", source: [RECORDS], match: ["Enter"], keyOnly: INITIALS },
      { keys: ["Esc"], what: "close the replay", source: ["game/replay-view/overlay.tsx"], match: ["Escape"], control: "Stop" },
    ],
  },
  {
    screen: "Simon says",
    files: ["app/simon/page.tsx"],
    lines: [
      { keys: ["Space"], what: "start a run, or again after one; Enter too", source: ["app/simon/page.tsx"], match: ["Space", "Enter"], control: "Start" },
      { keys: ["A–;"], what: "play the phrase back on the laptop keys", source: ["app/simon/page.tsx"], match: ["Semicolon"], keyOnly: LAPTOP },
    ],
  },
  {
    screen: "Spot the wrong note",
    files: ["app/wrong-note/page.tsx"],
    lines: [
      { keys: ["Space"], what: "start a set, or the next round; Enter too", source: ["app/wrong-note/page.tsx"], match: ["Space", "Enter"], control: "Start" },
      { keys: ["2–8"], what: "the note that changed", source: ["app/wrong-note/page.tsx"], control: "The phrase's 8 notes" },
      { keys: ["R"], what: "hear the phrase again", source: ["app/wrong-note/page.tsx"], match: ["r", "R"], control: "Replay" },
    ],
  },
  {
    screen: "Anywhere",
    files: ["game/help-overlay/index.tsx"],
    lines: [
      { keys: ["?"], what: "this card; Esc closes it", source: ["game/help-overlay/index.tsx"], match: ["?", "Escape"], control: "Controls" },
      {
        keys: ["Shift", "Esc"],
        what: "back to the music select, clean",
        source: ["game/demo-reset/index.tsx"],
        match: ["Escape"],
        keyOnly: "an operator trick for demos (mouse-first)",
      },
    ],
  },
];

// Files that handle keys but need no line, and why.
export const unlisted: Record<string, string> = {
  "game/audio-track/index.ts": "starts a local song's recording on the first key or pointer press: not a control",
  "game/cabinet/idle.ts": "any key restarts the cabinet's idle timer: not a control",
  "game/take-graph/TakeGraph.tsx": "arrows, Home and End step the take graph's readout only while the graph has focus, like a slider: the graph names its own keys",
  "game/song-preview/index.tsx": "Enter and L stop the preview as you leave the select: the select's lines cover them",
  "game/results-landing/index.ts": "any key or click skips the results landing to its end state and does nothing else: not a control",
  "game/laptop-sound/index.ts": "starts the laptop's audio on the first key or pointer press; its notes are the laptop keys' lines: not a control",
  "game/ui-sounds/index.ts": "notes the page's first key or pointer press, after which UI sounds may play: not a control",
};
