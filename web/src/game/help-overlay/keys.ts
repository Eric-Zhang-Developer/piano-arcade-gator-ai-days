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
}

export interface HelpGroup {
  screen: string;
  lines: HelpLine[];
}

// The laptop letters for a chart starting at middle C, from core's own key map, so they can't drift from the game.
const letter = (code: string) => (code === "Semicolon" ? ";" : code.replace(/^Key/, ""));
const laptop = [...keyMap(60)].sort((a, b) => a[1] - b[1]);
export const laptopWhites = laptop.filter(([, p]) => !isBlack(p)).map(([c]) => letter(c));
export const laptopBlacks = laptop.filter(([, p]) => isBlack(p)).map(([c]) => letter(c));

const SELECT = "game/select-layout/index.tsx";
const OPTIONS = "game/options-panel/index.tsx";
const RECORDS = "game/records/panel.tsx";
const PAUSE = "game/pause-skin/index.tsx";

export const helpGroups: HelpGroup[] = [
  {
    screen: "Music select",
    lines: [
      { keys: ["↑", "↓"], what: "choose a song", source: [SELECT], match: ["ArrowUp", "ArrowDown"] },
      { keys: ["Enter"], what: "play it" },
      { keys: ["L"], what: "learn it: the song waits for each note", source: [SELECT] },
      { keys: ["E"], what: "switch Normal and Easy", source: [SELECT], match: ["e"] },
      { keys: ["F"], what: "a guided first song, 30 seconds", source: ["game/first-run/index.tsx"], match: ["f"] },
      { keys: ["O"], what: "Options: latency, volume, labels", source: [OPTIONS], match: ["o"] },
      {
        keys: ["↑", "↓", "←", "→", "Enter"],
        what: "rows, values, boxes",
        where: "in Options",
        source: [OPTIONS],
        match: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"],
      },
    ],
  },
  {
    screen: "Start screen",
    lines: [
      { keys: ["Enter"], what: "start" },
      { keys: laptopWhites, what: "the white keys, from middle C", source: ["game/core/input.ts"] },
      { keys: laptopBlacks, what: "the black keys", source: ["game/core/input.ts"] },
      { keys: ["Z", "X"], what: "laptop keys an octave down / up", source: ["game/laptop-octaves/index.tsx"], match: ["KeyZ", "KeyX"] },
      {
        keys: ["−", "+"],
        what: "zoom the score",
        where: "in Sheet music ↗",
        source: ["game/sheet-view/SheetView.tsx"],
        match: ["-", "_", "+", "="],
      },
    ],
  },
  {
    screen: "Playing",
    lines: [
      { keys: ["Esc"], what: "pause, and again to resume", source: ["app/play/page.tsx", PAUSE], match: ["Escape"] },
      { keys: ["↑", "↓", "Enter"], what: "Resume, Retry or Quit", where: "paused", source: [PAUSE], match: ["ArrowUp", "ArrowDown"] },
    ],
  },
  {
    screen: "Results",
    lines: [
      { keys: ["Enter"], what: "retry" },
      { keys: ["A–Z"], what: "initials for a new record", source: [RECORDS] },
      { keys: ["↑", "↓"], what: "change the last letter", source: [RECORDS], match: ["ArrowUp", "ArrowDown"] },
      { keys: ["Backspace"], what: "erase a letter", source: [RECORDS], match: ["Backspace"] },
      { keys: ["Enter"], what: "save the initials", source: [RECORDS], match: ["Enter"] },
      { keys: ["Esc"], what: "close the replay", source: ["game/replay-view/overlay.tsx"], match: ["Escape"] },
    ],
  },
  {
    screen: "Anywhere",
    lines: [
      { keys: ["?"], what: "this card; Esc closes it", source: ["game/help-overlay/index.tsx"], match: ["?", "Escape"] },
      { keys: ["Shift", "Esc"], what: "back to the music select, clean", source: ["game/demo-reset/index.tsx"], match: ["Escape"] },
    ],
  },
];

// Files that handle keys but need no line, and why.
export const unlisted: Record<string, string> = {
  "game/cabinet/idle.ts": "any key restarts the cabinet's idle timer: not a control",
  "game/song-preview/index.tsx": "Enter and L stop the preview as you leave the select: the select's lines cover them",
  "game/ui-sounds/index.ts": "notes the page's first key or pointer press, after which UI sounds may play: not a control",
};
