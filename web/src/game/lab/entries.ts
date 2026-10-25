// The lab's entries (spec: lab): one per done feature that /'s menu doesn't reach. Each description is copied from
// its feature's changes/<slug>.md "What shipped", never written fresh; lab.test.ts holds every entry to that, to a
// done note, to a page under web/src/app/ and to a song in the library.

export interface LabEntry {
  slug: string; // the feature: changes/<slug>.md
  name: string;
  description: string; // a run of the done note's words, Markdown emphasis and backticks dropped
  href: string;
  open: string; // the button's words
}

export interface LabGroup {
  title: string;
  entries: LabEntry[];
}

export const labGroups: LabGroup[] = [
  {
    title: "Play differently",
    entries: [
      {
        slug: "wait-mode",
        name: "Wait mode",
        description: "the highway stops on each note (a chord waits for all its keys), never calls a MISS, plays no beat",
        href: "/play?song=twinkle&mode=wait",
        open: "Twinkle, wait mode",
      },
      {
        slug: "adaptive-chunks",
        name: "Adaptive chunks",
        description:
          '"Practice in chunks" now starts on the whole song at 70% (practice=adapt) instead of walking it 4 bars at a time.',
        href: "/play?song=fur-elise",
        open: "Für Elise's start screen",
      },
      {
        slug: "bar-loop",
        name: "Bar loop",
        description: 'Each pass is scored on its own, and a "Passes" panel next to the results lists each pass\'s accuracy in order.',
        href: "/play?song=fur-elise&from=1&to=4&tempo=70",
        open: "Für Elise, bars 1–4 at 70%",
      },
      {
        slug: "hand-mode",
        name: "One hand",
        description: "results score only the hand you play, and the piano plays it in time",
        href: "/play?song=fur-elise&hands=R",
        open: "Für Elise, right hand",
      },
      {
        slug: "rewind",
        name: "Rewind",
        description: "In wait mode, and so in chunk-practice's learn steps, ← moves back a bar and → skips ahead one",
        href: "/play?song=twinkle&mode=wait",
        open: "Twinkle, wait mode",
      },
    ],
  },
  {
    title: "Watch",
    entries: [
      {
        slug: "watch-demo",
        name: "Watch demo",
        description: "W on the music select plays the focused song with the perfect bot, audible and hands-off.",
        href: "/play?song=twinkle&bot=perfect&audible=1&demo=1",
        open: "Twinkle, the perfect bot",
      },
      {
        slug: "cabinet",
        name: "Cabinet",
        description: "Idle 30 s, it shows attract (/attract, started automatically) for 60 s, then a perfect-bot demo of Twinkle on the piano",
        href: "/cabinet",
        open: "/cabinet",
      },
      {
        slug: "operator-replay",
        name: "Attract",
        description: "a three.js synthwave stage (neon grid, low sun, slow orbit) with one pillar per feature spec",
        href: "/attract",
        open: "/attract",
      },
    ],
  },
  {
    title: "Score",
    entries: [
      {
        slug: "sheet-view",
        name: "Sheet music",
        description: "While /play runs a take, the sheet's cursor follows the chart clock, and each judged note's notehead takes its HUD color.",
        href: "/sheet?song=twinkle",
        open: "/sheet, Twinkle",
      },
    ],
  },
  {
    title: "Experiments",
    entries: [
      {
        slug: "simon-says-spike",
        name: "Simon Says",
        description: "plays the opening notes of a library song, you repeat them, and each round adds a note.",
        href: "/simon",
        open: "/simon",
      },
      {
        slug: "veritas",
        name: "Veritas",
        description: "five test players (Golden, Rusher, Jitter, Fumbler, Chord Roller) plant mistakes in real library songs",
        href: "/veritas",
        open: "/veritas",
      },
      {
        slug: "piano-sim",
        name: "Piano sim",
        description: '/sim shows the game, a virtual keyboard, a raw MIDI log, fault buttons, "Watch the bot"',
        href: "/sim",
        open: "/sim",
      },
    ],
  },
  {
    title: "Behind the scenes",
    entries: [
      {
        slug: "operator-board",
        name: "Operator board",
        description: "the arcade's operator menu in synthwave bookkeeping",
        href: "/operator",
        open: "/operator",
      },
      {
        slug: "calibration",
        name: "Calibration",
        description: "The mean tap offset over clicks 5–12 is saved as the latency offset, which /play's slider then shows.",
        href: "/calibrate",
        open: "/calibrate",
      },
    ],
  },
  {
    title: "Learn",
    entries: [
      {
        slug: "learning-ui",
        name: "Learning",
        description: "guided mastery map, three-state parent/leaf examples, one prepared Start/real Resume, four existing activities",
        href: "/learn",
        open: "/learn",
      },
    ],
  },
];

export const labEntries: LabEntry[] = labGroups.flatMap((g) => g.entries);
